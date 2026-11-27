import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { ZodError } from "zod/v4";
import { db, pool, users, exams, attempts, questions, enrollments, activities, eq, inArray, type QuestionData, type BlueprintQuota } from "@workspace/db";
import examRouter from "./routes/exams";
import attemptRouter from "./routes/attempts";
import { HttpError, type AppUser } from "./lib/access";
import { checkBlueprint, generateForm } from "./lib/blueprint";

type TestRouter = { stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (req: Request, res: Response) => Promise<void> }[] } }[] };
async function call(router: unknown, method: string, path: string, id: string, appUser: AppUser, body = {}) {
  const route = (router as TestRouter).stack.find(s => s.route?.path === path && s.route.methods[method])!.route!;
  let status = 200;
  let data: any;
  const res = { status(n: number) { status = n; return this; }, json(value: unknown) { data = value; return this; } } as Response;
  try {
    await route.stack[0]!.handle({ params: { id }, appUser, body } as unknown as Request, res);
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, data: { error: error.message } };
    if (error instanceof ZodError) return { status: 400, data: { error: error.message } };
    throw error;
  }
  return { status, data };
}
const quota: BlueprintQuota = { topic: "Algebra", difficulty: "easy", type: "single", marks: 2, count: 2 };
const item = (id: string): QuestionData => ({
  id, text: `Which answer is correct for ${id}?`, category: "Algebra", difficulty: "easy", type: "single",
  marks: 2, options: [{ id: "a", text: "Correct" }, { id: "b", text: "Incorrect" }], correctAnswers: ["a"],
});

test("exact disjoint sampling never relaxes topic, band, type, marks or count", () => {
  const bank = Array.from({ length: 10 }, (_, i) => item(`q${i}`));
  const written: BlueprintQuota = { topic: "Geometry", difficulty: "hard", type: "written", marks: 5, count: 1 };
  bank.push(...Array.from({ length: 4 }, (_, i) => ({ ...item(`w${i}`), category: "Geometry", difficulty: "hard" as const, type: "written" as const, marks: 5, options: [], correctAnswers: [] })));
  const forms = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const form = generateForm([quota, written], bank);
    const check = checkBlueprint([quota, written], bank, form);
    assert.equal(check.matches, true);
    assert.equal(form.length, 3);
    assert.equal(form.reduce((s, q) => s + q.marks, 0), 9);
    assert.equal(new Set(form.map(q => q.id)).size, 3);
    forms.add(form.map(q => q.id).sort().join(","));
    form[0]!.correctAnswers.length = 0;
    assert.deepEqual(bank[0]!.correctAnswers, ["a"]);
  }
  assert.ok(forms.size > 1);
  assert.equal(checkBlueprint([quota, quota], bank).valid, false);
  assert.equal(checkBlueprint([{ ...quota, count: 201 }], bank).valid, false);
  const impossible = [{ ...quota, marks: 3 }];
  assert.equal(checkBlueprint(impossible, bank).checks[0]!.shortage, 2);
  assert.throws(() => generateForm(impossible, bank), /shortage 2/);
  assert.deepEqual(generateForm([], bank), bank);
});

