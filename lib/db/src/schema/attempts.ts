import { pgTable, text, timestamp, boolean, integer, doublePrecision, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { exams, type QuestionData, type AssistancePolicyData, type BlueprintQuota } from "./exams";
import type { DeliverySettings, EntryAttestation } from "./delivery-settings";

export type AnswerData = {
  questionId: string;
  value: string;
  markedForReview: boolean;
  revision: number;
  score: number | null;
  feedback: string | null;
  lockedAt?: string | null;
};
export const attempts = pgTable("attempts", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => exams.id),
  userId: text("user_id").notNull().references(() => users.id),
  sandbox: boolean("sandbox").notNull().default(false),
  status: text("status").notNull().default("active"),
  questions: jsonb("questions").$type<QuestionData[]>().notNull(),
  blueprint: jsonb("blueprint").$type<BlueprintQuota[]>().notNull().default([]),
  answers: jsonb("answers").$type<AnswerData[]>().notNull().default([]),
  scratchpad: text("scratchpad").notNull().default(""),
  scratchpadVersion: integer("scratchpad_version").notNull().default(0),
  policySnapshot: jsonb("policy_snapshot").$type<AssistancePolicyData | null>(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  disclosure: text("disclosure").notNull().default(""),
  deliverySettings: jsonb("delivery_settings").$type<DeliverySettings>().notNull().default({
    requireProctorApproval: false, requireReadiness: false, confirmSubjects: false,
    lockOnSave: false, minimumAttemptPercent: 0, venue: "", sessionLabel: "",
  }),
  entryAttestation: jsonb("entry_attestation").$type<EntryAttestation | null>(),
  totalMarks: doublePrecision("total_marks").notNull(),
  score: doublePrecision("score"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  verificationToken: text("verification_token").unique(),
  reportIssuedAt: timestamp("report_issued_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("one_real_attempt_per_enrollment").on(t.examId, t.userId).where(sql`${t.sandbox} = false`),
  index("attempts_exam_idx").on(t.examId),
  index("attempts_candidate_idx").on(t.userId),
]);
export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("incidents_attempt_idx").on(t.attemptId)]);
export const saveOperations = pgTable("save_operations", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  operationId: text("operation_id").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  revisions: jsonb("revisions").$type<{ questionId: string; revision: number }[]>(),
  scratchpadVersion: integer("scratchpad_version"),
}, (t) => [uniqueIndex("save_operation_unique").on(t.attemptId, t.operationId)]);
