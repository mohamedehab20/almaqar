import "server-only";
import { cache } from "react";
import { getClaims, withUser } from "@/server/session";
import * as svc from "./service";
import { listActivity as listActivitySvc } from "@/modules/events/service";

/** Reads for Server Components, run as the signed-in user (RLS). cache() dedupes calls within one request. */
export const getCompanyBySlug = cache((slug: string) => withUser((ctx) => svc.getCompanyBySlug(ctx, slug)));
export const listMyCompanies = cache(() => withUser((ctx) => svc.listMyCompanies(ctx)));
export const listMembers = cache((companyId: string) => withUser((ctx) => svc.listMembers(ctx, companyId)));
export const listDepartments = cache((companyId: string) => withUser((ctx) => svc.listDepartments(ctx, companyId)));
/** Main hall activity panel */
export const listActivity = cache((companyId: string, limit?: number) => withUser((ctx) => listActivitySvc(ctx, companyId, limit)));
export const getFloorPlan = cache((companyId: string) => withUser((ctx) => svc.getFloorPlan(ctx, companyId)));

/**
 * The company at /c/<slug> for the signed-in user:
 * - undefined: nobody is signed in (or Supabase is not configured)
 * - null: signed in, but not a member of that company
 * - { company, me }: signed in and a member
 */
export const getSignedInCompany = cache(async (slug: string) => {
  if (!(await getClaims())) return undefined;
  return withUser((ctx) => svc.getCompanyBySlug(ctx, slug));
});
