import { pgTable, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { exams } from "./exams";
import { users } from "./auth";
import { attempts } from "./attempts";

/** A QR identifies a request, never an authenticated session or an admission grant. */
export const admissions = pgTable("admissions", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  candidateId: text("candidate_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by").references(() => users.id),
  reason: text("reason").notNull().default(""),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  attemptId: text("attempt_id").references(() => attempts.id),
}, t => [
  index("admissions_candidate_exam_idx").on(t.candidateId, t.examId),
  index("admissions_exam_status_idx").on(t.examId, t.status),
  check("admissions_status_check", sql`${t.status} IN ('pending','approved','denied','consumed','expired')`),
  check("admissions_window_check", sql`${t.expiresAt} > ${t.requestedAt}`),
]);
