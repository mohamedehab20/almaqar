import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const listAgents = cache((companyId: string) => withUser((ctx) => svc.listAgents(ctx, companyId)));
