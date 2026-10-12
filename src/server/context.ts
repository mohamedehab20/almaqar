import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "@/db/schema";

/** Any Drizzle Postgres database or transaction over our schema (postgres-js in the app, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** What every service function receives: a transaction running as the user (RLS applies), and who they are. */
export type Ctx = { tx: Db; userId: string };

/** Verified JWT claims of the signed-in user (from supabase.auth.getClaims()). */
export type Claims = { sub: string; email?: string; [key: string]: unknown };

/**
 * Runs `fn` in a transaction that Postgres treats exactly like a Supabase API request from this user:
 * role `authenticated` and the JWT claims set, so auth.uid() works and every RLS policy applies.
 * Kept free of Next.js imports so tests can call it with a PGlite database.
 */
export async function runAsUser<T>(database: Db, claims: Claims, fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select
      set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
      set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn({ tx, userId: claims.sub });
  });
}
