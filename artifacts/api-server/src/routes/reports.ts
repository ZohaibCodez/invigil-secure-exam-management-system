import { Router, type IRouter } from "express";
import { eq } from "@workspace/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { db, attempts, exams } from "@workspace/db";
import { VerifyReportResponse } from "@workspace/api-zod";
import { authenticated, HttpError, paramId } from "../lib/access";
import { authorizedAttempt } from "../lib/attempts";

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
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]), y = 780;
  const safe = (text: string) => text.replace(/[^\x20-\x7E]/g, " ");
  const line = (text: string, size = 11, strong = false) => {
    if (y < 70) { page = pdf.addPage([595, 842]); y = 780; }
    const clean = safe(text);
    const words = clean.split(" ");
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > 475 && current) {
        page.drawText(current, { x: 55, y, font: strong ? bold : font, size, color: rgb(.13, .2, .22) }); y -= size + 8; current = word;
      } else current = next;
    }
    page.drawText(current.slice(0, 200), { x: 55, y, font: strong ? bold : font, size, color: rgb(.13, .2, .22) }); y -= size + 10;
  };
  line("EXAMORA", 26, true);
  line("Verified examination performance report", 12); y -= 20;
  line(e.title, 20, true);
  line(`Candidate: ${c!.name}`);
  line(`Email: ${c!.email}`);
  line(`Submitted: ${a.submittedAt?.toISOString() ?? "Not recorded"}`);
  line(`Report issued: ${a.reportIssuedAt.toISOString()}`); y -= 15;
  const percentage = Math.round(a.score / a.totalMarks * 1000) / 10;
  line(`Final score: ${a.score} / ${a.totalMarks} (${percentage}%)`, 18, true);
  line(`Outcome: ${percentage >= e.passPercent ? "PASS" : "BELOW PASS THRESHOLD"} | Pass threshold: ${e.passPercent}%`); y -= 15;
  for (const [i, q] of a.questions.entries()) {
    const ans = a.answers.find(ans => ans.questionId === q.id);
    line(`Question ${i + 1}: ${q.text}`, 11, true);
    line(`Awarded ${ans?.score ?? 0} / ${q.marks} marks`);
    if (ans?.feedback) line(`Examiner feedback: ${ans.feedback}`);
  }
  y -= 10;
  line("Verify this report online", 12, true);
  line(`Verification ID: ${a.verificationToken}`, 9);
  const origin = process.env.BETTER_AUTH_URL ?? `${req.protocol}://${req.get("host")}`;
  const verificationURL = new URL(`/verify/${a.verificationToken}`, origin).toString();
  line(verificationURL, 8);
  if (y < 170) { page = pdf.addPage([595, 842]); y = 780; }
  const qr = await QRCode.toBuffer(verificationURL, { width: 180, margin: 1 });
  const image = await pdf.embedPng(qr);
  page.drawImage(image, { x: 55, y: y - 110, width: 100, height: 100 });
  pdf.setTitle(`Examora - ${e.title} - Result`);
  pdf.setProducer("Examora");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="examora-result-${a.id.slice(0, 8)}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(await pdf.save()));
});
export default reports;
