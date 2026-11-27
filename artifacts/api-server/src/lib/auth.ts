import { betterAuth } from "better-auth";
import { pool } from "@workspace/db";

const baseURL = process.env.BETTER_AUTH_URL ??
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);
if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required for authentication.");

export const auth = betterAuth({
  appName: "Examora",
  secret: process.env.SESSION_SECRET,
  baseURL,
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Enrollment is administrator/examiner managed. Public signups default to candidate.
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "candidate", input: false },
      active: { type: "boolean", defaultValue: true, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 30 },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: { "/sign-in/email": { window: 60, max: 10 } },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: baseURL?.startsWith("https") ? "none" : "lax",
      secure: baseURL?.startsWith("https") ?? true,
      httpOnly: true,
    },
  },
  trustedOrigins: baseURL ? [baseURL] : [],
});
