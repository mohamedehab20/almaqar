import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { db } from "@/db";
import { clerkEnabled } from "@/lib/clerk";
import { runAsUser, type Claims, type Ctx } from "./context";
import { AppError } from "./errors";

/**
 * The signed-in Clerk user as JWT-style claims (sub = Clerk user id, email = primary email), or null.
 * The email is what links invites (claim_invites). Cached per request.
 */
export const getClaims = cache(async (): Promise<Claims | null> => {
  if (!clerkEnabled()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  return { sub: userId, email, role: "authenticated" };
});

export async function requireClaims(): Promise<Claims> {
  if (!clerkEnabled()) throw new AppError("not_configured");
  const claims = await getClaims();
  if (!claims) throw new AppError("unauthorized");
  return claims;
}

/** Runs `fn` as the signed-in user with RLS enforced. Use for every read/write made on a user's behalf. */
export async function withUser<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  return runAsUser(db(), await requireClaims(), fn);
}
