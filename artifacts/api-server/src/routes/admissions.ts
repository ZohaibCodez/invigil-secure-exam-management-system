import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, desc, sql, db, admissions, exams, users, enrollments, attempts } from "@workspace/db";
import { DecideAdmissionBody } from "@workspace/api-zod";
import { ownedExam, paramId, HttpError, type AppUser } from "../lib/access";
import { databaseNow } from "../lib/attempts";
import { settingsFor, entrySubjects, entryVersion } from "../lib/delivery";
import { quotaTotals } from "../lib/blueprint";
import type { Tx } from "../lib/examination";

const router: IRouter = Router();
type AdmissionRow = typeof admissions.$inferSelect;
function available(exam: typeof exams.$inferSelect, now: Date) {
  if (exam.status === "draft" || exam.status === "completed" || now < exam.startsAt || now >= exam.endsAt)
    throw new HttpError(403, "Admission is available only while this examination is open.");
  if (!settingsFor(exam.deliverySettings).requireProctorApproval)
    throw new HttpError(409, "This examination does not require invigilator approval.");
}
async function view(row: AdmissionRow, tx: Tx) {
  const [exam] = await tx.select().from(exams).where(eq(exams.id, row.examId));
  const [candidate] = await tx.select().from(users).where(eq(users.id, row.candidateId));
  const [reviewer] = row.decidedBy ? await tx.select().from(users).where(eq(users.id, row.decidedBy)) : [];
  const now = await databaseNow(tx);
  return {
    id: row.id, examId: row.examId, examTitle: exam!.title,
    candidateId: row.candidateId, candidateName: candidate!.name,
    status: now >= row.expiresAt && (row.status === "pending" || row.status === "approved") ? "expired" : row.status,
    requestedAt: row.requestedAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null, reviewerName: reviewer?.name ?? null,
    reason: row.reason, serverNow: now.toISOString(),
  };
}
async function authorized(id: string, user: AppUser) {
  const [row] = await db.select().from(admissions).where(eq(admissions.id, id));
  if (!row) throw new HttpError(404, "Admission request not found.");
  if (user.role === "candidate") {
    if (row.candidateId !== user.id) throw new HttpError(403, "This is not your admission request.");
    await ownedExam(row.examId, user, false);
  } else await ownedExam(row.examId, user);
  return row;
}
router.get("/exams/:id/entry-information", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser, false);
  res.json({
    examId: exam.id, examTitle: exam.title,
    candidateId: req.appUser.id, candidateName: req.appUser.name,
    subjects: entrySubjects(exam), ...quotaTotals(exam.blueprint, exam.questionSnapshot),
    duration: exam.duration, startsAt: exam.startsAt.toISOString(), endsAt: exam.endsAt.toISOString(),
    serverNow: new Date().toISOString(), entryVersion: entryVersion(exam), settings: settingsFor(exam.deliverySettings),
  });
});
router.get("/exams/:id/admissions", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  const result = await db.transaction(async tx => {
    const rows = await tx.select().from(admissions).where(eq(admissions.examId, exam.id))
      .orderBy(desc(admissions.requestedAt)).limit(100);
    return Promise.all(rows.map(row => view(row, tx)));
  });
  res.json(result);
});
router.post("/exams/:id/admissions", async (req, res): Promise<void> => {
  if (req.appUser.role !== "candidate") throw new HttpError(403, "Only enrolled candidates can request admission.");
  const exam = await ownedExam(paramId(req), req.appUser, false);
  const result = await db.transaction(async tx => {
    // Same lock order as attempt creation/decisions. Repeated requests do not extend validity.
    const [locked] = await tx.select().from(exams).where(eq(exams.id, exam.id)).for("update");
    const now = await databaseNow(tx);
    available(locked!, now);
    const [existingAttempt] = await tx.select({ id: attempts.id }).from(attempts)
      .where(and(eq(attempts.examId, exam.id), eq(attempts.userId, req.appUser.id), eq(attempts.sandbox, false))).limit(1);
    if (existingAttempt) throw new HttpError(409, "An attempt already exists. Resume it instead of requesting new admission.");
    const previous = await tx.select().from(admissions)
      .where(and(eq(admissions.examId, exam.id), eq(admissions.candidateId, req.appUser.id)))
      .orderBy(desc(admissions.requestedAt)).limit(20);
    const current = previous.find(r => now < r.expiresAt && r.status !== "expired");
    if (current) return view(current, tx);
    if (previous.filter(r => now.getTime() - r.requestedAt.getTime() < 3_600_000).length >= 12)
      throw new HttpError(429, "Too many admission requests. Ask the examiner for assistance.");
    const [row] = await tx.insert(admissions).values({
      id: randomUUID(), examId: exam.id, candidateId: req.appUser.id,
      requestedAt: now, expiresAt: new Date(Math.min(now.getTime() + 5 * 60_000, locked!.endsAt.getTime())),
    }).returning();
    return view(row!, tx);
  });
  res.json(result);
});
router.get("/admissions/:id", async (req, res): Promise<void> => {
  const row = await authorized(paramId(req), req.appUser);
  res.json(await db.transaction(tx => view(row, tx)));
});
router.post("/admissions/:id/decision", async (req, res): Promise<void> => {
  const row = await authorized(paramId(req), req.appUser);
  await ownedExam(row.examId, req.appUser); // A candidate holding the QR cannot approve it.
  const input = DecideAdmissionBody.parse(req.body);
  const status = input.decision === "approve" ? "approved" : "denied";
  const result = await db.transaction(async tx => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, row.examId)).for("update");
    const [locked] = await tx.select().from(admissions).where(eq(admissions.id, row.id)).for("update");
    const now = await databaseNow(tx);
    available(exam!, now);
    if (now >= locked!.expiresAt) throw new HttpError(409, "This QR request has expired. The candidate must refresh it.");
    if (locked!.status !== "pending") {
      if (locked!.status === status) return view(locked!, tx);
      throw new HttpError(409, "This request already has a decision or has been used.");
    }
    const [candidate] = await tx.select().from(users).where(eq(users.id, locked!.candidateId));
    const [enrolled] = await tx.select().from(enrollments)
      .where(and(eq(enrollments.examId, exam!.id), eq(enrollments.userId, locked!.candidateId)));
    if (!candidate?.active || candidate.role !== "candidate" || !enrolled)
      throw new HttpError(403, "The candidate is no longer eligible for this examination.");
    const [updated] = await tx.update(admissions).set({
      status, decidedAt: now, decidedBy: req.appUser.id, reason: input.reason?.trim() ?? "",
    }).where(eq(admissions.id, row.id)).returning();
    return view(updated!, tx);
  });
  res.json(result);
});
export default router;
