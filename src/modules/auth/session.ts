import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/server/errors";

/** Company details stored on the auth user at sign-up, until the company is created (after email confirmation). */
export type PendingCompany = { name: string; businessType?: string; size?: string; ownerName: string };

const LATIN = /[^a-z0-9]+/g;

function randomChars(n: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => alphabet[b % alphabet.length]).join("");
}

/** URL slug from the company name (Latin part only; Arabic names get a generic prefix) plus a short random suffix. */
export function makeSlug(name: string) {
  const base = name.toLowerCase().replace(LATIN, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "company";
  return `${base}-${randomChars(4, "abcdefghjkmnpqrstuvwxyz23456789")}`;
}

/** Code employees type on the company login page. */
export const makeCompanyCode = () => randomChars(6);

/**
 * Runs after every successful sign-in (password, OTP or email link):
 * links pending member invites, and creates the company the user registered at sign-up if it does not exist yet.
 * Returns the slug to open, if any.
 */
export async function finishSignIn(supabase: SupabaseClient): Promise<string | null> {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) throw new AppError("unauthorized");
  const user = userData.user;

  await supabase.rpc("claim_invites");

  const pending = user.user_metadata?.pending_company as PendingCompany | undefined;
  if (pending) {
    // A unique-violation on slug/code is very unlikely; retry once with fresh values.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error: createError } = await supabase.rpc("create_company", {
        p_slug: makeSlug(pending.name),
        p_code: makeCompanyCode(),
        p_name: { ar: pending.name, en: pending.name },
        p_owner_name: { ar: pending.ownerName, en: pending.ownerName },
      });
      if (!createError) break;
      if (createError.code !== "23505" || attempt === 1) throw new AppError("server_error", createError.message);
    }
    await supabase.auth.updateUser({ data: { pending_company: null } });
  }

  const { data: memberships } = await supabase
    .from("members")
    .select("companies(slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const company = memberships?.[0]?.companies as unknown as { slug: string } | null | undefined;
  return company?.slug ?? null;
}
