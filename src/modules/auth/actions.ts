"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseEnv } from "@/lib/supabase/env";
import { action } from "@/server/action";
import { AppError } from "@/server/errors";
import { claimInvitesAndListCompanies, createOwnCompany } from "./session";

/*
 * Accounts, sign-in, sign-up, email verification, password reset and sign-out are handled by Clerk
 * (<SignIn>, <SignUp>, <UserButton> on our pages). What happens after signing in — linking invites,
 * creating a new owner's company, client portal access — is in /api/auth/after-sign-in.
 */

/**
 * A signed-in person with no company creates their own (saved in the database, they become its owner).
 * Returns the new company's slug so the page can open it.
 */
export const createMyCompany = action(
  z.object({ name: z.string().trim().min(2).max(80), ownerName: z.string().trim().min(2).max(80) }),
  async ({ name, ownerName }) => {
    const before = new Set((await claimInvitesAndListCompanies()).map((c) => c.slug));
    await createOwnCompany({ name, ownerName });
    const created = (await claimInvitesAndListCompanies()).find((c) => !before.has(c.slug));
    if (!created) throw new AppError("server_error");
    return { slug: created.slug };
  },
);

/**
 * Visitor login, step 1: is this client invite code valid? Runs before the visitor has an account,
 * through the public API (anon key): public.invite_exists is the only thing anon may call.
 */
export const checkInviteCode = action(z.object({ inviteCode: z.string().trim().min(4).max(20) }), async ({ inviteCode }) => {
  const env = supabaseEnv();
  if (!env) throw new AppError("not_configured");
  const anon = createClient(env.url, env.key, { auth: { persistSession: false } });
  const { data, error } = await anon.rpc("invite_exists", { p_code: inviteCode });
  if (error) throw new AppError("server_error", error.message);
  if (!data) throw new AppError("not_found");
  return { inviteCode: inviteCode.toUpperCase() };
});
