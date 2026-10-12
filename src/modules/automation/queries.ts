import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const listWorkflows = cache((companyId: string) => withUser((ctx) => svc.listWorkflows(ctx, companyId)));
export const listRuns = cache((companyId: string) => withUser((ctx) => svc.listRuns(ctx, companyId)));
