import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
// Export operators from the same Drizzle instance as the schema. Optional peer
// dependencies can otherwise cause pnpm to resolve two nominal SQL type copies.
export { and, eq, asc, desc, inArray, isNull, sql } from "drizzle-orm";