test("PostgreSQL routes freeze pool, quotas and marking; isolate comparisons; never adjust grades", async () => {
  const prefix = `blueprint-${randomUUID()}`;
  const ids = ["owner", "outsider", "candidate", "other", "admin"].map(s => `${prefix}-${s}`);
  const examId = `${prefix}-exam`;
  const questionIds = Array.from({ length: 8 }, (_, i) => `${prefix}-q${i}`);
  const blueprintPath = "/exams/:id/blueprint";
  try {
    const people = await db.insert(users).values(ids.map((id, i) => ({
      id, email: `${id}@example.invalid`, name: `Blueprint fixture ${i}`,
      role: ["examiner", "examiner", "candidate", "candidate", "admin"][i]!,
    }))).returning();
    const [owner, outsider, candidate, other, admin] = ids.map(id => people.find(p => p.id === id)!);
    await db.insert(questions).values(questionIds.map(id => ({ id, ownerId: owner!.id, data: item(id) })));
    await db.insert(exams).values({
      id: examId, ownerId: owner!.id, title: "Blueprint fixture", instructions: "Answer the questions.",
      duration: 30, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
      questionSnapshot: questionIds.map(item), totalMarks: 16, randomize: false,
    });
    await db.insert(enrollments).values([candidate!, other!].map(u => ({ examId, userId: u.id })));
    const get = (u = owner!) => call(examRouter, "get", blueprintPath, examId, u);
    const set = (quotas: BlueprintQuota[], u = owner!) => call(examRouter, "put", blueprintPath, examId, u, { quotas });
    const action = (action: string) => call(examRouter, "post", "/exams/:id/action", examId, owner!, { action });
    const start = (u: AppUser, sandbox = false) => call(examRouter, "post", "/exams/:id/start", examId, u, { sandbox });
    assert.equal((await get(candidate!)).status, 403);
    assert.equal((await get(outsider!)).status, 403);
    assert.equal((await set([quota], candidate!)).status, 403);
    assert.equal((await set([quota, quota])).status, 400);
    assert.equal((await set([{ ...quota, count: 201 }])).status, 400);
    const shortage = await set([{ ...quota, difficulty: "hard" }]);
    assert.equal(shortage.data.valid, false);
    assert.equal(shortage.data.checks[0].shortage, 2);
    assert.equal((await action("publish")).status, 400);
    assert.equal((await start(owner!, true)).status, 400);
    assert.equal((await set([quota])).data.totalMarks, 4);
    // A paper/settings edit must preserve blueprint targets, not sum the whole pool.
    const updated = await call(examRouter, "patch", "/exams/:id", examId, owner!, {
      title: "Blueprint fixture", instructions: "Answer all questions.", subject: "Math", duration: 30,
      startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      questionIds, randomize: false,
    });
    assert.equal(updated.data.totalMarks, 4);
    assert.equal(updated.data.questionCount, 2);
    const sandbox = await start(owner!, true);
    assert.equal(sandbox.data.questions.length, 2);
    assert.deepEqual(sandbox.data.questions[0].correctAnswers, []);
    // Other staff cannot see private sandbox forms.
    assert.equal((await get(admin!)).data.forms.length, 0);
    // Live-bank edits invalidate drafts and must be caught again at publication.
    await db.update(questions).set({ data: { ...item(questionIds[0]!), difficulty: "hard" } }).where(eq(questions.id, questionIds[0]!));
    await set([{ ...quota, count: 8 }]);
    assert.equal((await get()).data.checks[0].shortage, 1);
    assert.equal((await action("publish")).status, 400);
    await set([quota]);
    assert.equal((await action("publish")).status, 200);
    assert.equal((await set([])).status, 409);
    const first = await start(candidate!);
    assert.equal(first.data.totalMarks, 4);
    assert.equal(first.data.questions.length, 2);
    const retry = await Promise.all([start(candidate!), start(candidate!)]);
    assert.equal(retry[0].data.id, first.data.id);
    assert.equal(retry[1].data.id, first.data.id);
    const [frozen] = await db.select().from(attempts).where(eq(attempts.id, first.data.id));
    // Delete the bank after publication: current and future attempts use the frozen pool.
    await db.delete(questions).where(inArray(questions.id, questionIds));
    const second = await start(other!);
    assert.equal(second.data.questions.length, 2);
    assert.equal((await get()).data.valid, true);
    const [unchanged] = await db.select().from(attempts).where(eq(attempts.id, first.data.id));
    assert.deepEqual(unchanged, frozen);
    assert.equal((await get(candidate!)).status, 403);
    const save = await call(attemptRouter, "put", "/attempts/:id/answers", first.data.id, candidate!, {
      operationId: `${prefix}-save`, answers: first.data.questions.map((q: QuestionData) => ({ questionId: q.id, value: '["a"]', markedForReview: false, revision: 1 })),
    });
    assert.equal(save.data.accepted, true);
    const submitted = await call(attemptRouter, "post", "/attempts/:id/submit", first.data.id, candidate!);
    assert.equal(submitted.data.score, null); // hidden until published
    const report = (await get()).data;
    assert.equal(report.forms.length, 3);
    assert.ok(report.forms.every((f: any) => f.matches && f.totalMarks === 4 && f.questionCount === 2));
    assert.ok(report.forms.every((f: any) => f.checks[0].actualCount === 2 && f.checks[0].actualMarks === 4));
    assert.equal(report.items.reduce((s: number, m: any) => s + m.samples, 0), 2); // no sandbox or active samples
    assert.ok(report.items.every((m: any) => m.accuracy === 100));
    await action("complete");
    assert.equal((await action("publish-results")).status, 200);
    const [before] = await db.select().from(attempts).where(eq(attempts.id, first.data.id));
    assert.equal(before!.score, 4);
    await get();
    await get();
    assert.equal((await set([])).status, 409);
    const [after] = await db.select().from(attempts).where(eq(attempts.id, first.data.id));
    assert.deepEqual(after, before);
    const resumed = await start(candidate!);
    assert.equal(resumed.data.score, 4);
    assert.deepEqual(resumed.data.questions.map((q: QuestionData) => q.correctAnswers), [["a"], ["a"]]);
  } finally {
    const rows = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.examId, examId));
    if (rows.length) await db.delete(attempts).where(inArray(attempts.id, rows.map(r => r.id)));
    await db.delete(activities).where(eq(activities.examId, examId));
    await db.delete(enrollments).where(eq(enrollments.examId, examId));
    await db.delete(exams).where(eq(exams.id, examId));
    await db.delete(questions).where(inArray(questions.id, questionIds));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
