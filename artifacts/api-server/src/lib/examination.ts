import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, eq, inArray } from "@workspace/db";
import { db, exams, enrollments, attempts, announcements, questions, type QuestionData } from "@workspace/db";
import { HttpError, type AppUser } from "./access";
import { CreateExamBody, CreateQuestionBody } from "@workspace/api-zod";
import { quotaTotals } from "./blueprint";
import { settingsFor, entryVersion } from "./delivery";

export type ExamRow = typeof exams.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function shuffled<T>(input: T[]) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
export function validateQuestion(input: unknown): Omit<QuestionData, "id"> {
  const data = CreateQuestionBody.parse(input);
  if (new Set(data.options.map(o => o.id)).size !== data.options.length) throw new HttpError(400, "Option identifiers must be unique.");
  if (data.options.some(o => !o.id || o.id.length > 100)) throw new HttpError(400, "Invalid option identifier.");
  if (new Set(data.correctAnswers).size !== data.correctAnswers.length) throw new HttpError(400, "Correct answers cannot repeat.");
  if (data.type === "written") {
    if (data.options.length || data.correctAnswers.length) throw new HttpError(400, "Written questions must not have answer options.");
  } else {
    if (data.options.length < 2) throw new HttpError(400, "Objective questions need at least two options.");
    if (!data.correctAnswers.length || data.correctAnswers.some(id => !data.options.some(o => o.id === id))) throw new HttpError(400, "Select valid correct options.");
    if (data.type === "single" && data.correctAnswers.length !== 1) throw new HttpError(400, "Single-answer questions need exactly one correct option.");
  }
  return data;
}
export async function examValues(input: unknown, user: AppUser, tx: Tx, previous?: ExamRow) {
  const data = CreateExamBody.parse(input);
  const startsAt = new Date(data.startsAt), endsAt = new Date(data.endsAt);
  if (endsAt <= startsAt) throw new HttpError(400, "The closing time must be after the opening time.");
  if (new Set(data.questionIds).size !== data.questionIds.length) throw new HttpError(400, "A question cannot be assigned twice.");
  const rows = data.questionIds.length ? await tx.select().from(questions).where(inArray(questions.id, data.questionIds)) : [];
  if (rows.length !== data.questionIds.length || rows.some(q => user.role !== "admin" && q.ownerId !== user.id)) throw new HttpError(403, "Some questions are missing or not owned by you.");
  const questionSnapshot = data.questionIds.map(id => rows.find(q => q.id === id)!.data);
  const policy = data.assistancePolicy;
  const assistancePolicy = policy === undefined ? previous?.assistancePolicy ?? null : policy === null ? null : {
    ...policy, resources: policy.resources.trim(),
    version: createHash("sha256").update(JSON.stringify([policy.mode, policy.resources.trim(), policy.requireDisclosure])).digest("hex"),
  };
  if (policy?.mode === "ai_disclosed" && !policy.requireDisclosure) throw new HttpError(400, "AI with disclosure requires a written disclosure. Use conditional AI permission for a different policy.");
  if (assistancePolicy && assistancePolicy.resources.length < 5) throw new HttpError(400, "Explain the permitted resources in at least five characters.");
  return {
    title: data.title.trim(), subject: data.subject?.trim() || "General", instructions: data.instructions,
    duration: data.duration, startsAt, endsAt, questionSnapshot,
    totalMarks: quotaTotals(previous?.blueprint ?? [], questionSnapshot).totalMarks,
    randomize: data.randomize ?? true, passPercent: data.passPercent ?? 50, assistancePolicy,
    deliverySettings: settingsFor(data.deliverySettings ?? previous?.deliverySettings),
  };
}
export function examStatus(e: ExamRow) {
  if (e.status === "draft" || e.status === "completed") return e.status;
  const now = Date.now();
  return now >= e.endsAt.getTime() ? "completed" : now >= e.startsAt.getTime() ? "ongoing" : "published";
}
export async function examView(e: ExamRow, user: AppUser) {
  const [enrolled, submitted, own] = await Promise.all([
    db.select({ id: enrollments.userId }).from(enrollments).where(eq(enrollments.examId, e.id)),
    db.select({ status: attempts.status }).from(attempts).where(and(eq(attempts.examId, e.id), eq(attempts.sandbox, false))),
    user.role === "candidate" ? db.select().from(attempts).where(and(eq(attempts.examId, e.id), eq(attempts.userId, user.id), eq(attempts.sandbox, false))) : Promise.resolve([]),
  ]);
  return {
    id: e.id, title: e.title, subject: e.subject, instructions: e.instructions, duration: e.duration,
    startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), status: examStatus(e),
    totalMarks: e.totalMarks, questionCount: quotaTotals(e.blueprint, e.questionSnapshot).questionCount, enrolledCount: enrolled.length,
    submittedCount: submitted.filter(a => a.status !== "active").length, resultsPublished: e.resultsPublished,
    randomize: e.randomize, passPercent: e.passPercent, attemptId: own[0]?.id ?? null,
    attemptStatus: own[0]?.status ?? null, createdAt: e.createdAt.toISOString(), assistancePolicy: e.assistancePolicy,
    deliverySettings: settingsFor(e.deliverySettings), entryVersion: entryVersion(e),
  };
}
export async function getAnnouncements(examId: string) {
  const rows = await db.select().from(announcements).where(eq(announcements.examId, examId));
  return rows.map(a => ({ id: a.id, message: a.message, createdAt: a.createdAt.toISOString() }));
}
export const newQuestion = (input: unknown, ownerId: string) => {
  const id = randomUUID();
  return { id, ownerId, data: { ...validateQuestion(input), id } };
};
