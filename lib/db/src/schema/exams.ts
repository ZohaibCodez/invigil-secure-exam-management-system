import { pgTable, text, timestamp, boolean, integer, doublePrecision, jsonb, primaryKey, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import type { DeliverySettings } from "./delivery-settings";

export type QuestionData = {
  id: string;
  text: string;
  type: "single" | "multiple" | "written";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation?: string;
  /** Multiple-select marking rule. Missing means "exact" (all-or-nothing), as before. */
  scoring?: "exact" | "partial";
};
export type AssistancePolicyData = {
  mode: "closed_book" | "open_book" | "ai_disclosed" | "ai_conditional";
  resources: string;
  requireDisclosure: boolean;
  version: string;
};
export type BlueprintQuota = {
  topic: string;
  difficulty: QuestionData["difficulty"];
  type: QuestionData["type"];
  marks: number;
  count: number;
};
export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  data: jsonb("data").$type<QuestionData>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("questions_owner_idx").on(t.ownerId)]);
export const exams = pgTable("exams", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  subject: text("subject").notNull().default("General"),
  instructions: text("instructions").notNull(),
  duration: integer("duration").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("draft"),
  randomize: boolean("randomize").notNull().default(true),
  passPercent: integer("pass_percent").notNull().default(50),
  totalMarks: doublePrecision("total_marks").notNull().default(0),
  questionSnapshot: jsonb("question_snapshot").$type<QuestionData[]>().notNull().default([]),
  blueprint: jsonb("blueprint").$type<BlueprintQuota[]>().notNull().default([]),
  resultsPublished: boolean("results_published").notNull().default(false),
  assistancePolicy: jsonb("assistance_policy").$type<AssistancePolicyData | null>(),
  deliverySettings: jsonb("delivery_settings").$type<DeliverySettings>().notNull().default({
    requireProctorApproval: false, requireReadiness: false, confirmSubjects: false,
    lockOnSave: false, minimumAttemptPercent: 0, venue: "", sessionLabel: "",
    requireFullscreen: false, maxViolations: 3,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("exams_owner_idx").on(t.ownerId),
  check("exam_window_check", sql`${t.endsAt} > ${t.startsAt}`),
  check("exam_duration_check", sql`${t.duration} > 0 AND ${t.duration} <= 480`),
]);
export const enrollments = pgTable("enrollments", {
  examId: text("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.examId, t.userId] })]);
export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  examId: text("exam_id"),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
