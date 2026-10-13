import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getProfitabilityReport = cache((companyId: string) => withUser((ctx) => svc.getProfitabilityReport(ctx, companyId)));
export const getProfitabilitySettings = cache((companyId: string) => withUser((ctx) => svc.getProfitabilitySettings(ctx, companyId)));
