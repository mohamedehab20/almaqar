import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/server/session";
import { listMyCompanies } from "@/modules/hq/service";

/** Company details a new owner enters before creating their Clerk account (kept in Clerk unsafeMetadata). */
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

const isUniqueViolation = (e: unknown) => /23505|duplicate key/.test(String((e as { cause?: unknown })?.cause ?? e));

/** Creates the owner's company (the caller becomes its owner). Retries once if the random slug/code collides. */
export async function createOwnCompany(pending: PendingCompany) {
  const name = JSON.stringify({ ar: pending.name, en: pending.name });
  const owner = JSON.stringify({ ar: pending.ownerName, en: pending.ownerName });
  for (let attempt = 0; ; attempt++) {
    try {
      return await withUser(({ tx }) =>
        tx.execute(sql`select public.create_company(${makeSlug(pending.name)}, ${makeCompanyCode()}, ${name}::jsonb, ${owner}::jsonb)`),
      );
    } catch (error) {
      if (attempt > 0 || !isUniqueViolation(error)) throw error;
    }
  }
}

/** Links pending member invites to this user (by email) and returns the companies they belong to. */
export async function claimInvitesAndListCompanies() {
  return withUser(async (ctx) => {
    await ctx.tx.execute(sql`select public.claim_invites()`);
    return listMyCompanies(ctx);
  });
}

/** Client portal: gives this user access to the client with that invite code. */
export async function redeemClientInvite(code: string) {
  return withUser(({ tx }) => tx.execute(sql`select public.redeem_client_invite(${code})`));
}
