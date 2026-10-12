/**
 * In-memory Postgres (PGlite) with the pieces of Supabase our migrations rely on:
 * the anon/authenticated roles and auth.uid() / auth.jwt() reading the request claims.
 * Applies every migration in drizzle/ exactly as `npm run db:migrate` would.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../../src/db/schema";
import { runAsUser, type Claims, type Ctx, type Db } from "../../src/server/context";

const MIGRATIONS = join(import.meta.dirname, "../../drizzle");

export async function createTestDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO authenticated, anon;
  `);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await pg.exec(statement);
    }
  }
  // Supabase grants these to the API roles by default; RLS does the rest.
  await pg.exec(`
    GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
  `);

  const db = drizzle(pg, { schema }) as unknown as Db;

  /** Runs `fn` as this user, the same way withUser() does in the app. */
  const as = <T>(claims: Claims, fn: (ctx: Ctx) => Promise<T>) => runAsUser(db, claims, fn);

  /** Raw SQL as a user (or anon when `uid` is null), for policy tests. */
  async function sqlAs(uid: string | null, query: string, params: unknown[] = [], email = "") {
    const claims = uid ? JSON.stringify({ sub: uid, email }) : "";
    await pg.exec(
      `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false), set_config('request.jwt.claims', '${claims}', false); SET ROLE ${uid ? "authenticated" : "anon"};`,
    );
    try {
      return (await pg.query<Record<string, unknown>>(query, params)).rows;
    } finally {
      await pg.exec("RESET ROLE");
    }
  }

  return { pg, db, as, sqlAs };
}

let n = 0;
/** A fresh user id (and matching claims) for each call. */
export function user(email?: string): Claims {
  n++;
  return { sub: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, email: email ?? `user${n}@test.local` };
}

export const L = (s: string) => ({ ar: s, en: s });
