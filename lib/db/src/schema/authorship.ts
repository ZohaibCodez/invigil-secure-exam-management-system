import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { attempts } from "./attempts";

export const authorshipReviews = pgTable("authorship_reviews", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  prompt: text("prompt").notNull(),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }).notNull(),
  response: text("response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  outcome: text("outcome"),
  reason: text("reason"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, t => [uniqueIndex("authorship_one_per_question").on(t.attemptId, t.questionId)]);
