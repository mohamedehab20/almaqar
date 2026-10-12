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
