import { randomInt } from "node:crypto";
import type { BlueprintQuota, QuestionData } from "@workspace/db";

export const blueprintCaveat = "Exact blueprint coverage is not psychometric equivalence. Difficulty bands are examiner judgments, not calibrated difficulty. Observed objective-item accuracy uses completed real attempts only, with sample counts; small samples cannot establish equivalence. Comparisons never adjust grades. Sandbox forms are separate; historical forms use their own frozen quotas.";
const key = (q: BlueprintQuota) => JSON.stringify([q.topic, q.difficulty, q.type, q.marks]);
export const matchesQuota = (q: QuestionData, quota: BlueprintQuota) =>
  q.category === quota.topic && q.difficulty === quota.difficulty && q.type === quota.type && q.marks === quota.marks;
export function quotaTotals(quotas: BlueprintQuota[], pool: QuestionData[]) {
  return quotas.length
    ? { questionCount: quotas.reduce((s, q) => s + q.count, 0), totalMarks: quotas.reduce((s, q) => s + q.count * q.marks, 0) }
    : { questionCount: pool.length, totalMarks: pool.reduce((s, q) => s + q.marks, 0) };
}
export function checkBlueprint(quotas: BlueprintQuota[], pool: QuestionData[], form?: QuestionData[]) {
  const issues: string[] = [];
  if (new Set(quotas.map(key)).size !== quotas.length) issues.push("Duplicate quota rows are not allowed; combine their counts.");
  const totals = quotaTotals(quotas, pool);
  if (totals.questionCount > 200) issues.push("A paper cannot exceed 200 questions.");
  if (!pool.length) issues.push("Select an eligible question pool in the Paper tab.");
  const checks = quotas.map(quota => {
    const available = pool.filter(q => matchesQuota(q, quota)).length;
    const actualCount = (form ?? []).filter(q => matchesQuota(q, quota)).length;
    const shortage = Math.max(0, quota.count - available);
    if (shortage) issues.push(`${quota.topic} / ${quota.difficulty} / ${quota.type} / ${quota.marks} marks: requires ${quota.count}, available ${available}, shortage ${shortage}.`);
    return { ...quota, available, shortage, actualCount, actualMarks: actualCount * quota.marks };
  });
  const formMatches = !form || !quotas.length || (
    form.length === totals.questionCount &&
    new Set(form.map(q => q.id)).size === form.length &&
    checks.every(c => c.actualCount === c.count)
  );
  return { valid: !issues.length, issues, checks, ...totals, matches: formMatches && !issues.length };
}
/** Disjoint strata permit bounded sampling without replacement, not an approximate constraint solver. */
export function generateForm(quotas: BlueprintQuota[], pool: QuestionData[]) {
  const check = checkBlueprint(quotas, pool);
  if (!check.valid) throw new Error(check.issues.join(" "));
  if (!quotas.length) return structuredClone(pool);
  return structuredClone(quotas.flatMap(quota => {
    const eligible = pool.filter(q => matchesQuota(q, quota));
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [eligible[i], eligible[j]] = [eligible[j]!, eligible[i]!];
    }
    return eligible.slice(0, quota.count);
  }));
}
