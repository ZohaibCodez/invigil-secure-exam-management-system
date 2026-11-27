import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "@workspace/db";
import { db, attempts, exams, incidents, saveOperations, type AnswerData } from "@workspace/db";
import {
  RecordViolationBody, RecordViolationResponse, SuperviseAttemptBody, SuperviseAttemptResponse, SuggestAiGradesResponse,
} from "@workspace/api-zod";
import { paramId, HttpError, requireStaff, audit } from "../lib/access";
import {
  authorizedAttempt, attemptView, databaseNow, finalizeIfExpired, finalizeLocked, hasAnswer, supervisionView,
} from "../lib/attempts";
import { settingsFor } from "../lib/delivery";
import { aiGradingConfigured, suggestGrade, mapLimited } from "../lib/ai-grading";

const router: IRouter = Router();

const VIOLATION_LABEL = {
  "fullscreen-exit": "Left fullscreen",
  "tab-hidden": "Switched away from the examination tab",
  "window-blur": "Examination window lost focus",
} as const;

// Candidate's browser reports a supervision violation. Strikes lock the attempt for a
// human decision; nothing here changes the score (problem statement 3.6).
router.post("/attempts/:id/violations", async (req, res): Promise<void> => {
  const a = await authorizedAttempt(paramId(req), req.appUser, true);
  const input = RecordViolationBody.parse(req.body);
  const row = await db.transaction(async tx => {
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).for("update");
    const now = await databaseNow(tx);
    if (locked!.status !== "active") return locked!;
    if (now >= locked!.deadline) return finalizeLocked(tx, locked!);
    const settings = settingsFor(locked!.deliverySettings);
    if (!settings.requireFullscreen || locked!.lockedAt) return locked!;
    // Retried reports carry the same operation id and are counted once.
    const operationId = `violation:${input.operationId}`;
    const [seen] = await tx.select({ id: saveOperations.id }).from(saveOperations)
      .where(and(eq(saveOperations.attemptId, a.id), eq(saveOperations.operationId, operationId)));
    if (seen) return locked!;
    const count = locked!.violationCount + 1;
    // Sandbox previews show the strike counter but never lock the examiner out.
    const lock = !locked!.sandbox && count >= settings.maxViolations;
    await tx.insert(saveOperations).values({ id: randomUUID(), attemptId: a.id, operationId, savedAt: now });
    await tx.insert(incidents).values({
      id: randomUUID(), attemptId: a.id, type: "violation",
      detail: `${VIOLATION_LABEL[input.type]} (violation ${count} of ${settings.maxViolations})` +
        (lock ? ". Attempt locked for examiner review." : ".") + " Context for review, not proof of misconduct.",
    });
    const [updated] = await tx.update(attempts).set({
      violationCount: count,
      ...(lock ? { lockedAt: now, lockReason: `Automatic: reached ${count} supervision violations` } : {}),
    }).where(eq(attempts.id, a.id)).returning();
    return updated!;
  });
  res.json(RecordViolationResponse.parse(supervisionView(row)));
});

const ACTION_LABEL = { lock: "Attempt locked", resume: "Attempt resumed", void: "Attempt voided", retake: "Retake authorized" } as const;

