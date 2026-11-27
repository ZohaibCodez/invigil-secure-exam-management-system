import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { db, pool, users, exams, attempts, incidents, saveOperations, incidentCases, eq, inArray } from "@workspace/db";
import reviewRouter from "./routes/incident-review";
import attemptRouter from "./routes/attempts";
import { HttpError, type AppUser } from "./lib/access";

// Exercise the real route handlers, authorization and PostgreSQL transactions.
// No test-only authentication bypass is added to the running application.
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
    throw error;
  }
  return { status, data };
}

test("incident review isolates evidence and users, serializes retries, and never alters grades", async () => {
  const prefix = `incident-test-${randomUUID()}`;
  const ids = ["candidate", "other", "owner", "outsider", "admin"].map(s => `${prefix}-${s}`);
  const examId = `${prefix}-exam`;
  const attemptId = `${prefix}-attempt`;
  const sandboxId = `${prefix}-sandbox`;
  const path = "/attempts/:id/incident-review";
  try {
    const people = await db.insert(users).values(ids.map((id, i) => ({
      id, email: `${id}@example.invalid`, name: `Test ${i}`,
      role: ["candidate", "candidate", "examiner", "examiner", "admin"][i]!,
    }))).returning();
    const [candidate, other, owner, outsider, admin] = ids.map(id => people.find(p => p.id === id)!);
    const now = Date.now();
    await db.insert(exams).values({
      id: examId, ownerId: owner!.id, title: "Incident isolation fixture", instructions: "Test",
      duration: 30, startsAt: new Date(now - 60_000), endsAt: new Date(now + 3_600_000),
      status: "ongoing", resultsPublished: false,
    });
    await db.insert(attempts).values([attemptId, sandboxId].map(id => ({
      id, examId, userId: candidate!.id, sandbox: id === sandboxId,
      totalMarks: 1, questions: [{
        id: "q1", text: "Test", type: "written" as const, category: "Test", difficulty: "easy" as const,
        marks: 1, options: [], correctAnswers: [],
      }], deadline: new Date(now + 1_800_000),
    })));
    const get = (user: AppUser) => call(reviewRouter, "get", path, attemptId, user);
    const put = (user: AppUser, statement = "My connection failed during the examination.") =>
      call(reviewRouter, "put", path, attemptId, user, { statement });
    const decision = { reason: "Reviewed the server receipts and candidate explanation.", disposition: "supervised_resit_recommended" };
    const post = (user: AppUser, data = decision) => call(reviewRouter, "post", path, attemptId, user, data);

    assert.equal((await get(other!)).status, 403);
    assert.equal((await get(outsider!)).status, 403);
    assert.equal((await put(other!)).status, 403);
    assert.equal((await put(owner!)).status, 403);
    assert.equal((await post(candidate!)).status, 403);
    assert.equal((await post(outsider!)).status, 403);
    assert.equal((await post(owner!)).status, 409);
    assert.equal((await call(reviewRouter, "put", path, sandboxId, candidate!, { statement: "A sandbox statement is not allowed." })).status, 400);
    assert.equal((await get(candidate!)).data.case, null);

    const answerPath = "/attempts/:id/answers";
    const batch = { operationId: `${prefix}-save`, answers: [{ questionId: "q1", value: "Accepted answer", revision: 5, markedForReview: false }] };
    assert.equal((await call(attemptRouter, "put", answerPath, attemptId, candidate!, batch)).data.accepted, true);
    // Stale but identical value is accepted without regressing the stored revision.
    assert.equal((await call(attemptRouter, "put", answerPath, attemptId, candidate!, {
      operationId: `${prefix}-stale`, answers: [{ ...batch.answers[0], revision: 3 }],
    })).data.accepted, true);
    await db.insert(saveOperations).values({ id: `${prefix}-historical`, attemptId, operationId: "historical-without-revisions" });
    await db.insert(incidents).values({ id: `${prefix}-event`, attemptId, type: "offline", detail: "Browser claims outage at 1900-01-01 (unverified)" });
    const submissions = await Promise.all([put(candidate!), put(candidate!)]);
    assert.deepEqual(submissions.map(s => s.status), [200, 200]);
    assert.equal(submissions[0]!.data.id, submissions[1]!.data.id);
    assert.equal((await put(candidate!, "A different statement must never replace the original.")).status, 409);

    // Lock grades, then review: the review may record context but no remedy can
    // mutate a published result or promote a late local answer.
    await db.update(exams).set({ resultsPublished: true }).where(eq(exams.id, examId));
    await db.update(attempts).set({ status: "graded", score: 1, deadline: new Date(now - 1000) }).where(eq(attempts.id, attemptId));
    const [before] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    const competing = await Promise.all([
      post(owner!), post(admin!, { reason: "A competing decision from a different reviewer.", disposition: "no_action" }),
    ]);
    assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
    const winner = competing[0]!.status === 200 ? owner! : admin!;
    const winnerDecision = winner.id === owner!.id ? decision : { reason: "A competing decision from a different reviewer.", disposition: "no_action" };
    assert.equal((await post(winner, winnerDecision)).status, 200);
    assert.equal((await post(winner, { ...winnerDecision, reason: "Changed final decision is not allowed." })).status, 409);
    const dossier = (await get(candidate!)).data;
    assert.equal(dossier.case.reviewerName, winner.name);
    assert.ok(dossier.case.reviewedAt);
    assert.equal(dossier.case.reason, winnerDecision.reason);
    assert.equal(dossier.resultsPublished, true);
    assert.equal(dossier.browserEvents.length, 1);
    assert.match(dossier.browserEvents[0].detail, /unverified/);
    assert.ok(dossier.browserEvents[0].receivedAt);
    assert.deepEqual(dossier.serverSaves.find((s: any) => s.operationId === `${prefix}-stale`).revisions, [{ questionId: "q1", revision: 5 }]);
    assert.equal(dossier.serverSaves.find((s: any) => s.operationId === "historical-without-revisions").revisions, null);
    assert.ok(!JSON.stringify(dossier).includes("Accepted answer"));
    assert.ok(!JSON.stringify(dossier).includes(candidate!.email));
    assert.equal((await call(attemptRouter, "put", answerPath, attemptId, candidate!, { ...batch, operationId: `${prefix}-late`, answers: [{ ...batch.answers[0], value: "Late unverified answer", revision: 10 }] })).status, 409);
    assert.equal((await call(attemptRouter, "post", "/attempts/:id/grade", attemptId, owner!, { grades: [{ questionId: "q1", score: 0, feedback: "Change" }] })).status, 409);
    const [after] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    assert.deepEqual(after, before);
    assert.equal((await db.select().from(incidentCases).where(eq(incidentCases.attemptId, attemptId))).length, 1);
  } finally {
    await db.delete(attempts).where(inArray(attempts.id, [attemptId, sandboxId]));
    await db.delete(exams).where(eq(exams.id, examId));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
