import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { clerkEnabled } from "@/lib/clerk";

/**
 * Emails a Clerk invitation: a link to create an account with this address, which lands on `path` of this
 * site (with the language prefix). false when it could not be sent (Clerk off, or the address already has
 * an account: they simply sign in).
 */
export async function emailInvite(email: string, path: string, locale: "ar" | "en") {
  if (!clerkEnabled()) return false;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return false;
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({ emailAddress: email, redirectUrl: `${origin}${locale === "en" ? "/en" : ""}${path}`, ignoreExisting: true, notify: true });
    return true;
  } catch {
    return false;
  }
}
