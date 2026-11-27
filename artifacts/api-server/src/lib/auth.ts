import { betterAuth } from "better-auth";
import { pool } from "@workspace/db";

// Vercel injects these system variables (hostnames, no scheme) on every deployment.
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
].filter((h): h is string => !!h).map(h => `https://${h}`);
const baseURL = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
  vercelOrigins[0] ??
  (process.env.NODE_ENV !== "production" && process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);
const trustedOrigins = [...new Set([baseURL, ...vercelOrigins].filter((o): o is string => !!o))];
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
  trustedOrigins,
});
