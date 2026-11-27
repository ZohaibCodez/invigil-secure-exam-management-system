import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { db, exams, enrollments, attempts, users, announcements } from "@workspace/db";
import {
  GetExamResponse, ListExamsResponse, CreateExamResponse, CreateExamBody, UpdateExamBody,
  ExamActionBody, EnrollCandidatesBody, StartAttemptBody, CreateAnnouncementBody,
} from "@workspace/api-zod";
import { requireStaff, ownedExam, visibleExams, publicUser, audit, paramId, HttpError } from "../lib/access";
import { examView, examValues, getAnnouncements, shuffled } from "../lib/examination";
import { attemptView, databaseNow, finalizeIfExpired, finalizeLocked, reportToken } from "../lib/attempts";

const router: IRouter = Router();
router.get("/exams", async (req, res): Promise<void> => {
  const rows = await visibleExams(req.appUser);
  res.json(ListExamsResponse.parse(await Promise.all(rows.map(e => examView(e, req.appUser)))));
});
router.post("/exams", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const input = CreateExamBody.parse(req.body);
  const exam = await db.transaction(async tx => {
    const values = await examValues(input, req.appUser, tx);
    const [row] = await tx.insert(exams).values({ ...values, id: randomUUID(), ownerId: req.appUser.id }).returning();
    return row!;
  });
  await audit(exam.ownerId, "Examination created", exam.title, "exam", exam.id);
  res.status(201).json(CreateExamResponse.parse(await examView(exam, req.appUser)));
});
router.get("/exams/:id", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser, false);
  const candidates = req.appUser.role === "candidate" ? [] : await db.select({ user: users }).from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId)).where(eq(enrollments.examId, exam.id));
  // Candidates see instructions, not question contents before starting.
  res.json(GetExamResponse.parse({
    ...await examView(exam, req.appUser), questions: req.appUser.role === "candidate" ? [] : exam.questionSnapshot,
    candidates: candidates.map(c => publicUser(c.user)), announcements: await getAnnouncements(exam.id),
  }));
});
router.patch("/exams/:id", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  const input = UpdateExamBody.parse(req.body);
  const updated = await db.transaction(async tx => {
    const [locked] = await tx.select().from(exams).where(eq(exams.id, exam.id)).for("update");
    if (locked!.status !== "draft") throw new HttpError(409, "Only draft examinations can be edited. Published content is locked.");
    const values = await examValues(input, req.appUser, tx, locked);
    const [row] = await tx.update(exams).set(values).where(eq(exams.id, exam.id)).returning();
    return row!;
  });
  res.json(await examView(updated, req.appUser));
});
router.delete("/exams/:id", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  await db.transaction(async tx => {
    const [locked] = await tx.select().from(exams).where(eq(exams.id, exam.id)).for("update");
    if (locked!.status !== "draft") throw new HttpError(409, "Only drafts can be deleted.");
    const [attempt] = await tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.examId, exam.id)).limit(1);
    if (attempt) throw new HttpError(409, "This draft has sandbox history. Retain it for review rather than deleting it.");
    await tx.delete(exams).where(eq(exams.id, exam.id));
  });
  res.json({ message: "Draft examination deleted." });
});
router.post("/exams/:id/action", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  const { action } = ExamActionBody.parse(req.body);
  const updated = await db.transaction(async tx => {
    const [e] = await tx.select().from(exams).where(eq(exams.id, exam.id)).for("update");
    if (!e) throw new HttpError(404, "Exam not found.");
    if (action === "publish") {
      if (e.status !== "draft") throw new HttpError(409, "This examination is already published.");
      if (!e.questionSnapshot.length || !e.totalMarks) throw new HttpError(400, "Assign questions before publishing.");
      if (e.endsAt <= await databaseNow(tx)) throw new HttpError(400, "The exam closing time has passed.");
      await tx.update(exams).set({ status: "published" }).where(eq(exams.id, e.id));
    } else {
      if (e.status === "draft") throw new HttpError(409, "Publish the examination first.");
      const rows = await tx.select().from(attempts).where(and(eq(attempts.examId, e.id), eq(attempts.sandbox, false))).for("update");
      const now = await databaseNow(tx);
      const finished = [];
      for (const a of rows) finished.push(a.status === "active" && (action === "complete" || now >= a.deadline) ? await finalizeLocked(tx, a) : a);
      if (action === "complete") await tx.update(exams).set({ status: "completed" }).where(eq(exams.id, e.id));
      if (action === "publish-results") {
        if (!finished.length) throw new HttpError(400, "There are no real submissions to publish.");
        if (finished.some(a => a.status !== "graded")) throw new HttpError(409, "Finish all active attempts and written-response grading before publication.");
        if (e.status !== "completed" && now < e.endsAt) throw new HttpError(409, "Complete the examination before publishing results.");
        for (const a of finished) {
          if (!a.verificationToken) await tx.update(attempts).set({ verificationToken: reportToken(), reportIssuedAt: now }).where(eq(attempts.id, a.id));
        }
        await tx.update(exams).set({ resultsPublished: true }).where(eq(exams.id, e.id));
      }
    }
    const [row] = await tx.select().from(exams).where(eq(exams.id, e.id));
    return row!;
  });
  await audit(exam.ownerId, action === "publish-results" ? "Results published" : action === "complete" ? "Examination completed" : "Examination published", exam.title, "exam", exam.id);
  res.json(await examView(updated, req.appUser));
});
router.post("/exams/:id/enrollments", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  const { candidateIds } = EnrollCandidatesBody.parse(req.body);
  await db.transaction(async tx => {
    const [e] = await tx.select().from(exams).where(eq(exams.id, exam.id)).for("update");
    if (e!.status === "completed" || e!.resultsPublished) throw new HttpError(409, "Enrollment is closed.");
    const ids = [...new Set(candidateIds)];
    const valid = await tx.select().from(users).where(and(inArray(users.id, ids), eq(users.role, "candidate"), eq(users.active, true)));
    if (valid.length !== ids.length) throw new HttpError(400, "All enrollments must be active candidate accounts.");
    await tx.insert(enrollments).values(ids.map(userId => ({ examId: exam.id, userId }))).onConflictDoNothing();
  });
  res.json({ message: "Candidates enrolled successfully." });
});
router.post("/exams/:id/start", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser, false);
  const { sandbox = false, policyVersion } = StartAttemptBody.parse(req.body ?? {});
  if (sandbox) requireStaff(req.appUser);
  if (!sandbox && req.appUser.role !== "candidate") throw new HttpError(403, "Use sandbox mode to preview an examination.");
  const a = await db.transaction(async tx => {
    const [e] = await tx.select().from(exams).where(eq(exams.id, exam.id)).for("update");
    if (!sandbox) {
      const [existing] = await tx.select().from(attempts).where(and(eq(attempts.examId, exam.id), eq(attempts.userId, req.appUser.id), eq(attempts.sandbox, false)));
      if (existing) return existing;
    }
    const now = await databaseNow(tx);
    if (!sandbox && (e!.status === "draft" || e!.status === "completed" || now < e!.startsAt || now >= e!.endsAt)) throw new HttpError(403, "The examination is not currently available.");
    if (!sandbox && e!.assistancePolicy && policyVersion !== e!.assistancePolicy.version) throw new HttpError(400, "Read and acknowledge the current assistance policy before starting.");
    if (!e!.questionSnapshot.length) throw new HttpError(400, "Assign questions before starting a preview.");
    const ordered = e!.randomize ? shuffled(e!.questionSnapshot) : [...e!.questionSnapshot];
    const frozen = ordered.map(q => ({ ...q, options: e!.randomize ? shuffled(q.options) : [...q.options] }));
    const deadline = new Date(sandbox ? now.getTime() + e!.duration * 60000 : Math.min(now.getTime() + e!.duration * 60000, e!.endsAt.getTime()));
    const [row] = await tx.insert(attempts).values({
      id: randomUUID(), examId: exam.id, userId: req.appUser.id, sandbox, questions: frozen,
      totalMarks: e!.totalMarks, startedAt: now, deadline, lastSavedAt: now,
      policySnapshot: e!.assistancePolicy, acknowledgedAt: !sandbox && e!.assistancePolicy ? now : null,
    }).returning();
    return row!;
  });
  res.json(await attemptView(await finalizeIfExpired(a.id), req.appUser));
});
router.post("/exams/:id/announcements", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  const input = CreateAnnouncementBody.parse(req.body);
  const [row] = await db.insert(announcements).values({ id: randomUUID(), examId: exam.id, message: input.message }).returning();
  res.status(201).json({ id: row!.id, message: row!.message, createdAt: row!.createdAt.toISOString() });
});
export default router;
