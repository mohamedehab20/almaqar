import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase auth session on every request and writes the updated
 * cookies onto `response` (the one next-intl already built). No-op until Supabase is configured.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const env = supabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Validates the token with Supabase and triggers a refresh when it is about to expire.
  await supabase.auth.getUser();
  return response;
}
