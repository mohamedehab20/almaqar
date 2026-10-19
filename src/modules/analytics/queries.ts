import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getAnalyticsData = cache((companyId: string, month?: string) => withUser((ctx) => svc.getAnalyticsData(ctx, companyId, month)));
