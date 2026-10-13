import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { finishSignIn } from "@/modules/auth/session";

/**
 * Target of Supabase email links (sign-up confirmation, invites, magic links).
 * Set the email templates to: {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=<type>
 * Verifies the token, finishes sign-in (creates the pending company, claims invites) and opens the company.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fail = NextResponse.redirect(new URL("/login?error=link", origin));

  if (!supabaseEnv() || !tokenHash || !type) return fail;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return fail;

  // Password reset link: the user is now signed in and chooses a new password there
  if (type === "recovery") return NextResponse.redirect(new URL("/reset-password", origin));

  const slug = await finishSignIn(supabase).catch(() => null);
  return NextResponse.redirect(new URL(slug ? `/c/${slug}` : "/", origin));
}
