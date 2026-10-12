/**
 * Supabase project settings from .env.local (see .env.example).
 * Returns null while the project is not configured, so the app keeps running on mock data.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function requireSupabaseEnv() {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  return env;
}
