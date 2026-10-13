"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { action } from "@/server/action";
import { AppError } from "@/server/errors";
import { finishSignIn, type PendingCompany } from "./session";

async function supabase() {
  if (!supabaseEnv()) throw new AppError("not_configured");
  return createClient();
}

const phone = z.string().trim().regex(/^\+?[0-9 ]{8,16}$/).transform((v) => v.replace(/ /g, ""));
const password = z.string().min(8).max(72);

/**
 * Sign-up (signup-form.tsx): creates the auth user and remembers the company on it.
 * If email confirmation is off, the company is created right away; otherwise after the user
 * clicks the email link (/api/auth/confirm) or first signs in.
 */
export const signUp = action(
  z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.email(),
    phone: phone.optional(),
    password,
    company: z.string().trim().min(2).max(100),
    businessType: z.string().max(60).optional(),
    size: z.string().max(30).optional(),
  }),
  async (input) => {
    const client = await supabase();
    const ownerName = `${input.firstName} ${input.lastName}`;
    const pending: PendingCompany = { name: input.company, businessType: input.businessType, size: input.size, ownerName };
    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: ownerName, phone: input.phone, pending_company: pending } },
    });
    if (error) throw new AppError(error.code === "user_already_exists" ? "conflict" : "auth_failed", error.message);
    if (!data.session) return { needsEmailConfirmation: true as const, slug: null };
    return { needsEmailConfirmation: false as const, slug: await finishSignIn(client) };
  },
);

/**
 * Company login and employee login (company-login-form.tsx, login-form.tsx): company code + email + password.
 * Succeeds only if the user is a member of the company with that code; returns its slug.
 */
export const signInWithCompanyCode = action(
  z.object({ companyCode: z.string().trim().min(3).max(20), email: z.email(), password: z.string().min(1).max(72) }),
  async (input) => {
    const client = await supabase();
    const { error } = await client.auth.signInWithPassword({ email: input.email, password: input.password });
    if (error) throw new AppError("auth_failed", error.message);
    await finishSignIn(client);

    const { data: slug } = await client.rpc("company_slug_for_code", { p_code: input.companyCode });
    if (!slug) {
      await client.auth.signOut();
      throw new AppError("forbidden");
    }
    return { slug: slug as string };
  },
);

const visitorContact = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), email: z.email() }),
  z.object({ channel: z.literal("sms"), phone }),
]);
const inviteCode = z.string().trim().min(4).max(20);

/**
 * Visitor login, step 1 (visitor-login-form.tsx): checks the invite code and sends a one-time code
 * by email, or by SMS once an SMS provider is configured in Supabase (Auth > Providers > Phone).
 */
export const sendVisitorOtp = action(z.intersection(z.object({ inviteCode }), visitorContact), async (input) => {
  const client = await supabase();
  const { data: valid } = await client.rpc("invite_exists", { p_code: input.inviteCode });
  if (!valid) throw new AppError("not_found");
  const { error } =
    input.channel === "email"
      ? await client.auth.signInWithOtp({ email: input.email, options: { shouldCreateUser: true } })
      : await client.auth.signInWithOtp({ phone: input.phone, options: { shouldCreateUser: true, channel: "sms" } });
  if (error) throw new AppError("auth_failed", error.message);
  return { sent: true };
});

/** Visitor login, step 2: verifies the code, then gives this user access to the client's portal. */
export const verifyVisitorOtp = action(
  z.intersection(z.object({ inviteCode, token: z.string().trim().regex(/^[0-9]{6}$/) }), visitorContact),
  async (input) => {
    const client = await supabase();
    const { error } =
      input.channel === "email"
        ? await client.auth.verifyOtp({ email: input.email, token: input.token, type: "email" })
        : await client.auth.verifyOtp({ phone: input.phone, token: input.token, type: "sms" });
    if (error) throw new AppError("auth_failed", error.message);
    const { data: clientId, error: redeemError } = await client.rpc("redeem_client_invite", { p_code: input.inviteCode });
    if (redeemError || !clientId) throw new AppError("not_found");
    return { clientId: clientId as string };
  },
);

export const signOut = action(z.object({}), async () => {
  const client = await supabase();
  await client.auth.signOut();
  return { signedOut: true };
});

// ---------- Account self-service ----------

/**
 * "Forgot password": emails a reset link. Always reports success, so the form does not reveal which
 * emails have accounts. The email template must link to /api/auth/confirm?token_hash=…&type=recovery,
 * which signs the user in and opens /reset-password, where updatePassword sets the new one.
 */
export const requestPasswordReset = action(z.object({ email: z.email() }), async ({ email }) => {
  const client = await supabase();
  const { error } = await client.auth.resetPasswordForEmail(email);
  if (error && error.status === 429) throw new AppError("server_error", error.message); // rate limited: worth telling the user to retry later
  return { sent: true };
});

/** New password for the signed-in user (after the reset link, or from account settings). */
export const updatePassword = action(z.object({ password }), async ({ password: newPassword }) => {
  const client = await supabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new AppError("unauthorized");
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new AppError(error.code === "same_password" ? "invalid" : "auth_failed", error.message);
  return { updated: true };
});

/** Account details kept on the auth user (not per company): full name and phone. */
export const updateMyAccount = action(
  z.object({ fullName: z.string().trim().min(1).max(120).optional(), phone: phone.nullable().optional() }),
  async (input) => {
    const client = await supabase();
    const { data } = await client.auth.getUser();
    if (!data.user) throw new AppError("unauthorized");
    const { error } = await client.auth.updateUser({
      data: {
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.phone !== undefined && { phone: input.phone }),
      },
    });
    if (error) throw new AppError("auth_failed", error.message);
    return { updated: true };
  },
);