// Examiner or administrator decision on a supervised attempt. Every decision needs a reason
// and is recorded in the attempt's incident log and the exam activity feed.
router.post("/attempts/:id/supervision", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const a = await authorizedAttempt(paramId(req), req.appUser);
  if (a.sandbox) throw new HttpError(400, "Sandbox previews are not supervised.");
  const { action, reason } = SuperviseAttemptBody.parse(req.body);
  const actor = req.appUser.name;
  const result = await db.transaction(async tx => {
    // Same lock order as grading: exam first, then attempt.
    const [exam] = await tx.select().from(exams).where(eq(exams.id, a.examId)).for("update");
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).for("update");
    const now = await databaseNow(tx);
    let attempt = locked!;
    if (attempt.supersededAt) throw new HttpError(409, "This attempt was already replaced by a retake.");
    if (attempt.status === "active" && now >= attempt.deadline) attempt = await finalizeLocked(tx, attempt);
    let changes: Partial<typeof attempts.$inferInsert>;
    if (action === "lock") {
      if (attempt.status !== "active") throw new HttpError(409, "Only an attempt in progress can be locked.");
      if (attempt.lockedAt) throw new HttpError(409, "This attempt is already locked.");
      changes = { lockedAt: now, lockReason: `Locked by ${actor}: ${reason}` };
    } else if (action === "resume") {
      if (attempt.status !== "active") throw new HttpError(409, "This attempt has already ended. Void it or authorize a retake instead.");
      if (!attempt.lockedAt) throw new HttpError(409, "This attempt is not locked.");
      // The deadline is unchanged: time spent locked is not given back automatically.
      changes = { lockedAt: null, lockReason: null, violationCount: 0 };
    } else {
      if (exam!.resultsPublished) throw new HttpError(409, "Results are published and locked. This decision is no longer possible.");
      if (action === "void") {
        if (attempt.voidedAt) throw new HttpError(409, "This attempt is already voided.");
        const answers: AnswerData[] = attempt.questions.map(q => {
          const prev = attempt.answers.find(ans => ans.questionId === q.id);
          return {
            questionId: q.id, value: prev?.value ?? "", markedForReview: prev?.markedForReview ?? false,
            revision: prev?.revision ?? 0, lockedAt: prev?.lockedAt ?? null, aiSuggestion: prev?.aiSuggestion ?? null,
            score: 0, feedback: `Attempt voided: ${reason}`,
          };
        });
        changes = {
          status: "graded", answers, score: 0, lockedAt: null,
          submittedAt: attempt.submittedAt ?? (now > attempt.deadline ? attempt.deadline : now),
          voidedAt: now, voidReason: `${actor}: ${reason}`,
        };
      } else {
        if (exam!.status === "completed" || now >= exam!.endsAt)
          throw new HttpError(409, "The examination window has closed, so a retake cannot start. Extend a new examination instead.");
        // Keep the old attempt's accepted answers on record, then archive it.
        if (attempt.status === "active") attempt = await finalizeLocked(tx, attempt);
        changes = { supersededAt: now, lockedAt: null };
      }
    }
    await tx.insert(incidents).values({ id: randomUUID(), attemptId: a.id, type: "supervision", detail: `${ACTION_LABEL[action]} by ${actor}: ${reason}` });
    const [row] = await tx.update(attempts).set(changes).where(eq(attempts.id, a.id)).returning();
    return { row: row!, exam: exam! };
  });
  await audit(result.exam.ownerId, ACTION_LABEL[action], `${result.exam.title}: ${reason}`, "exam", result.exam.id);
  res.json(SuperviseAttemptResponse.parse(await attemptView(result.row, req.appUser)));
});

// Advisory AI grading for written answers. Suggestions are stored for the examiner,
// who must still save (approve) every grade. Nothing is counted automatically.
router.post("/attempts/:id/ai-grade", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const a = await authorizedAttempt(paramId(req), req.appUser);
  if (a.sandbox) throw new HttpError(400, "Sandbox attempts do not enter real grading.");
  if (!aiGradingConfigured()) throw new HttpError(503, "AI grading is not configured on this server. Grade manually, or set GROQ_API_KEY.");
  const attempt = await finalizeIfExpired(a.id);
  if (attempt.status === "active") throw new HttpError(409, "The candidate has not submitted yet.");
  if (attempt.voidedAt) throw new HttpError(409, "Voided attempts are not graded.");
  // At most 4 answers per request keeps each call well inside the 30 s serverless limit
  // (about 6 s per answer, two at a time). The grading dialog asks again for the rest.
  const pending = attempt.questions.filter(q => {
    const ans = attempt.answers.find(x => x.questionId === q.id);
    return q.type === "written" && ans && ans.score === null && !ans.aiSuggestion && hasAnswer(q, ans.value);
  }).slice(0, 4);
  // Two at a time keeps free-tier bursts under Groq's rate limit; suggestGrade also retries 429s.
  const settled = await mapLimited(pending, 2, async q =>
    [q.id, await suggestGrade(q, attempt.answers.find(x => x.questionId === q.id)!.value)] as const);
  const suggestions = new Map(settled.flatMap(s => s.status === "fulfilled" ? [s.value] : []));
  const failures = settled.filter(s => s.status === "rejected").length;
  if (pending.length && !suggestions.size) {
    const reasons = settled.flatMap(s => s.status === "rejected" ? [String((s.reason as Error)?.message ?? s.reason)] : []);
    req.log.warn({ failures, reasons }, "AI grading unavailable");
    throw new HttpError(502, "The AI grading service did not respond. Grade manually or try again.");
  }
  const updated = await db.transaction(async tx => {
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).for("update");
    // Only fill answers that are still ungraded; an examiner's grade always wins.
    const answers = locked!.answers.map(ans =>
      ans.score === null && suggestions.has(ans.questionId) ? { ...ans, aiSuggestion: suggestions.get(ans.questionId)! } : ans);
    const [row] = await tx.update(attempts).set({ answers }).where(eq(attempts.id, a.id)).returning();
    return row!;
  });
  res.json(SuggestAiGradesResponse.parse(await attemptView(updated, req.appUser)));
});

export default router;
