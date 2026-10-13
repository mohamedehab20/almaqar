import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const listWorkflows = cache((companyId: string) => withUser((ctx) => svc.listWorkflows(ctx, companyId)));
export const listRuns = cache((companyId: string) => withUser((ctx) => svc.listRuns(ctx, companyId)));

/** Automation room → automated flows and header figures */
export const listFlows = cache((companyId: string) => withUser((ctx) => svc.listFlows(ctx, companyId)));
export const getAutomationStats = cache((companyId: string) => withUser((ctx) => svc.getAutomationStats(ctx, companyId)));

