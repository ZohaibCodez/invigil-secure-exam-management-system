import { Router, type IRouter } from "express";
import { and, eq } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { db, attempts, exams, saveOperations, incidents, type AnswerData } from "@workspace/db";
import { SaveAnswersBody, RecordEventBody, GradeAttemptBody, GetAttemptResponse } from "@workspace/api-zod";
import { paramId, HttpError, requireStaff } from "../lib/access";
import { authorizedAttempt, finalizeIfExpired, attemptView, databaseNow, finalizeLocked, validateAnswer } from "../lib/attempts";

const router: IRouter = Router();
router.get("/attempts/:id", async (req, res): Promise<void> => {
  const a = await authorizedAttempt(paramId(req), req.appUser);
  res.json(GetAttemptResponse.parse(await attemptView(await finalizeIfExpired(a.id), req.appUser)));
});
router.put("/attempts/:id/answers", async (req, res): Promise<void> => {
  const a = await authorizedAttempt(paramId(req), req.appUser, true);
  const input = SaveAnswersBody.parse(req.body);
  if (new Set(input.answers.map(a => a.questionId)).size !== input.answers.length) throw new HttpError(400, "Duplicate answers in a save batch.");
  const receipt = await db.transaction(async tx => {
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).for("update");
    const [previous] = await tx.select().from(saveOperations).where(and(eq(saveOperations.attemptId, a.id), eq(saveOperations.operationId, input.operationId)));
    const now = await databaseNow(tx);
    if (previous) return { savedAt: previous.savedAt.toISOString(), accepted: true, serverNow: now.toISOString() };
    if (locked!.status !== "active" || now >= locked!.deadline) {
      if (locked!.status === "active") await finalizeLocked(tx, locked!);
      // Return rather than throw, so expiry finalization is committed.
      return null;
    }
    const answers = [...locked!.answers];
    for (const incoming of input.answers) {
      const q = locked!.questions.find(q => q.id === incoming.questionId);
      if (!q) throw new HttpError(400, "This question is not assigned to the attempt.");
      validateAnswer(incoming.value, q);
      if (!Number.isSafeInteger(incoming.revision)) throw new HttpError(400, "Invalid answer revision.");
      const index = answers.findIndex(ans => ans.questionId === incoming.questionId);
      const old = answers[index];
      if (old && incoming.revision <= old.revision) {
        if (incoming.value !== old.value || incoming.markedForReview !== old.markedForReview) throw new HttpError(409, "A newer answer exists. Refresh the attempt before making more changes.");
        continue;
      }
      const accepted: AnswerData = { questionId: incoming.questionId, value: incoming.value, markedForReview: incoming.markedForReview, revision: incoming.revision, score: null, feedback: null };
      if (index < 0) answers.push(accepted); else answers[index] = accepted;
    }
    await tx.update(attempts).set({ answers, lastSavedAt: now, ...(input.scratchpad !== undefined ? { scratchpad: input.scratchpad } : {}) }).where(eq(attempts.id, a.id));
    await tx.insert(saveOperations).values({ id: randomUUID(), attemptId: a.id, operationId: input.operationId, savedAt: now });
    return { savedAt: now.toISOString(), accepted: true, serverNow: now.toISOString() };
  });
  if (!receipt) { res.status(409).json({ error: "The attempt is closed. Only answers confirmed by the server before the deadline count." }); return; }
  res.json(receipt);
});
router.post("/attempts/:id/submit", async (req, res): Promise<void> => {
  const a = await authorizedAttempt(paramId(req), req.appUser, true);
  const result = await db.transaction(async tx => {
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).for("update");
    return finalizeLocked(tx, locked!);
  });
  res.json(await attemptView(result, req.appUser));
});
router.post("/attempts/:id/events", async (req, res): Promise<void> => {
  const a = await authorizedAttempt(paramId(req), req.appUser, true);
  const data = RecordEventBody.parse(req.body);
  // Bound monitoring volume per attempt; events are context, not a verdict.
  const existing = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.attemptId, a.id)).limit(301);
  if (existing.length >= 300) { res.status(429).json({ error: "Incident limit reached for this attempt." }); return; }
  await db.insert(incidents).values({ id: randomUUID(), attemptId: a.id, ...data });
  res.status(201).json({ message: "Incident recorded for contextual review; not proof of misconduct." });
});
router.post("/attempts/:id/grade", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const a = await authorizedAttempt(paramId(req), req.appUser);
  if (a.sandbox) throw new HttpError(400, "Sandbox attempts do not enter real grading.");
  const { grades } = GradeAttemptBody.parse(req.body);
  if (new Set(grades.map(g => g.questionId)).size !== grades.length) throw new HttpError(400, "Each question may be graded only once per request.");
  const updated = await db.transaction(async tx => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, a.examId)).for("update");
    if (exam!.resultsPublished) throw new HttpError(409, "Published grades are locked to preserve report authenticity.");
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).for("update");
    let attempt = locked!;
    if (attempt.status === "active" && await databaseNow(tx) >= attempt.deadline) attempt = await finalizeLocked(tx, attempt);
    if (attempt.status === "active") throw new HttpError(409, "The candidate has not submitted yet.");
    const answers = attempt.answers.map(ans => ({ ...ans }));
    for (const grade of grades) {
      const q = attempt.questions.find(q => q.id === grade.questionId);
      if (!q || q.type !== "written") throw new HttpError(400, "Only written responses can be manually graded.");
      if (grade.score > q.marks || !Number.isFinite(grade.score)) throw new HttpError(400, `Marks must be between 0 and ${q.marks}.`);
      const answer = answers.find(a => a.questionId === q.id)!;
      answer.score = grade.score;
      answer.feedback = grade.feedback;
    }
    const complete = answers.every(a => a.score !== null);
    const [row] = await tx.update(attempts).set({
      answers, status: complete ? "graded" : "submitted",
      score: complete ? answers.reduce((s, a) => s + (a.score ?? 0), 0) : null,
    }).where(eq(attempts.id, a.id)).returning();
    return row!;
  });
  res.json(await attemptView(updated, req.appUser));
});
export default router;
