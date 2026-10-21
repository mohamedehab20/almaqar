import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import { signedUrls } from "@/modules/files/storage";
import * as svc from "./service";

export const listWorkflows = cache((companyId: string) => withUser((ctx) => svc.listWorkflows(ctx, companyId)));
export const listRuns = cache((companyId: string) => withUser((ctx) => svc.listRuns(ctx, companyId)));

/** Automation room → automated flows and header figures */
export const listFlows = cache((companyId: string) => withUser((ctx) => svc.listFlows(ctx, companyId)));
export const getAutomationStats = cache((companyId: string) => withUser((ctx) => svc.getAutomationStats(ctx, companyId)));


/** The whole Automation room, with links to open the files attached to workflows. */
export const getAutomationData = cache(async (companyId: string) => {
  const data = await withUser((ctx) => svc.getAutomationData(ctx, companyId));
  const urls = await signedUrls(data.workflows.flatMap((w) => (w.attachments ?? []).map((a) => a.url)));
  return { ...data, workflows: data.workflows.map((w) => ({ ...w, attachments: w.attachments?.map((a) => ({ ...a, url: urls[a.url] ?? "" })) })) };
});
