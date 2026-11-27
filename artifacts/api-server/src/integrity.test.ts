import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import type { Request, Response } from "express";
import { ZodError } from "zod/v4";
import {
  db, pool, users, exams, attempts, questions, enrollments, activities, authorshipReviews,
  eq, inArray, type QuestionData,
} from "@workspace/db";
import examRouter from "./routes/exams";
import attemptRouter from "./routes/attempts";
import integrityRouter from "./routes/integrity";
import incidentRouter from "./routes/incident-review";
import { HttpError, type AppUser } from "./lib/access";

type TestRouter = { stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (req: Request, res: Response) => Promise<void> }[] } }[] };
async function call(router: unknown, method: string, path: string, id: string, appUser: AppUser, body: unknown = {}) {
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

test("integrated policies, disclosure, authorship and incident review preserve examination records", async () => {
  const prefix = `integrity-${randomUUID()}`;
  const ids = ["owner", "outsider", "candidate", "other", "admin"].map(s => `${prefix}-${s}`);
  const examIds = ["main", "legacy", "expiry"].map(s => `${prefix}-${s}`);
  const qid = `${prefix}-question`;
  const question: QuestionData = {
    id: qid, text: "Which is an even number?", type: "single", category: "Numbers", difficulty: "easy",
    marks: 2, options: [{ id: "a", text: "Two" }, { id: "b", text: "Three" }], correctAnswers: ["a"],
  };
  const integrityPath = "/attempts/:id/integrity", requestPath = "/attempts/:id/authorship";
  const responsePath = "/authorship-reviews/:id/response", decisionPath = "/authorship-reviews/:id/decision";
  const incidentPath = "/attempts/:id/incident-review", savePath = "/attempts/:id/answers";
  try {
    const people = await db.insert(users).values(ids.map((id, i) => ({
      id, email: `${id}@example.invalid`, name: `Integrity fixture ${i}`,
      role: ["examiner", "examiner", "candidate", "candidate", "admin"][i]!,
    }))).returning();
    const [owner, outsider, candidate, other, admin] = ids.map(id => people.find(p => p.id === id)!);
    await db.insert(questions).values({ id: qid, ownerId: owner!.id, data: question });
    const input = {
      title: "Integrity fixture", subject: "Numbers", instructions: "Answer, then disclose any assistance.",
      duration: 1, startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 600_000).toISOString(),
      questionIds: [qid], randomize: false, passPercent: 50,
      assistancePolicy: { mode: "ai_disclosed", resources: "AI may explain concepts; disclose tools used.", requireDisclosure: false },
    };
    const update = (data: unknown) => call(examRouter, "patch", "/exams/:id", examIds[0]!, owner!, data);
    await db.insert(exams).values(examIds.slice(0, 2).map(id => ({
      id, ownerId: owner!.id, title: "Integrity fixture", instructions: "Test", duration: 1,
      startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), questionSnapshot: [question], totalMarks: 2,
    })));
    await db.insert(enrollments).values(examIds.slice(0, 2).flatMap(examId => [candidate!, other!].map(u => ({ examId, userId: u.id }))));
    assert.equal((await update(input)).status, 400, "AI with disclosure cannot disable disclosure");
    const conditional = await update({ ...input, assistancePolicy: { ...input.assistancePolicy, mode: "ai_conditional" } });
    assert.equal(conditional.status, 200);
    const conditionalVersion = conditional.data.assistancePolicy.version;
    const configured = await update({ ...input, assistancePolicy: { ...input.assistancePolicy, requireDisclosure: true } });
    assert.equal(configured.status, 200);
    const policy = configured.data.assistancePolicy;
    assert.notEqual(policy.version, conditionalVersion);
    const repeated = await update({ ...input, assistancePolicy: { ...input.assistancePolicy, requireDisclosure: true } });
    assert.equal(repeated.data.assistancePolicy.version, policy.version);
    const start = (u: AppUser, body: object = {}, examId = examIds[0]!) => call(examRouter, "post", "/exams/:id/start", examId, u, body);
    const sandbox = await start(owner!, { sandbox: true, policyAcknowledged: true, policyVersion: policy.version });
    const [sandboxRow] = await db.select().from(attempts).where(eq(attempts.id, sandbox.data.id));
    assert.equal(sandboxRow!.acknowledgedAt, null);
    assert.equal((await start(candidate!, { sandbox: true })).status, 403);
    assert.equal((await call(examRouter, "post", "/exams/:id/action", examIds[0]!, owner!, { action: "publish" })).status, 200);
    assert.equal((await update(input)).status, 409);
    assert.equal((await start(candidate!)).status, 400);
    assert.equal((await start(candidate!, { policyVersion: policy.version })).status, 400);
    assert.equal((await start(candidate!, { policyAcknowledged: true, policyVersion: conditionalVersion })).status, 400);
    const starts = await Promise.all([start(candidate!, { policyAcknowledged: true, policyVersion: policy.version }), start(candidate!, { policyAcknowledged: true, policyVersion: policy.version })]);
    assert.equal(starts[0].data.id, starts[1].data.id);
    const aid = starts[0].data.id;
    const [initial] = await db.select().from(attempts).where(eq(attempts.id, aid));
    assert.deepEqual(initial!.policySnapshot, policy);
    assert.ok(initial!.acknowledgedAt);
    assert.deepEqual(starts[0].data.questions[0].correctAnswers, []);
    assert.equal((await start(candidate!)).data.id, aid, "resume does not invent a new attestation");
    assert.equal((await call(integrityRouter, "get", integrityPath, aid, other!)).status, 403);
    assert.equal((await call(integrityRouter, "get", integrityPath, aid, outsider!)).status, 403);
    const get = () => call(integrityRouter, "get", integrityPath, aid, candidate!);
    assert.equal((await get()).data.disclosureStatus, "pending");
    const disclose = (disclosure: string, version = 0, u = candidate!) => call(integrityRouter, "put", integrityPath, aid, u, { disclosure, version });
    assert.equal((await disclose("Not my work.", 0, owner!)).status, 403);
    const disclosures = await Promise.all([disclose("Used a calculator, no AI."), disclose("Used a calculator, no AI.")]);
    assert.deepEqual(disclosures.map(r => r.status), [200, 200]);
    assert.equal(disclosures[0].data.disclosureVersion, 1);
    assert.equal((await disclose("A competing disclosure.", 0)).status, 409);
    assert.equal((await get()).data.disclosureStatus, "provided");

    const batch = { operationId: `${prefix}-save`, answers: [{ questionId: qid, value: '["a"]', revision: 1, markedForReview: false }], scratchpad: "rough notes", scratchpadVersion: 0 };
    const save = (body: object) => call(attemptRouter, "put", savePath, aid, candidate!, body);
    const saves = await Promise.all([save(batch), save(batch)]);
    assert.ok(saves.every(r => r.data.accepted));
    assert.equal((await save({ ...batch, scratchpad: "different" })).data.conflict, "operation");
    assert.equal((await save({ ...batch, operationId: `${prefix}-conflict` })).data.conflict, "scratchpad");
    assert.equal((await save({ operationId: `${prefix}-answer-conflict`, answers: [{ ...batch.answers[0], value: '["b"]' }] })).data.conflict, "answer");
    const prompt = { questionId: qid, prompt: "Explain why your selected number is even.", hours: 1 };
    const request = (body = prompt, u = owner!) => call(integrityRouter, "post", requestPath, aid, u, body);
    assert.equal((await request()).status, 409);
    await call(attemptRouter, "post", "/attempts/:id/submit", aid, candidate!);
    await call(examRouter, "post", "/exams/:id/action", examIds[0]!, owner!, { action: "complete" });
    await call(examRouter, "post", "/exams/:id/action", examIds[0]!, owner!, { action: "publish-results" });
    const [before] = await db.select().from(attempts).where(eq(attempts.id, aid));
    assert.equal(before!.score, 2);
    assert.equal((await disclose("Late disclosure.", 1)).status, 409);
    assert.equal((await request(prompt, outsider!)).status, 403);
    const requests = await Promise.all([request(), request()]);
    assert.deepEqual(requests.map(r => r.status), [201, 201]);
    const review = requests[0].data;
    assert.equal(review.id, requests[1].data.id);
    assert.equal(review.requesterName, owner!.name);
    assert.equal((await request({ ...prompt, hours: 2 })).status, 409);
    assert.equal((await request({ ...prompt, questionId: "unassigned" })).status, 400);
    const decide = (u = owner!, reason = "Explanation agrees with the original mathematical reasoning.") => call(integrityRouter, "post", decisionPath, review.id, u, { outcome: "satisfactory", reason });
    assert.equal((await decide()).status, 409, "cannot decide before response or window end");
    const respond = (response = "Two is even because dividing it by two leaves no remainder.", u = candidate!) => call(integrityRouter, "put", responsePath, review.id, u, { response });
    assert.equal((await respond(undefined, other!)).status, 403);
    assert.equal((await respond(undefined, owner!)).status, 403);
    const responses = await Promise.all([respond(), respond()]);
    assert.ok(responses.every(r => r.status === 200));
    assert.equal((await respond("Replace the original explanation with different text.")).status, 409);
    assert.equal((await decide(outsider!)).status, 403);
    assert.equal((await decide(candidate!)).status, 403);
    const decisions = await Promise.all([decide(), decide(admin!, "A competing advisory decision with a different reviewer.")]);
    assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
    const winner = decisions.find(r => r.status === 200)!;
    assert.ok(winner.data.reviewerName);
    const ownRecord = await get();
    assert.equal(ownRecord.data.reviews[0].reason, winner.data.reason);

    // Reuse the technical-incident route for technical remedies; authorship
    // outcomes do not create a second incident decision or grade adjustment.
    const statement = { statement: "My connection failed briefly but my answer was accepted." };
    const statements = await Promise.all([call(incidentRouter, "put", incidentPath, aid, candidate!, statement), call(incidentRouter, "put", incidentPath, aid, candidate!, statement)]);
    assert.equal(statements[0].data.id, statements[1].data.id);
    assert.equal((await call(incidentRouter, "get", incidentPath, aid, other!)).status, 403);
    assert.equal((await call(incidentRouter, "get", incidentPath, aid, outsider!)).status, 403);
    assert.equal((await call(incidentRouter, "post", incidentPath, aid, owner!, { disposition: "no_action", reason: "The server receipt confirms the accepted answer." })).status, 200);
    assert.equal((await call(incidentRouter, "put", incidentPath, aid, candidate!, { statement: "A conflicting replacement statement." })).status, 409);
    assert.equal((await save({ ...batch, operationId: `${prefix}-late` })).status, 409);
    const [after] = await db.select().from(attempts).where(eq(attempts.id, aid));
    assert.deepEqual(after, before, "reviews never alter answers, score, snapshot, acknowledgement or deadline");
    assert.equal((await call(attemptRouter, "post", "/attempts/:id/grade", aid, owner!, { grades: [] })).status, 409);

    // Historical published exam with no policy remains startable. Updating
    // new drafts never imposes a policy on this existing attempt.
    await call(examRouter, "post", "/exams/:id/action", examIds[1]!, owner!, { action: "publish" });
    const legacy = await start(candidate!, {}, examIds[1]!);
    assert.equal(legacy.status, 200);
    const legacyRecord = await call(integrityRouter, "get", integrityPath, legacy.data.id, candidate!);
    assert.equal(legacyRecord.data.policy, null);
    assert.equal(legacyRecord.data.acknowledgedAt, null);

    // Let a newly-created, short closing window expire naturally. Never
    // rewrite a stored deadline, server clock or browser timestamp.
    await db.insert(exams).values({
      id: examIds[2]!, ownerId: owner!.id, title: "Natural expiry fixture", instructions: "Test", duration: 1,
      startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 2_000), status: "published",
      questionSnapshot: [question], totalMarks: 2, assistancePolicy: policy,
    });
    await db.insert(enrollments).values({ examId: examIds[2]!, userId: other!.id });
    const expiry = await start(other!, { policyAcknowledged: true, policyVersion: policy.version }, examIds[2]!);
    assert.equal(expiry.status, 200);
    const expiredId = expiry.data.id;
    const originalDeadline = expiry.data.deadline;
    await wait(Math.max(0, Date.parse(originalDeadline) - Date.now()) + 80);
    assert.equal((await call(attemptRouter, "put", savePath, expiredId, other!, { operationId: `${prefix}-expired`, answers: [], scratchpad: "Late rough work", scratchpadVersion: 0 })).status, 409);
    const expiredRecord = await call(integrityRouter, "get", integrityPath, expiredId, other!);
    assert.equal(expiredRecord.data.disclosureStatus, "missing_required");
    assert.notEqual(expiredRecord.data.attemptStatus, "active");
    const [expiredRow] = await db.select().from(attempts).where(eq(attempts.id, expiredId));
    assert.equal(expiredRow!.deadline.toISOString(), originalDeadline);
    assert.equal(expiredRow!.scratchpad, "");
    assert.equal(expiredRow!.score, 0);
    const submitAgain = await call(attemptRouter, "post", "/attempts/:id/submit", expiredId, other!);
    assert.equal(submitAgain.data.deadline, originalDeadline);

    // Separate explanation expiry, also observed by natural elapsed time.
    const shortReviewId = `${prefix}-short-review`;
    await db.insert(authorshipReviews).values({
      id: shortReviewId, attemptId: expiredId, questionId: qid, requestedBy: owner!.id,
      prompt: "Explain the method you would use.", requestedAt: new Date(), responseDeadline: new Date(Date.now() + 150),
    });
    await wait(200);
    assert.equal((await call(integrityRouter, "put", responsePath, shortReviewId, other!, { response: "This response is outside the separate review window." })).status, 409);
    assert.equal((await call(integrityRouter, "post", decisionPath, shortReviewId, owner!, { outcome: "further_review", reason: "No response was received; refer to the existing institutional process." })).status, 200);
  } finally {
    for (const examId of examIds) {
      await db.delete(attempts).where(eq(attempts.examId, examId));
      await db.delete(activities).where(eq(activities.examId, examId));
      await db.delete(enrollments).where(eq(enrollments.examId, examId));
      await db.delete(exams).where(eq(exams.id, examId));
    }
    await db.delete(questions).where(eq(questions.id, qid));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
