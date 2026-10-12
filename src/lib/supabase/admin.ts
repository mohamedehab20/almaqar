import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Supabase client with the secret key: bypasses RLS and can manage auth users (e.g. send invites).
 * Server-only. Returns null when SUPABASE_SECRET_KEY is not set, so callers can degrade gracefully.
 */
export function createAdminClient() {
  const env = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) return null;
  return createClient(env.url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}
