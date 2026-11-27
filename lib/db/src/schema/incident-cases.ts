import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./auth";
import { attempts } from "./attempts";

// One immutable statement and one immutable decision per attempt. Retries cannot
// create competing cases or overwrite the evidence used for a decision.
export const incidentCases = pgTable("incident_cases", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  statement: text("statement").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewerId: text("reviewer_id").references(() => users.id),
  reviewerName: text("reviewer_name"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reason: text("reason"),
  disposition: text("disposition").$type<"no_action" | "supervised_resit_recommended" | "referred_for_review">(),
}, t => [uniqueIndex("incident_case_attempt_unique").on(t.attemptId)]);

export const insertIncidentCaseSchema = createInsertSchema(incidentCases).omit({ id: true, submittedAt: true });
export type IncidentCaseRow = typeof incidentCases.$inferSelect;
export type InsertIncidentCase = typeof incidentCases.$inferInsert;
