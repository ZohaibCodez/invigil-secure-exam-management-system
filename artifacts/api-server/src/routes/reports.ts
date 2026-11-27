import { Router, type IRouter } from "express";
import { eq } from "@workspace/db";
import { db, attempts, exams } from "@workspace/db";
import { VerifyReportResponse } from "@workspace/api-zod";
import { authenticated, HttpError, paramId } from "../lib/access";
import { authorizedAttempt } from "../lib/attempts";
import { buildReportPdf } from "../lib/report-pdf";

export const publicReports: IRouter = Router();
publicReports.get("/verify/:token", async (req, res): Promise<void> => {
  const token = paramId(req, "token");
  if (!/^[a-f0-9]{48}$/.test(token)) throw new HttpError(404, "Report verification identifier not found.");
  const [a] = await db.select().from(attempts).where(eq(attempts.verificationToken, token));
  if (!a || a.sandbox || a.score === null || !a.reportIssuedAt) throw new HttpError(404, "Report not found or no longer valid.");
  const [e] = await db.select().from(exams).where(eq(exams.id, a.examId));
  if (!e?.resultsPublished) throw new HttpError(404, "Report has not been published.");
  // A public verification response deliberately contains no email, answers, or full name.
  const { users } = await import("@workspace/db");
  const [candidate] = await db.select({ name: users.name }).from(users).where(eq(users.id, a.userId));
  res.json(VerifyReportResponse.parse({
    valid: true, examTitle: e.title, candidateInitials: candidate!.name.split(/\s+/).map(n => n[0]).join(". ") + ".",
    score: a.score, totalMarks: a.totalMarks, issuedAt: a.reportIssuedAt.toISOString(),
  }));
});
const reports: IRouter = Router();
reports.get("/reports/:id/pdf", authenticated, async (req, res): Promise<void> => {
  const a = await authorizedAttempt(paramId(req), req.appUser);
  const [e] = await db.select().from(exams).where(eq(exams.id, a.examId));
  if (!e?.resultsPublished || a.score === null || !a.verificationToken || !a.reportIssuedAt || a.sandbox) throw new HttpError(409, "A report is available only after results are published.");
  const { users } = await import("@workspace/db");
  const [c] = await db.select().from(users).where(eq(users.id, a.userId));
  const origin = process.env.BETTER_AUTH_URL ?? `${req.protocol}://${req.get("host")}`;
  const bytes = await buildReportPdf({
    examTitle: e.title, subject: e.subject, startsAt: e.startsAt, endsAt: e.endsAt, passPercent: e.passPercent,
    candidateName: c!.name, candidateEmail: c!.email,
    attemptId: a.id, score: a.score, totalMarks: a.totalMarks, submittedAt: a.submittedAt, issuedAt: a.reportIssuedAt,
    voided: !!a.voidedAt, verificationToken: a.verificationToken,
    verificationUrl: new URL(`/verify/${a.verificationToken}`, origin).toString(),
    questions: a.questions, answers: a.answers,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="examora-result-${a.id.slice(0, 8)}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(bytes));
});
export default reports;
