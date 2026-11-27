import { eq, inArray } from "@workspace/db";
import { createHash } from "node:crypto";
import { db, attempts, questions, users } from "@workspace/db";
import { blueprintCaveat, checkBlueprint } from "./blueprint";
import type { AppUser } from "./access";
import type { ExamRow, Tx } from "./examination";

/** Draft validation uses the live eligible bank; publication freezes this exact pool. */
export async function eligiblePool(exam: ExamRow, user: AppUser, tx: Tx | typeof db = db) {
  if (exam.status !== "draft") return { pool: exam.questionSnapshot, issues: [] as string[] };
  const ids = exam.questionSnapshot.map(q => q.id);
  const rows = ids.length ? await tx.select().from(questions).where(inArray(questions.id, ids)).for("share") : [];
  const accessible = rows.filter(q => user.role === "admin" || q.ownerId === exam.ownerId);
  const missing = ids.filter(id => !accessible.some(q => q.id === id));
  return {
    pool: ids.flatMap(id => accessible.find(q => q.id === id)?.data ?? []),
    issues: missing.map(id => `Eligible question ${id} is missing or no longer accessible. Reselect the pool before publication.`),
  };
}
export async function blueprintReport(exam: ExamRow, user: AppUser) {
  const { pool, issues } = await eligiblePool(exam, user);
  const check = checkBlueprint(exam.blueprint, pool);
  const rows = await db.select({ a: attempts, name: users.name }).from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId)).where(eq(attempts.examId, exam.id));
  const visible = rows.filter(({ a }) => !a.sandbox || a.userId === user.id);
  const metrics = new Map<string, { id: string; text: string; samples: number; correct: number }>();
  for (const { a } of visible.filter(({ a }) => !a.sandbox && a.status !== "active")) {
    for (const q of a.questions.filter(q => q.type !== "written")) {
      // Version by complete frozen item, so bank edits never mix different marking schemes.
      const version = JSON.stringify({ ...q, options: [...q.options].sort((a, b) => a.id.localeCompare(b.id)), correctAnswers: [...q.correctAnswers].sort() });
      const m = metrics.get(version) ?? { id: `${q.id}:${createHash("sha256").update(version).digest("hex").slice(0, 12)}`, text: q.text, samples: 0, correct: 0 };
      m.samples++;
      if (a.answers.find(ans => ans.questionId === q.id)?.score === q.marks) m.correct++;
      metrics.set(version, m);
    }
  }
  return {
    quotas: exam.blueprint, valid: check.valid && !issues.length, issues: [...issues, ...check.issues],
    checks: check.checks, questionCount: check.questionCount, totalMarks: check.totalMarks,
    poolCount: pool.length, frozen: exam.status !== "draft", caveat: blueprintCaveat,
    forms: visible.map(({ a, name }) => {
      const comparison = checkBlueprint(a.blueprint, a.questions, a.questions);
      return { attemptId: a.id, candidateName: name, sandbox: a.sandbox, status: a.status,
        questionIds: a.questions.map(q => q.id), questionCount: a.questions.length, totalMarks: a.totalMarks,
        matches: comparison.matches, checks: comparison.checks };
    }),
    items: [...metrics.values()].map(m => ({ ...m, accuracy: Math.round(m.correct / m.samples * 1000) / 10 })),
  };
}
