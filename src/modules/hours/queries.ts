import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getCompanyTimeZone = cache((companyId: string) => withUser((ctx) => svc.getCompanyTimeZone(ctx, companyId)));
export const getWorkHoursData = cache((companyId: string, month?: string) => withUser((ctx) => svc.getWorkHoursData(ctx, companyId, month)));
