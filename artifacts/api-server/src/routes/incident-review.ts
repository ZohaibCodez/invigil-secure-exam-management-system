import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, attempts, exams, incidents, saveOperations, incidentCases, eq, asc, type IncidentCaseRow } from "@workspace/db";
import {
  GetIncidentDossierParams, GetIncidentDossierResponse,
  SubmitIncidentStatementBody, SubmitIncidentStatementResponse,
  ReviewIncidentBody, ReviewIncidentResponse,
} from "@workspace/api-zod";
import { authorizedAttempt, databaseNow } from "../lib/attempts";
import { HttpError, requireStaff } from "../lib/access";

const router: IRouter = Router();
const caseView = (row: IncidentCaseRow) => ({
  id: row.id, statement: row.statement, submittedAt: row.submittedAt.toISOString(),
  reviewerName: row.reviewerName, reviewedAt: row.reviewedAt?.toISOString() ?? null,
  reason: row.reason, disposition: row.disposition,
});

router.get("/attempts/:id/incident-review", async (req, res): Promise<void> => {
  const { id } = GetIncidentDossierParams.parse(req.params);
  const a = await authorizedAttempt(id, req.appUser);
  const [[exam], [incidentCase], saves, events] = await Promise.all([
    db.select({ resultsPublished: exams.resultsPublished }).from(exams).where(eq(exams.id, a.examId)),
    db.select().from(incidentCases).where(eq(incidentCases.attemptId, id)),
    db.select().from(saveOperations).where(eq(saveOperations.attemptId, id)).orderBy(asc(saveOperations.savedAt)),
    db.select().from(incidents).where(eq(incidents.attemptId, id)).orderBy(asc(incidents.createdAt)),
  ]);
  res.json(GetIncidentDossierResponse.parse({
    attemptId: id, deadline: a.deadline.toISOString(), resultsPublished: exam!.resultsPublished,
    case: incidentCase ? caseView(incidentCase) : null,
    serverSaves: saves.map(s => ({ operationId: s.operationId, savedAt: s.savedAt.toISOString(), revisions: s.revisions })),
    browserEvents: events.map(e => ({ id: e.id, type: e.type, detail: e.detail, receivedAt: e.createdAt.toISOString() })),
  }));
});

router.put("/attempts/:id/incident-review", async (req, res): Promise<void> => {
  const { id } = GetIncidentDossierParams.parse(req.params);
  if (req.appUser.role !== "candidate") throw new HttpError(403, "Only the candidate may submit their statement.");
  const a = await authorizedAttempt(id, req.appUser, true);
  if (a.sandbox) throw new HttpError(400, "Sandbox attempts do not enter incident review.");
  const { statement } = SubmitIncidentStatementBody.parse({ ...req.body, statement: typeof req.body?.statement === "string" ? req.body.statement.trim() : req.body?.statement });
  const row = await db.transaction(async tx => {
    // The attempt lock serializes retries and decisions, including concurrent
    // requests from different tabs; the unique index is a second safeguard.
    await tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.id, id)).for("update");
    const [previous] = await tx.select().from(incidentCases).where(eq(incidentCases.attemptId, id));
    if (previous) {
      if (previous.statement !== statement) throw new HttpError(409, "A statement is already on record. It cannot be replaced.");
      return previous;
    }
    const [created] = await tx.insert(incidentCases).values({
      id: randomUUID(), attemptId: id, statement, submittedAt: await databaseNow(tx),
    }).returning();
    return created!;
  });
  res.json(SubmitIncidentStatementResponse.parse(caseView(row)));
});

router.post("/attempts/:id/incident-review", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const { id } = GetIncidentDossierParams.parse(req.params);
  const a = await authorizedAttempt(id, req.appUser);
  if (a.sandbox) throw new HttpError(400, "Sandbox attempts do not enter incident review.");
  const { reason, disposition } = ReviewIncidentBody.parse({ ...req.body, reason: typeof req.body?.reason === "string" ? req.body.reason.trim() : req.body?.reason });
  const row = await db.transaction(async tx => {
    await tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.id, id)).for("update");
    const [previous] = await tx.select().from(incidentCases).where(eq(incidentCases.attemptId, id));
    if (!previous) throw new HttpError(409, "The candidate has not submitted a statement.");
    if (previous.reviewedAt) {
      if (previous.reviewerId !== req.appUser.id || previous.reason !== reason || previous.disposition !== disposition) {
        throw new HttpError(409, "A final decision is already on record. Refresh to see it.");
      }
      return previous;
    }
    // Advisory dispositions only. Never alter answers, deadlines, marks, grade
    // publication, or enrollment here, even when a resit is recommended.
    const [updated] = await tx.update(incidentCases).set({
      reviewerId: req.appUser.id, reviewerName: req.appUser.name,
      reviewedAt: await databaseNow(tx), reason, disposition,
    }).where(eq(incidentCases.id, previous.id)).returning();
    return updated!;
  });
  res.json(ReviewIncidentResponse.parse(caseView(row)));
});

export default router;
