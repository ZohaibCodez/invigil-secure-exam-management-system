import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response, IRouter } from "express";
import {
  db, pool, users, exams, questions, enrollments, attempts, admissions, activities, saveOperations,
  eq, and, inArray, DEFAULT_DELIVERY_SETTINGS, type QuestionData,
} from "@workspace/db";
import examRouter from "./routes/exams";
import admissionRouter from "./routes/admissions";
import attemptRouter from "./routes/attempts";
import { HttpError, type AppUser } from "./lib/access";

type TestRouter = {
  stack: { route?: {
    path: string; methods: Record<string, boolean>;
    stack: { handle: (req: Request, res: Response) => Promise<void> }[];
  } }[];
};
async function call(router: IRouter, method: string, path: string, id: string, appUser: AppUser, body: unknown = {}) {
  const route = (router as unknown as TestRouter).stack.find(s => s.route?.path === path && s.route.methods[method])!.route!;
  let status = 200;
  let data: any;
  const res = { status(n: number) { status = n; return this; }, json(value: unknown) { data = value; return this; } } as Response;
  try { await route.stack[0]!.handle({ params: { id }, appUser, body } as unknown as Request, res); }
  catch (error) {
    if (error instanceof HttpError) return { status: error.status, data: { error: error.message } };
    throw error;
  }
  return { status, data };
}

