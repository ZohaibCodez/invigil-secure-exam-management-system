import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, desc } from "@workspace/db";
import { db, users, exams, enrollments, activities } from "@workspace/db";
import { auth } from "./auth";
import { randomUUID } from "node:crypto";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type AppUser = typeof users.$inferSelect;
declare global {
  namespace Express {
    interface Request { appUser: AppUser; }
  }
}
export function requireStaff(user: AppUser) {
  if (user.role !== "admin" && user.role !== "examiner") throw new HttpError(403, "Examiner access is required.");
}
export function requireAdmin(user: AppUser) {
  if (user.role !== "admin") throw new HttpError(403, "Administrator access is required.");
}
export async function authenticated(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new HttpError(401, "Please sign in to continue.");
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!user?.active) throw new HttpError(403, "This account has been deactivated.");
    req.appUser = user;
    next();
  } catch (error) { next(error); }
}
export const publicUser = (u: AppUser) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt.toISOString(),
});
export async function ownedExam(id: string, user: AppUser, write = true) {
  const [exam] = await db.select().from(exams).where(eq(exams.id, id));
  if (!exam) throw new HttpError(404, "Examination not found.");
  if (user.role === "candidate") {
    if (write || exam.status === "draft") throw new HttpError(403, "You do not have access to this examination.");
    const [enrollment] = await db.select().from(enrollments).where(and(eq(enrollments.examId, id), eq(enrollments.userId, user.id)));
    if (!enrollment) throw new HttpError(403, "You are not enrolled in this examination.");
  } else if (user.role !== "admin" && exam.ownerId !== user.id) {
    throw new HttpError(403, "This examination belongs to another examiner.");
  }
  return exam;
}
export async function visibleExams(user: AppUser) {
  if (user.role === "admin") return db.select().from(exams).orderBy(desc(exams.createdAt));
  if (user.role === "examiner") return db.select().from(exams).where(eq(exams.ownerId, user.id)).orderBy(desc(exams.createdAt));
  const rows = await db.select({ exam: exams }).from(enrollments).innerJoin(exams, eq(exams.id, enrollments.examId))
    .where(eq(enrollments.userId, user.id)).orderBy(desc(exams.createdAt));
  return rows.map(r => r.exam).filter(e => e.status !== "draft");
}
export async function audit(ownerId: string, title: string, detail: string, type: string, examId?: string) {
  await db.insert(activities).values({ id: randomUUID(), ownerId, title, detail, type, examId });
}
export const paramId = (req: Request, key = "id") => {
  const value = req.params[key];
  if (typeof value !== "string" || !value || value.length > 150) throw new HttpError(400, "Invalid identifier.");
  return value;
};
