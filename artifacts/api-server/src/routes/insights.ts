import { Router, type IRouter } from "express";
import { currentRealAttempt } from "../lib/real-attempt";
import { settingsFor } from "../lib/delivery";
import { and, eq, desc, inArray } from "@workspace/db";
import { db, exams, attempts, users, incidents, activities, questions, enrollments } from "@workspace/db";
import { GetDashboardResponse, ListResultsResponse, GetAnalyticsResponse, GetMonitorResponse } from "@workspace/api-zod";
import { visibleExams, ownedExam, requireStaff, paramId } from "../lib/access";
import { examView, getAnnouncements } from "../lib/examination";
import { expireExamAttempts, hasAnswer } from "../lib/attempts";

const router: IRouter = Router();
const average = (values: number[]) => values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length * 10) / 10 : 0;
async function scopedAttempts(user: Express.Request["appUser"], resultsOnly = false) {
  const examRows = await visibleExams(user);
  const ids = examRows.map(e => e.id);
  if (!ids.length) return { examRows, rows: [] };
  await expireExamAttempts(ids);
  let rows = await db.select({ attempt: attempts, candidate: users }).from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(and(inArray(attempts.examId, ids), currentRealAttempt(),
      user.role === "candidate" ? eq(attempts.userId, user.id) : undefined));
  if (resultsOnly) rows = rows.filter(r => r.attempt.status !== "active" && (user.role !== "candidate" || examRows.find(e => e.id === r.attempt.examId)?.resultsPublished));
  return { examRows, rows };
}
router.get("/dashboard", async (req, res): Promise<void> => {
  const { examRows, rows } = await scopedAttempts(req.appUser);
  const views = await Promise.all(examRows.map(e => examView(e, req.appUser)));
  const ids = examRows.map(e => e.id);
  const [activity, questionRows, enrolled] = await Promise.all([
    db.select().from(activities).where(req.appUser.role === "admin" ? undefined : req.appUser.role === "candidate"
      ? (ids.length ? inArray(activities.examId, ids) : eq(activities.id, "__none__")) : eq(activities.ownerId, req.appUser.id)).orderBy(desc(activities.createdAt)).limit(8),
    req.appUser.role === "candidate" ? Promise.resolve([]) : db.select({ id: questions.id }).from(questions).where(req.appUser.role === "admin" ? undefined : eq(questions.ownerId, req.appUser.id)),
    ids.length ? db.select({ userId: enrollments.userId }).from(enrollments).where(inArray(enrollments.examId, ids)) : Promise.resolve([]),
  ]);
  const scored = rows.filter(r => r.attempt.score !== null && (req.appUser.role !== "candidate" || examRows.find(e => e.id === r.attempt.examId)?.resultsPublished));
  res.json(GetDashboardResponse.parse({
    totalExams: examRows.length, activeExams: views.filter(e => e.status === "ongoing").length,
    candidates: new Set(enrolled.map(e => e.userId)).size, submissions: rows.filter(r => r.attempt.status !== "active").length,
    questionCount: questionRows.length, averageScore: average(scored.map(r => r.attempt.totalMarks ? r.attempt.score! / r.attempt.totalMarks * 100 : 0)),
    pendingGrading: rows.filter(r => r.attempt.status === "submitted").length, exams: views.slice(0, 6),
    activity: activity.map(a => ({ id: a.id, title: a.title, detail: a.detail, createdAt: a.createdAt.toISOString(), type: a.type })),
  }));
});
router.get("/exams/:id/monitor", async (req, res): Promise<void> => {
  const exam = await ownedExam(paramId(req), req.appUser);
  await expireExamAttempts([exam.id]);
  const rows = await db.select({ attempt: attempts, candidate: users }).from(attempts).innerJoin(users, eq(users.id, attempts.userId))
    .where(and(eq(attempts.examId, exam.id), currentRealAttempt()));
  const allIncidents = rows.length ? await db.select().from(incidents).where(inArray(incidents.attemptId, rows.map(r => r.attempt.id))).orderBy(desc(incidents.createdAt)).limit(300) : [];
  res.json(GetMonitorResponse.parse({
    attempts: rows.map(({ attempt: a, candidate: c }) => ({
      id: a.id, candidateName: c.name, email: c.email, status: a.status,
      answered: a.questions.filter(q => hasAnswer(q, a.answers.find(ans => ans.questionId === q.id)?.value)).length,
      questionCount: a.questions.length, deadline: a.deadline.toISOString(), lastSavedAt: a.lastSavedAt.toISOString(),
      incidents: allIncidents.filter(i => i.attemptId === a.id).length,
      violationCount: a.violationCount, maxViolations: settingsFor(a.deliverySettings).maxViolations,
      requireFullscreen: settingsFor(a.deliverySettings).requireFullscreen,
      lockedAt: a.lockedAt?.toISOString() ?? null, lockReason: a.lockReason, voidedAt: a.voidedAt?.toISOString() ?? null,
    })),
    incidents: allIncidents.map(i => ({ id: i.id, candidateName: rows.find(r => r.attempt.id === i.attemptId)!.candidate.name, type: i.type, detail: i.detail, createdAt: i.createdAt.toISOString() })),
    announcements: await getAnnouncements(exam.id),
  }));
});
router.get("/results", async (req, res): Promise<void> => {
  const { examRows, rows } = await scopedAttempts(req.appUser, true);
  res.json(ListResultsResponse.parse(rows.map(({ attempt: a, candidate: c }) => {
    const e = examRows.find(e => e.id === a.examId)!;
    return {
      id: a.id, examId: a.examId, examTitle: e.title, candidateName: c.name, candidateEmail: c.email,
      score: a.score, totalMarks: a.totalMarks, percentage: a.score === null ? null : Math.round(a.score / a.totalMarks * 1000) / 10,
      status: a.status, published: e.resultsPublished, submittedAt: a.submittedAt?.toISOString() ?? null,
      verificationToken: e.resultsPublished ? a.verificationToken : null,
    };
  })));
});
router.get("/analytics", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const { examRows, rows } = await scopedAttempts(req.appUser);
  const finished = rows.filter(r => r.attempt.status !== "active");
  const scored = finished.filter(r => r.attempt.score !== null);
  const metrics = new Map<string, { id: string; text: string; category: string; difficulty: string; attempts: number; skipped: number; correct: number }>();
  for (const { attempt: a } of finished) for (const q of a.questions) {
    // Written responses require qualitative evaluation, so accuracy covers objective items only.
    if (q.type === "written") continue;
    const metric = metrics.get(q.id) ?? { id: q.id, text: q.text, category: q.category, difficulty: q.difficulty, attempts: 0, skipped: 0, correct: 0 };
    metric.attempts++;
    const ans = a.answers.find(ans => ans.questionId === q.id);
    if (!hasAnswer(q, ans?.value)) metric.skipped++;
    if (ans?.score === q.marks) metric.correct++;
    metrics.set(q.id, metric);
  }
  const percentages = scored.map(r => r.attempt.score! / r.attempt.totalMarks * 100);
  res.json(GetAnalyticsResponse.parse({
    totalAttempts: rows.length, averageScore: average(percentages),
    passRate: scored.length ? Math.round(scored.filter(r => r.attempt.score! / r.attempt.totalMarks * 100 >= examRows.find(e => e.id === r.attempt.examId)!.passPercent).length / scored.length * 1000) / 10 : 0,
    completionRate: rows.length ? Math.round(finished.length / rows.length * 1000) / 10 : 0,
    questions: [...metrics.values()].map(m => ({ ...m, accuracy: Math.round(m.correct / m.attempts * 1000) / 10 })),
    distribution: ["0–19", "20–39", "40–59", "60–79", "80–100"].map((label, i) => ({ label, count: percentages.filter(p => p >= i * 20 && (i === 4 ? p <= 100 : p < (i + 1) * 20)).length })),
  }));
});
export default router;
