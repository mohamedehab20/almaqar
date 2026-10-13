import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const listClients = cache((companyId: string) => withUser((ctx) => svc.listClients(ctx, companyId)));
export const listBriefs = cache((companyId: string) => withUser((ctx) => svc.listBriefs(ctx, { companyId })));
export const listIdeas = cache((companyId: string) => withUser((ctx) => svc.listIdeas(ctx, companyId)));

/** Client portal */
export const getMyClients = cache(() => withUser((ctx) => svc.getMyClients(ctx)));
export const listClientBriefs = cache((clientId: string) => withUser((ctx) => svc.listBriefs(ctx, { clientId })));

/** Marketing → sections */
export const listSocialAccounts = cache((companyId: string) => withUser((ctx) => svc.listSocialAccounts(ctx, { companyId })));
export const listCampaigns = cache((companyId: string) => withUser((ctx) => svc.listCampaigns(ctx, { companyId })));
export const getClientBudgets = cache((companyId: string) => withUser((ctx) => svc.getClientBudgets(ctx, companyId)));
export const getChannelStats = cache((companyId: string) => withUser((ctx) => svc.getChannelStats(ctx, companyId)));

/** Client portal: the client's own campaigns and accounts (read-only) */
export const listClientCampaigns = cache((clientId: string) => withUser((ctx) => svc.listCampaigns(ctx, { clientId })));
export const listClientAccounts = cache((clientId: string) => withUser((ctx) => svc.listSocialAccounts(ctx, { clientId })));

