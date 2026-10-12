import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Direct Postgres connection for trusted server code only (migrations, seeding,
 * background jobs). It connects as the database owner and BYPASSES Row Level Security —
 * never use it for a request made on behalf of a user; use src/lib/supabase/server.ts instead.
 */
let instance: ReturnType<typeof createDb> | undefined;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  // prepare: false — required by Supabase's transaction pooler (port 6543)
  return drizzle(postgres(url, { prepare: false }), { schema });
}

export function db() {
  instance ??= createDb();
  return instance;
}
