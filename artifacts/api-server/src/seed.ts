import { randomUUID } from "node:crypto";
import { db, pool, users, exams, questions, attempts, enrollments, activities, announcements, eq, type QuestionData, type AnswerData } from "@workspace/db";
import { auth } from "./lib/auth";
import { logger } from "./lib/logger";
import { objectiveScore, reportToken } from "./lib/attempts";

async function main() {
  if (process.env.DEMO_MODE !== "true") throw new Error("Demo seeding is disabled. Explicitly enable DEMO_MODE for a fictional demonstration environment.");
  const people = [
    { name: "Alex Morgan", email: "examiner@examora.demo", role: "examiner" },
    { name: "Jamie Parker", email: "candidate@examora.demo", role: "candidate" },
    { name: "Platform Administrator", email: "admin@examora.demo", role: "admin" },
    { name: "Sam Rivera", email: "sam@examora.demo", role: "candidate" },
    { name: "Taylor Chen", email: "taylor@examora.demo", role: "candidate" },
  ];
  const ids = new Map<string, string>();
  for (const person of people) {
    let [user] = await db.select().from(users).where(eq(users.email, person.email));
    if (!user) {
      const created = await auth.api.signUpEmail({ body: { name: person.name, email: person.email, password: "ExamoraDemo2026!" } });
      [user] = await db.update(users).set({ role: person.role, emailVerified: true }).where(eq(users.id, created.user.id)).returning();
    }
    ids.set(person.email, user!.id);
  }
  const ownerId = ids.get("examiner@examora.demo")!;
  const opts = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
  const bank: QuestionData[] = [
    { id: "demo-q-semantic", text: "Which HTML element best represents a self-contained piece of content that could be distributed independently?", type: "single", category: "Web Engineering", difficulty: "easy", marks: 5, options: opts("<div>", "<article>", "<span>", "<section>"), correctAnswers: ["b"], explanation: "The article element represents self-contained, independently distributable content." },
    { id: "demo-q-security", text: "Which practices help protect a web application from common security vulnerabilities? Select all that apply.", type: "multiple", category: "Web Security", difficulty: "medium", marks: 5, options: opts("Validate and sanitize inputs on the server", "Store passwords in plain text", "Use parameterized database queries", "Trust all client-supplied permissions"), correctAnswers: ["a", "c"], explanation: "Server validation and parameterized queries reduce injection risks. Authorization must also be enforced server-side." },
    { id: "demo-q-http", text: "Which HTTP status code should an API return when an authenticated user lacks permission to perform an action?", type: "single", category: "Web Engineering", difficulty: "easy", marks: 5, options: opts("200 OK", "401 Unauthorized", "403 Forbidden", "500 Internal Server Error"), correctAnswers: ["c"], explanation: "403 indicates insufficient authorization; 401 is used when authentication is required." },
    { id: "demo-q-transactions", text: "An examination platform must prevent duplicate submissions arriving at the same time. Which database approach is most appropriate?", type: "single", category: "Database Systems", difficulty: "hard", marks: 5, options: opts("Disable the submit button only", "Use a transaction with a locked attempt row and idempotent state transition", "Trust timestamps supplied by the browser", "Store the submission in browser memory"), correctAnswers: ["b"], explanation: "Transactional locking and idempotent transitions protect against concurrent and repeated requests." },
    { id: "demo-q-written", text: "Explain why an examination timer must be enforced by the server rather than trusting a candidate's device clock. Describe one fair policy for answers synchronized after the deadline.", type: "written", category: "Web Security", difficulty: "medium", marks: 10, options: [], correctAnswers: [], explanation: "The device clock is untrusted. Late unsynchronized work can be retained as unverified evidence but should not automatically receive credit." },
    { id: "demo-q-accessibility", text: "Which choices improve accessibility in a timed examination workspace? Select all that apply.", type: "multiple", category: "Accessibility", difficulty: "medium", marks: 5, options: opts("Keyboard-operable navigation", "Color-only answer status indicators", "Readable text with sufficient contrast", "Meaningful labels for input controls"), correctAnswers: ["a", "c", "d"], explanation: "Keyboard access, contrast, and meaningful labels improve access. Color must not be the only signal." },
  ];
  for (const data of bank) await db.insert(questions).values({ id: data.id, ownerId, data }).onConflictDoNothing();
  const now = Date.now(), day = 86400000;
  const templates = [
    { id: "demo-exam-live", title: "Web Engineering Fundamentals", subject: "Computer Science", duration: 45, status: "published", startsAt: new Date(now - day), endsAt: new Date(now + 7 * day), questionSnapshot: bank, resultsPublished: false, createdAt: new Date(now - 2 * day) },
    { id: "demo-exam-upcoming", title: "Database Systems & Design", subject: "Database Systems", duration: 60, status: "published", startsAt: new Date(now + day), endsAt: new Date(now + 2 * day), questionSnapshot: bank.filter(q => ["demo-q-transactions", "demo-q-security", "demo-q-written"].includes(q.id)), resultsPublished: false, createdAt: new Date(now - day) },
    { id: "demo-exam-completed", title: "Introduction to Cybersecurity", subject: "Web Security", duration: 30, status: "completed", startsAt: new Date(now - 4 * day), endsAt: new Date(now - 3 * day), questionSnapshot: bank.slice(0, 5), resultsPublished: true, createdAt: new Date(now - 5 * day) },
  ];
  for (const e of templates) {
    await db.insert(exams).values({
      ...e, ownerId, instructions: "Read each question carefully. Multiple-select questions use exact-match marking: all correct options and no incorrect options must be selected. Your answers save automatically. The server controls the deadline; reconnect before it expires to synchronize local work. Written responses are reviewed by your examiner.",
      totalMarks: e.questionSnapshot.reduce((s, q) => s + q.marks, 0), randomize: true, passPercent: 50,
    }).onConflictDoNothing();
    for (const person of people.filter(p => p.role === "candidate")) {
      await db.insert(enrollments).values({ examId: e.id, userId: ids.get(person.email)! }).onConflictDoNothing();
    }
  }
  const historical = templates[2]!;
  for (const [index, email] of ["candidate@examora.demo", "sam@examora.demo", "taylor@examora.demo"].entries()) {
    const answers: AnswerData[] = historical.questionSnapshot.map((q, i) => {
      const value = q.type === "written"
        ? "A candidate controls their device clock, so a browser-only timer is not authoritative. The server must record a fixed deadline. Work received after expiry can be kept separately for examiner review, but cannot automatically receive marks."
        : JSON.stringify(index === 1 && i % 2 === 0 ? [q.options[0]!.id] : q.correctAnswers);
      return { questionId: q.id, value, markedForReview: false, revision: 1, score: q.type === "written" ? (index === 2 ? 10 : 8) : objectiveScore(q, value), feedback: q.type === "written" ? "A clear explanation of trusted timing and a fair recovery policy." : null };
    });
    await db.insert(attempts).values({
      id: `demo-result-${index}`, examId: historical.id, userId: ids.get(email)!, status: "graded",
      questions: historical.questionSnapshot, answers, totalMarks: 30, score: answers.reduce((s, a) => s + (a.score ?? 0), 0),
      startedAt: new Date(now - 4 * day + 60000), deadline: new Date(now - 4 * day + 31 * 60000),
      submittedAt: new Date(now - 4 * day + 25 * 60000), lastSavedAt: new Date(now - 4 * day + 24 * 60000),
      verificationToken: reportToken(), reportIssuedAt: new Date(now - 3 * day),
    }).onConflictDoNothing();
  }
  const [activity] = await db.select({ id: activities.id }).from(activities).where(eq(activities.id, "demo-activity-published"));
  if (!activity) {
    await db.insert(activities).values([
      { id: "demo-activity-published", ownerId, examId: "demo-exam-live", title: "Examination published", detail: "Web Engineering Fundamentals is ready for candidates", type: "exam", createdAt: new Date(now - 30 * 60000) },
      { id: "demo-activity-results", ownerId, examId: historical.id, title: "Results published", detail: "Introduction to Cybersecurity · 3 verified reports issued", type: "result", createdAt: new Date(now - 3 * day) },
      { id: "demo-activity-enrolled", ownerId, examId: "demo-exam-live", title: "Candidates enrolled", detail: "3 candidates assigned to Web Engineering Fundamentals", type: "enrollment", createdAt: new Date(now - 60 * 60000) },
    ]);
    await db.insert(announcements).values({ id: randomUUID(), examId: "demo-exam-live", message: "Welcome. Your answers are saved automatically. If your connection drops, keep this tab open and reconnect before your deadline." });
  }
  logger.info("Fictional demonstration data is ready. Demo login details are documented in README.md.");
}
main().then(() => pool.end()).catch(async error => { logger.error({ name: error?.name, message: error?.message }, "Demo seed failed"); await pool.end(); process.exitCode = 1; });
