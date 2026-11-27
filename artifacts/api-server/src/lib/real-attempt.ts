import { and, eq, isNull, attempts } from "@workspace/db";

/** A candidate's live record for an exam: not a sandbox preview and not archived by an authorized retake. */
export const currentRealAttempt = () => and(eq(attempts.sandbox, false), isNull(attempts.supersededAt));
