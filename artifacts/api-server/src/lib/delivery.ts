import { createHash } from "node:crypto";
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from "@workspace/db";
import type { ExamRow } from "./examination";

export function settingsFor(value: Partial<DeliverySettings> | null | undefined): DeliverySettings {
  return { ...DEFAULT_DELIVERY_SETTINGS, ...value };
}
export function entrySubjects(exam: ExamRow) {
  return [...new Set(exam.questionSnapshot.map(q => q.category.trim()).filter(Boolean))].sort();
}
export function entryVersion(exam: ExamRow) {
  return createHash("sha256").update(JSON.stringify([
    exam.id, exam.title, exam.duration, exam.startsAt.toISOString(), exam.endsAt.toISOString(),
    exam.assistancePolicy?.version ?? null, settingsFor(exam.deliverySettings), entrySubjects(exam),
  ])).digest("hex");
}
export function requiresEntryAcknowledgement(settings: DeliverySettings) {
  return settings.requireProctorApproval || settings.requireReadiness ||
    settings.confirmSubjects || settings.lockOnSave || settings.minimumAttemptPercent > 0 || settings.requireFullscreen;
}
