import { Router, type IRouter } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "@workspace/db";
import { db, users } from "@workspace/db";
import { GetSessionResponse } from "@workspace/api-zod";
import { auth } from "../lib/auth";
import { publicUser } from "../lib/access";

const router: IRouter = Router();
router.get("/session", async (req, res): Promise<void> => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const [user] = session ? await db.select().from(users).where(eq(users.id, session.user.id)) : [];
  res.json(GetSessionResponse.parse({ user: user?.active ? publicUser(user) : null, demoEnabled: process.env.DEMO_MODE === "true" }));
});
export default router;
