import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, attempts, authorshipReviews, eq, and, asc } from "@workspace/db";
import {
  GetIntegrityRecordResponse, SaveDisclosureBody, RequestAuthorshipReviewBody,
  RespondToAuthorshipBody, DecideAuthorshipBody, RequestAuthorshipReviewResponse,
} from "@workspace/api-zod";
import { authorizedAttempt, databaseNow, finalizeIfExpired, finalizeLocked } from "../lib/attempts";
import { HttpError, paramId, requireStaff, type AppUser } from "../lib/access";

const router: IRouter = Router();
type Review = typeof authorshipReviews.$inferSelect;
const view = (r: Review) => ({
  id: r.id, attemptId: r.attemptId, questionId: r.questionId, prompt: r.prompt,
  requestedAt: r.requestedAt.toISOString(), responseDeadline: r.responseDeadline.toISOString(),
  response: r.response, respondedAt: r.respondedAt?.toISOString() ?? null,
  outcome: r.outcome, reason: r.reason, reviewedAt: r.reviewedAt?.toISOString() ?? null,
});

async function record(id: string, user: AppUser) {
  const a = await authorizedAttempt(id, user);
  const reviews = await db.select().from(authorshipReviews).where(eq(authorshipReviews.attemptId, id)).orderBy(asc(authorshipReviews.requestedAt));
  return GetIntegrityRecordResponse.parse({
    attemptId: id, policy: a.policySnapshot, acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    disclosure: a.disclosure, reviews: reviews.map(view), serverNow: new Date().toISOString(),
    attemptStatus: a.status, sandbox: a.sandbox,
  });
}
async function authorizedReview(id: string, user: AppUser) {
  const [r] = await db.select().from(authorshipReviews).where(eq(authorshipReviews.id, id));
  if (!r) throw new HttpError(404, "Review not found.");
  const a = await authorizedAttempt(r.attemptId, user);
  return { r, a };
}
const trimmed = (input: unknown, field: string) => {
  if (!input || typeof input !== "object") return input;
  const body = input as Record<string, unknown>;
  return { ...body, [field]: typeof body[field] === "string" ? body[field].trim() : body[field] };
};

router.get("/attempts/:id/integrity", async (req, res): Promise<void> => {
  res.json(await record(paramId(req), req.appUser));
});
router.put("/attempts/:id/integrity", async (req, res): Promise<void> => {
  const id = paramId(req);
  const a = await authorizedAttempt(id, req.appUser, true);
  if (req.appUser.role !== "candidate" || a.sandbox) throw new HttpError(403, "Only a real candidate can record assistance used.");
  const { disclosure } = SaveDisclosureBody.parse(trimmed(req.body, "disclosure"));
  const saved = await db.transaction(async tx => {
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, id)).for("update");
    const now = await databaseNow(tx);
    if (locked!.status !== "active" || now >= locked!.deadline) {
      if (locked!.status === "active") await finalizeLocked(tx, locked!);
      return false;
    }
    await tx.update(attempts).set({ disclosure }).where(eq(attempts.id, id));
    return true;
  });
  if (!saved) throw new HttpError(409, "Disclosure is locked with the original attempt. No extra examination time is granted.");
  res.json(await record(id, req.appUser));
});
router.post("/attempts/:id/authorship", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const id = paramId(req);
  const a = await authorizedAttempt(id, req.appUser);
  if (a.sandbox) throw new HttpError(400, "Sandbox attempts cannot receive real review requests.");
  const input = RequestAuthorshipReviewBody.parse(trimmed(req.body, "prompt"));
  if (!a.questions.some(q => q.id === input.questionId)) throw new HttpError(400, "The question is not assigned to this attempt.");
  await finalizeIfExpired(id);
  const row = await db.transaction(async tx => {
    const [locked] = await tx.select().from(attempts).where(eq(attempts.id, id)).for("update");
    if (locked!.status === "active") throw new HttpError(409, "Wait until the original examination attempt is submitted.");
    const [existing] = await tx.select().from(authorshipReviews).where(and(eq(authorshipReviews.attemptId, id), eq(authorshipReviews.questionId, input.questionId)));
    if (existing) {
      if (existing.requestedBy === req.appUser.id && existing.prompt === input.prompt) return existing;
      throw new HttpError(409, "A review for this question is already on record.");
    }
    const now = await databaseNow(tx);
    const [r] = await tx.insert(authorshipReviews).values({
      id: randomUUID(), attemptId: id, questionId: input.questionId, prompt: input.prompt,
      requestedBy: req.appUser.id, requestedAt: now, responseDeadline: new Date(now.getTime() + input.hours * 3600000),
    }).returning();
    return r!;
  });
  res.status(201).json(RequestAuthorshipReviewResponse.parse(view(row)));
});
router.put("/authorship-reviews/:id/response", async (req, res): Promise<void> => {
  const id = paramId(req);
  const { a } = await authorizedReview(id, req.appUser);
  if (req.appUser.role !== "candidate" || a.userId !== req.appUser.id) throw new HttpError(403, "Only the candidate can respond.");
  const { response } = RespondToAuthorshipBody.parse(trimmed(req.body, "response"));
  const row = await db.transaction(async tx => {
    const [r] = await tx.select().from(authorshipReviews).where(eq(authorshipReviews.id, id)).for("update");
    if (r!.response !== null) {
      if (r!.response === response) return r!;
      throw new HttpError(409, "Your explanation is already recorded and cannot be replaced.");
    }
    const now = await databaseNow(tx);
    if (r!.reviewedAt || now >= r!.responseDeadline) throw new HttpError(409, "The separate explanation window has closed.");
    const [updated] = await tx.update(authorshipReviews).set({ response, respondedAt: now }).where(eq(authorshipReviews.id, id)).returning();
    return updated!;
  });
  res.json(RequestAuthorshipReviewResponse.parse(view(row)));
});
router.post("/authorship-reviews/:id/decision", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const id = paramId(req);
  await authorizedReview(id, req.appUser);
  const { outcome, reason } = DecideAuthorshipBody.parse(trimmed(req.body, "reason"));
  const row = await db.transaction(async tx => {
    const [r] = await tx.select().from(authorshipReviews).where(eq(authorshipReviews.id, id)).for("update");
    if (r!.reviewedAt) {
      if (r!.reviewedBy === req.appUser.id && r!.outcome === outcome && r!.reason === reason) return r!;
      throw new HttpError(409, "An immutable review outcome is already on record.");
    }
    const now = await databaseNow(tx);
    if (r!.response === null && now < r!.responseDeadline) throw new HttpError(409, "Allow the candidate's explanation window to finish first.");
    const [updated] = await tx.update(authorshipReviews).set({ outcome, reason, reviewedBy: req.appUser.id, reviewedAt: now }).where(eq(authorshipReviews.id, id)).returning();
    return updated!;
  });
  // Advisory only: original answers, deadlines and published grades are untouched.
  res.json(RequestAuthorshipReviewResponse.parse(view(row)));
});
export default router;
