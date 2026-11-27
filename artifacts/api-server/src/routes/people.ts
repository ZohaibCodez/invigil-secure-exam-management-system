import { Router, type IRouter } from "express";
import { and, eq, desc } from "@workspace/db";
import { fromNodeHeaders } from "better-auth/node";
import { db, users, questions, sessions } from "@workspace/db";
import {
  CreateQuestionBody, UpdateQuestionBody, CreateUserBody, UpdateUserBody, ImportDataBody,
  ListQuestionsResponse, ListUsersResponse,
} from "@workspace/api-zod";
import { auth } from "../lib/auth";
import { requireAdmin, requireStaff, publicUser, paramId, HttpError, audit } from "../lib/access";
import { newQuestion, validateQuestion } from "../lib/examination";

const router: IRouter = Router();
router.get("/questions", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const rows = await db.select().from(questions).where(req.appUser.role === "admin" ? undefined : eq(questions.ownerId, req.appUser.id)).orderBy(desc(questions.createdAt));
  res.json(ListQuestionsResponse.parse(rows.map(q => ({ ...q.data, createdAt: q.createdAt.toISOString() }))));
});
router.post("/questions", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const row = newQuestion(CreateQuestionBody.parse(req.body), req.appUser.id);
  await db.insert(questions).values(row);
  await audit(req.appUser.id, "Question added to bank", row.data.category, "question");
  res.status(201).json(row.data);
});
router.patch("/questions/:id", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const id = paramId(req);
  const [row] = await db.select().from(questions).where(eq(questions.id, id));
  if (!row) throw new HttpError(404, "Question not found.");
  if (req.appUser.role !== "admin" && row.ownerId !== req.appUser.id) throw new HttpError(403, "This question belongs to another examiner.");
  const data = { ...validateQuestion(UpdateQuestionBody.parse(req.body)), id };
  await db.update(questions).set({ data }).where(eq(questions.id, id));
  res.json(data);
});
router.delete("/questions/:id", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const id = paramId(req);
  const [row] = await db.select().from(questions).where(eq(questions.id, id));
  if (!row) throw new HttpError(404, "Question not found.");
  if (req.appUser.role !== "admin" && row.ownerId !== req.appUser.id) throw new HttpError(403, "This question belongs to another examiner.");
  await db.delete(questions).where(eq(questions.id, id));
  res.json({ message: "Question removed from bank. Existing exam snapshots are unchanged." });
});
router.get("/users", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const rows = await db.select().from(users).where(req.appUser.role === "admin" ? undefined : eq(users.role, "candidate")).orderBy(desc(users.createdAt));
  res.json(ListUsersResponse.parse(rows.map(publicUser)));
});
router.post("/users", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const input = CreateUserBody.parse(req.body);
  if (req.appUser.role !== "admin" && input.role !== "candidate") throw new HttpError(403, "Only an administrator can create staff accounts.");
  const email = input.email.toLowerCase().trim();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) throw new HttpError(409, "An account with that email already exists.");
  const created = await auth.api.signUpEmail({ body: { name: input.name, email, password: input.password } });
  const [user] = await db.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, created.user.id)).returning();
  res.status(201).json(publicUser(user!));
});
router.patch("/users/:id", async (req, res): Promise<void> => {
  requireAdmin(req.appUser);
  const id = paramId(req);
  const input = UpdateUserBody.parse(req.body);
  if (id === req.appUser.id && (input.active === false || (input.role && input.role !== "admin"))) throw new HttpError(400, "You cannot remove your own administrator access.");
  const [user] = await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  if (!user) throw new HttpError(404, "User not found.");
  if (input.active === false || input.role) await db.delete(sessions).where(eq(sessions.userId, id));
  res.json(publicUser(user));
});

function parseImportRow(row: Record<string, unknown>, kind: string) {
  if (kind === "candidates") return CreateUserBody.parse({ ...row, role: "candidate" });
  let options = row.options;
  let correctAnswers = row.correctAnswers;
  if (typeof options === "string") {
    try { options = JSON.parse(options); } catch { options = options.split("|").map((text, i) => ({ id: String.fromCharCode(97 + i), text: text.trim() })); }
  }
  if (typeof correctAnswers === "string") {
    try { correctAnswers = JSON.parse(correctAnswers); } catch { correctAnswers = correctAnswers.split("|").map(v => v.trim()).filter(Boolean); }
  }
  return validateQuestion({ ...row, marks: Number(row.marks), options: options ?? [], correctAnswers: correctAnswers ?? [] });
}
router.post("/imports", async (req, res): Promise<void> => {
  requireStaff(req.appUser);
  const input = ImportDataBody.parse(req.body);
  const errors: { row: number; message: string }[] = [];
  const valid: unknown[] = [];
  const emails = new Set<string>();
  for (const [i, raw] of input.rows.entries()) {
    try {
      const row = parseImportRow(raw, input.kind);
      if ("email" in row) {
        const email = row.email.toLowerCase().trim();
        if (emails.has(email)) throw new Error("Duplicate email in import.");
        emails.add(email);
        const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
        if (exists) throw new Error("Email already has an account.");
      }
      valid.push(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid row.";
      errors.push({ row: i + 1, message: message.slice(0, 600) });
    }
  }
  if (!input.commit || errors.length) { res.json({ valid: valid.length, imported: 0, errors }); return; }
  let imported = 0;
  if (input.kind === "questions") {
    if (valid.length) await db.insert(questions).values(valid.map(row => newQuestion(row, req.appUser.id)));
    imported = valid.length;
  } else {
    // Better Auth owns password hashing/account creation. Report any partial failure explicitly.
    for (const [i, row] of valid.entries()) {
      try {
        const candidate = CreateUserBody.parse(row);
        await auth.api.signUpEmail({ body: { name: candidate.name, email: candidate.email.toLowerCase().trim(), password: candidate.password } });
        imported++;
      } catch { errors.push({ row: i + 1, message: "Account creation failed; it may have been created by another request. Earlier successful rows were retained." }); }
    }
  }
  await audit(req.appUser.id, "Bulk import completed", `${imported} ${input.kind} imported`, "import");
  res.json({ valid: valid.length, imported, errors });
});
export default router;
