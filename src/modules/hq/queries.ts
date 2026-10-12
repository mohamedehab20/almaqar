import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

/** Reads for Server Components, run as the signed-in user (RLS). cache() dedupes calls within one request. */
export const getCompanyBySlug = cache((slug: string) => withUser((ctx) => svc.getCompanyBySlug(ctx, slug)));
export const listMyCompanies = cache(() => withUser((ctx) => svc.listMyCompanies(ctx)));
export const listMembers = cache((companyId: string) => withUser((ctx) => svc.listMembers(ctx, companyId)));
export const listDepartments = cache((companyId: string) => withUser((ctx) => svc.listDepartments(ctx, companyId)));
export const getFloorPlan = cache((companyId: string) => withUser((ctx) => svc.getFloorPlan(ctx, companyId)));
