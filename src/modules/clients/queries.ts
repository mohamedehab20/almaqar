import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getClientPortalData = cache((companyId: string) => withUser((ctx) => svc.getClientPortalData(ctx, companyId)));