test("supervised admission binds candidate/exam, consumes once and never starts a timer before approval", async () => {
  const prefix = `delivery-fixture-${randomUUID()}`;
  const userIds = ["owner", "candidate", "other", "outsider", "admin"].map(s => `${prefix}-${s}`);
  const examIds = [`${prefix}-exam`, `${prefix}-second`, `${prefix}-legacy`];
  const questionIds = [`${prefix}-q1`, `${prefix}-q2`];
  try {
    const people = await db.insert(users).values(userIds.map((id, i) => ({
      id, email: `${id}@example.invalid`, name: `Delivery fixture ${i}`,
      role: ["examiner", "candidate", "candidate", "examiner", "admin"][i]!,
    }))).returning();
    const [owner, candidate, other, outsider, admin] = userIds.map(id => people.find(p => p.id === id)!);
    const now = Date.now();
    const paper: QuestionData[] = questionIds.map((id, i) => ({
      id, text: `Fixture question ${i + 1}`, type: "single", category: i ? "Physics" : "Mathematics",
      difficulty: "easy", marks: 1, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctAnswers: ["a"],
    }));
    await db.insert(questions).values(paper.map(data => ({ id: data.id, ownerId: owner!.id, data })));
    await db.insert(exams).values(examIds.slice(0, 2).map(id => ({
      id, ownerId: owner!.id, title: "Supervised delivery fixture", instructions: "Fixture only",
      duration: 10, startsAt: new Date(now - 60_000), endsAt: new Date(now + 600_000),
      status: "published", questionSnapshot: paper, totalMarks: 2, randomize: false,
      deliverySettings: { ...DEFAULT_DELIVERY_SETTINGS, requireProctorApproval: true,
        requireReadiness: true, confirmSubjects: true, lockOnSave: true, minimumAttemptPercent: 50 },
    })));
    await db.insert(exams).values({
      id: examIds[2]!, ownerId: owner!.id, title: "Legacy reviewable fixture", instructions: "Fixture only",
      duration: 10, startsAt: new Date(now - 60_000), endsAt: new Date(now + 600_000),
      status: "published", questionSnapshot: paper, totalMarks: 2, randomize: false,
    });
    await db.insert(enrollments).values(examIds.flatMap(examId =>
      [candidate!, other!].map(u => ({ examId, userId: u.id }))));
    const entry = await call(admissionRouter, "get", "/exams/:id/entry-information", examIds[0]!, candidate!);
    assert.equal(entry.status, 200);
    assert.deepEqual(entry.data.subjects, ["Mathematics", "Physics"]);
    assert.equal(entry.data.questionCount, 2);
    assert.equal(JSON.stringify(entry.data).includes("correctAnswers"), false);
    assert.equal(entry.data.candidateName, candidate!.name);
    const startBody = { entryVersion: entry.data.entryVersion, instructionsRead: true, deviceReady: true, subjectsConfirmed: true };
    const start = (body: unknown, user = candidate!, examId = examIds[0]!) =>
      call(examRouter, "post", "/exams/:id/start", examId, user, body);
    const request = (user = candidate!, examId = examIds[0]!) =>
      call(admissionRouter, "post", "/exams/:id/admissions", examId, user);
    const decide = (id: string, decision: "approve" | "deny", user = owner!) =>
      call(admissionRouter, "post", "/admissions/:id/decision", id, user, { decision, reason: "Fixture roster review" });
    const requested = await request();
    assert.equal(requested.status, 200);
    assert.equal(requested.data.status, "pending");
    const grantId = requested.data.id as string;
    const repeated = await request();
    assert.equal(repeated.data.id, grantId);
    assert.equal(repeated.data.expiresAt, requested.data.expiresAt);
    assert.equal((await request(owner!)).status, 403);
    assert.equal((await start({ sandbox: true })).status, 403);
    assert.equal((await call(admissionRouter, "get", "/admissions/:id", grantId, other!)).status, 403);
    assert.equal((await call(admissionRouter, "get", "/admissions/:id", grantId, outsider!)).status, 403);
    assert.equal((await decide(grantId, "approve", candidate!)).status, 403);
    assert.equal((await decide(grantId, "approve", outsider!)).status, 403);
    assert.equal((await start({ ...startBody, admissionId: grantId })).status, 403);
    assert.equal((await start({})).status, 409);
    assert.equal((await start({ ...startBody, deviceReady: false, admissionId: grantId })).status, 400);
    assert.equal((await start({ ...startBody, subjectsConfirmed: false, admissionId: grantId })).status, 400);
    assert.equal((await start({ ...startBody, entryVersion: "stale", admissionId: grantId })).status, 409);
    assert.equal((await db.select().from(attempts).where(eq(attempts.examId, examIds[0]!))).length, 0);
    const approved = await decide(grantId, "approve", admin!);
    assert.equal(approved.status, 200);
    assert.equal(approved.data.status, "approved");
    assert.equal(approved.data.reviewerName, admin!.name);
    const duplicateApproval = await decide(grantId, "approve", admin!);
    assert.equal(duplicateApproval.data.decidedAt, approved.data.decidedAt);
    assert.equal((await decide(grantId, "deny")).status, 409);
    // A staff decision still has not created an attempt or consumed exam time.
    assert.equal((await db.select().from(attempts).where(eq(attempts.examId, examIds[0]!))).length, 0);
    assert.equal((await start({ ...startBody, admissionId: grantId }, other!)).status, 403);
    const otherEntry = await call(admissionRouter, "get", "/exams/:id/entry-information", examIds[1]!, candidate!);
    assert.equal((await start({ ...startBody, entryVersion: otherEntry.data.entryVersion, admissionId: grantId }, candidate!, examIds[1]!)).status, 403);
    const started = await Promise.all([start({ ...startBody, admissionId: grantId }), start({ ...startBody, admissionId: grantId })]);
    assert.deepEqual(started.map(r => r.status), [200, 200]);
    assert.equal(started[0]!.data.id, started[1]!.data.id);
    assert.equal(started[0]!.data.deadline, started[1]!.data.deadline);
    assert.equal(started[0]!.data.deliverySettings.lockOnSave, true);
    assert.equal(started[0]!.data.entryAttestation.admissionId, grantId);
    const attemptId = started[0]!.data.id as string;
    const [consumed] = await db.select().from(admissions).where(eq(admissions.id, grantId));
    assert.equal(consumed!.status, "consumed");
    assert.equal(consumed!.attemptId, attemptId);
    assert.ok(consumed!.consumedAt);
    const resumed = await start({});
    assert.equal(resumed.data.id, attemptId);
    assert.equal(resumed.data.deadline, started[0]!.data.deadline);
    const candidateAttempts = await db.select().from(attempts).where(and(
      eq(attempts.examId, examIds[0]!), eq(attempts.userId, candidate!.id), eq(attempts.sandbox, false)));
    assert.equal(candidateAttempts.length, 1);

    const expiredRequest = await request(other!);
    await db.update(admissions).set({ requestedAt: new Date(now - 600_000), expiresAt: new Date(now - 1000) })
      .where(eq(admissions.id, expiredRequest.data.id));
    const expiredView = await call(admissionRouter, "get", "/admissions/:id", expiredRequest.data.id, other!);
    assert.equal(expiredView.data.status, "expired");
    assert.equal((await decide(expiredRequest.data.id, "approve")).status, 409);
    assert.equal((await start({ ...startBody, admissionId: expiredRequest.data.id }, other!)).status, 403);
    const renewed = await request(other!);
    assert.notEqual(renewed.data.id, expiredRequest.data.id);
    assert.equal((await decide(renewed.data.id, "deny")).data.status, "denied");
    assert.equal((await request(other!)).data.id, renewed.data.id);
    assert.equal((await start({ ...startBody, admissionId: renewed.data.id }, other!)).status, 403);
    await db.update(admissions).set({ requestedAt: new Date(now - 600_000), expiresAt: new Date(now - 1000) })
      .where(eq(admissions.id, renewed.data.id));
    assert.equal((await call(admissionRouter, "get", "/admissions/:id", renewed.data.id, other!)).data.status, "expired");

    const submit = () => call(attemptRouter, "post", "/attempts/:id/submit", attemptId, candidate!);
    assert.equal((await submit()).status, 409);
    const commit = (questionId: string, value: string, revision: number, user = candidate!, id = attemptId) =>
      call(attemptRouter, "post", "/attempts/:id/commit-question", id, user,
        { questionId, value, revision, markedForReview: false });
    const save = (questionId: string, value: string, revision: number, extra = {}) =>
      call(attemptRouter, "put", "/attempts/:id/answers", attemptId, candidate!, {
        answers: [{ questionId, value, revision, markedForReview: false, ...extra }], operationId: randomUUID(),
      });
    assert.equal((await commit(questionIds[0]!, '["a"]', 1, other!)).status, 403);
    assert.equal((await commit(questionIds[0]!, "[]", 1)).status, 400);
    assert.equal((await save(questionIds[0]!, '["a"]', 1)).data.accepted, true);
    const locked = await commit(questionIds[0]!, '["a"]', 1);
    assert.equal(locked.status, 200);
    const lockedAnswer = locked.data.answers.find((a: { questionId: string }) => a.questionId === questionIds[0]);
    assert.ok(lockedAnswer.lockedAt);
    const repeatedLock = await commit(questionIds[0]!, '["a"]', 1);
    assert.equal(repeatedLock.data.answers.find((a: { questionId: string }) => a.questionId === questionIds[0]).lockedAt, lockedAnswer.lockedAt);
    assert.equal((await commit(questionIds[0]!, '["b"]', 2)).status, 409);
    assert.equal((await save(questionIds[0]!, '["b"]', 999, { lockedAt: null })).data.accepted, false);
    assert.equal((await save(questionIds[0]!, '["a"]', 1000, { lockedAt: null })).data.accepted, true);
    const [saved] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    assert.equal(saved!.answers.find(a => a.questionId === questionIds[0])!.lockedAt, lockedAnswer.lockedAt);
    assert.equal((await save(questionIds[1]!, '["a"]', 5)).data.accepted, true);
    assert.equal((await commit(questionIds[1]!, '["b"]', 5)).status, 409);
    assert.equal((await commit(questionIds[1]!, '["a"]', 4)).status, 409);
    assert.equal((await commit(questionIds[1]!, '["b"]', 6)).status, 200);
    assert.equal((await commit("not-assigned", '["a"]', 1)).status, 400);
    const submitted = await submit();
    assert.equal(submitted.status, 200);
    const [graded] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    assert.equal(graded!.score, 1); // Correct A = 1, incorrect B = 0, no negative marking.
    assert.equal(graded!.status, "graded");
    assert.ok(graded!.answers.every(a => a.lockedAt));
    assert.equal((await commit(questionIds[0]!, '["a"]', 1)).status, 409);
    const duplicateSubmit = await submit();
    assert.equal(duplicateSubmit.data.submittedAt, submitted.data.submittedAt);

    const preview = await start({ sandbox: true }, owner!);
    assert.equal(preview.status, 200);
    assert.equal(preview.data.sandbox, true);
    assert.equal((await db.select().from(admissions).where(eq(admissions.candidateId, owner!.id))).length, 0);
    const expiryId = `${prefix}-expiry`;
    await db.insert(attempts).values({
      id: expiryId, examId: examIds[0]!, userId: other!.id, sandbox: false, questions: paper,
      totalMarks: 2, answers: [], startedAt: new Date(now - 120_000), deadline: new Date(now - 1000),
      deliverySettings: { ...DEFAULT_DELIVERY_SETTINGS, minimumAttemptPercent: 100, lockOnSave: true },
    });
    const expiredSubmit = await call(attemptRouter, "post", "/attempts/:id/submit", expiryId, other!);
    assert.equal(expiredSubmit.status, 200); // Minimum threshold MUST NOT block deadline finalization.
    assert.equal(expiredSubmit.data.status, "graded");
    const [expired] = await db.select().from(attempts).where(eq(attempts.id, expiryId));
    assert.equal(expired!.score, 0);
    assert.equal(expired!.submittedAt!.toISOString(), expired!.deadline.toISOString());
    const lateSave = await call(attemptRouter, "put", "/attempts/:id/answers", expiryId, other!, {
      operationId: randomUUID(), answers: [{ questionId: paper[0]!.id, value: '["a"]', revision: 1, markedForReview: false }],
    });
    assert.equal(lateSave.status, 409);
    const legacy = await start({}, candidate!, examIds[2]!);
    assert.equal(legacy.status, 200);
    assert.equal(legacy.data.deliverySettings.lockOnSave, false);
    assert.equal(legacy.data.entryAttestation, null);
    assert.equal((await commit(paper[0]!.id, '["a"]', 1, candidate!, legacy.data.id)).status, 409);
    for (const [revision, value] of [[1, '["a"]'], [2, '["b"]']] as const) {
      const response = await call(attemptRouter, "put", "/attempts/:id/answers", legacy.data.id, candidate!, {
        operationId: randomUUID(), answers: [{ questionId: paper[0]!.id, value, revision, markedForReview: false }],
      });
      assert.equal(response.data.accepted, true);
    }
    assert.equal((await call(attemptRouter, "post", "/attempts/:id/submit", legacy.data.id, candidate!)).status, 200);
    assert.equal((await db.select().from(admissions).where(eq(admissions.examId, examIds[2]!))).length, 0);
  } finally {
    const rows = await db.select({ id: attempts.id }).from(attempts).where(inArray(attempts.examId, examIds));
    if (rows.length) await db.delete(saveOperations).where(inArray(saveOperations.attemptId, rows.map(a => a.id)));
    await db.delete(admissions).where(inArray(admissions.examId, examIds));
    await db.delete(attempts).where(inArray(attempts.examId, examIds));
    await db.delete(enrollments).where(inArray(enrollments.examId, examIds));
    await db.delete(activities).where(inArray(activities.examId, examIds));
    await db.delete(exams).where(inArray(exams.id, examIds));
    await db.delete(questions).where(inArray(questions.id, questionIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});
after(async () => { await pool.end(); });
