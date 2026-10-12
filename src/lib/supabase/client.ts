import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** Supabase client for Client Components. Runs as the signed-in user, so RLS applies. */
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}
