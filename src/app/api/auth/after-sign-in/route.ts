import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { clerkEnabled } from "@/lib/clerk";
import { claimInvitesAndListCompanies, createOwnCompany, redeemClientInvite, type PendingCompany } from "@/modules/auth/session";

/**
 * Where every Clerk sign-in / sign-up lands (forceRedirectUrl). In order:
 * 1. a new owner's company (from the sign-up form, kept in unsafeMetadata.pending_company) is created;
 * 2. invites sent to this email are linked;
 * 3. a client-portal invite code (?invite=) is redeemed → /client-portal;
 * 4. the user's company opens, or /join explains that nobody has invited this email yet.
 * ?locale=en keeps English pages in English.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const prefix = searchParams.get("locale") === "en" ? "/en" : "";
  const go = (path: string) => NextResponse.redirect(new URL(`${prefix}${path}`, origin));

  if (!clerkEnabled()) return go("/login");
  const user = await currentUser();
  if (!user) return go("/login");

  const pending = user.unsafeMetadata?.pending_company as PendingCompany | undefined;
  if (pending?.name) {
    await createOwnCompany({ ...pending, ownerName: pending.ownerName || user.fullName || pending.name });
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, { unsafeMetadata: { pending_company: null } });
  }

  const companies = await claimInvitesAndListCompanies();

  const invite = searchParams.get("invite");
  if (invite) {
    try {
      await redeemClientInvite(invite);
      return go("/client-portal");
    } catch {
      return go("/visitor-login?error=invite");
    }
  }

  if (companies.length > 0) return go(`/c/${companies[0].slug}`);
  return go("/join?status=no-invite");
}
