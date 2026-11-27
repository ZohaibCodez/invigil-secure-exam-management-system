import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "@workspace/db";
import { db, attempts, exams, users, type AnswerData, type QuestionData } from "@workspace/db";
import { HttpError, ownedExam, type AppUser } from "./access";
import { getAnnouncements, type Tx } from "./examination";
import { settingsFor } from "./delivery";

export type AttemptRow = typeof attempts.$inferSelect;
export function selectedOptions(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(v => typeof v === "string") ? parsed as string[] : [];
  } catch { return []; }
}
export function validateAnswer(value: string, question: QuestionData) {
  if (question.type === "written") return;
  if (!value) return;
  let selected: unknown;
  try { selected = JSON.parse(value); } catch { throw new HttpError(400, "Selected answers must be a JSON array."); }
  if (!Array.isArray(selected) || selected.some(s => typeof s !== "string" || !question.options.some(o => o.id === s))) throw new HttpError(400, "Selected answer contains an invalid option.");
  if (new Set(selected).size !== selected.length || (question.type === "single" && selected.length > 1)) throw new HttpError(400, "Invalid number of selected options.");
}
export function hasAnswer(q: QuestionData, value?: string) {
  return q.type === "written" ? !!value?.trim() : selectedOptions(value ?? "").length > 0;
}
export function objectiveScore(q: QuestionData, value: string) {
  const selected = selectedOptions(value);
  return selected.length === q.correctAnswers.length && q.correctAnswers.every(id => selected.includes(id)) ? q.marks : 0;
}
export async function databaseNow(tx: Pick<Tx, "execute">) {
  const result = await tx.execute(sql`SELECT clock_timestamp() AS now`);
  return new Date((result.rows[0] as { now: Date }).now);
}
export async function finalizeLocked(tx: Tx, attempt: AttemptRow) {
  if (attempt.status !== "active") return attempt;
  const answers: AnswerData[] = attempt.questions.map(q => {
    const a = attempt.answers.find(a => a.questionId === q.id);
    const value = a?.value ?? "";
    return {
      questionId: q.id, value, markedForReview: a?.markedForReview ?? false, revision: a?.revision ?? 0,
      score: q.type === "written" ? (hasAnswer(q, value) ? null : 0) : objectiveScore(q, value),
      feedback: null,
      lockedAt: a?.lockedAt ?? null,
    };
  });
  const complete = answers.every(a => a.score !== null);
  const submittedAt = await databaseNow(tx);
  const [updated] = await tx.update(attempts).set({
    status: complete ? "graded" : "submitted", answers,
    score: complete ? answers.reduce((s, a) => s + (a.score ?? 0), 0) : null,
    submittedAt: submittedAt > attempt.deadline ? attempt.deadline : submittedAt,
  }).where(eq(attempts.id, attempt.id)).returning();
  return updated!;
}
export async function finalizeIfExpired(id: string) {
  return db.transaction(async tx => {
    const [a] = await tx.select().from(attempts).where(eq(attempts.id, id)).for("update");
    if (!a) throw new HttpError(404, "Attempt not found.");
    const now = await databaseNow(tx);
    return a.status === "active" && now >= a.deadline ? finalizeLocked(tx, a) : a;
  });
}
export async function expireExamAttempts(examIds: string[]) {
  if (!examIds.length) return;
  const rows = await db.select({ id: attempts.id }).from(attempts).where(and(inArray(attempts.examId, examIds), eq(attempts.status, "active")));
  for (const a of rows) await finalizeIfExpired(a.id);
}
export async function authorizedAttempt(id: string, user: AppUser, ownerOnly = false) {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id));
  if (!attempt) throw new HttpError(404, "Attempt not found.");
  if (ownerOnly || user.role === "candidate") {
    if (attempt.userId !== user.id) throw new HttpError(403, "This is not your attempt.");
  } else {
    await ownedExam(attempt.examId, user);
  }
  if (attempt.sandbox && attempt.userId !== user.id) throw new HttpError(403, "Sandbox attempts are private.");
  return attempt;
}
export async function attemptView(a: AttemptRow, user: AppUser) {
  const [exam] = await db.select().from(exams).where(eq(exams.id, a.examId));
  const [candidate] = await db.select().from(users).where(eq(users.id, a.userId));
  const reveal = a.status !== "active" && (user.role !== "candidate" || exam!.resultsPublished);
  return {
    id: a.id, examId: a.examId, examTitle: exam!.title, candidateName: candidate!.name,
    status: a.status, startedAt: a.startedAt.toISOString(), deadline: a.deadline.toISOString(),
    serverNow: new Date().toISOString(), submittedAt: a.submittedAt?.toISOString() ?? null,
    questions: a.questions.map(q => reveal ? q : { ...q, correctAnswers: [], explanation: "" }),
    answers: a.answers.map(ans => reveal ? ans : { ...ans, score: null, feedback: null }),
    sandbox: a.sandbox, totalMarks: a.totalMarks, score: reveal ? a.score : null,
    scratchpad: a.scratchpad, scratchpadVersion: a.scratchpadVersion, announcements: await getAnnouncements(a.examId),
    deliverySettings: settingsFor(a.deliverySettings), entryAttestation: a.entryAttestation,
  };
}
export const reportToken = () => randomBytes(24).toString("hex");
