import "server-only";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { runAsUser, type Claims, type Ctx } from "./context";
import { AppError } from "./errors";

/** Verified claims of the signed-in user, or null. */
export async function getClaims(): Promise<Claims | null> {
  if (!supabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims as Claims | undefined) ?? null;
}

export async function requireClaims(): Promise<Claims> {
  if (!supabaseEnv()) throw new AppError("not_configured");
  const claims = await getClaims();
  if (!claims) throw new AppError("unauthorized");
  return claims;
}

/** Runs `fn` as the signed-in user with RLS enforced. Use for every read/write made on a user's behalf. */
export async function withUser<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  return runAsUser(db(), await requireClaims(), fn);
}
