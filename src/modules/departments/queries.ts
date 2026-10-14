import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getDepartmentsData = cache((companyId: string) => withUser((ctx) => svc.getDepartmentsData(ctx, companyId)));
export const getDisabledRooms = cache((companyId: string) => withUser((ctx) => svc.disabledRooms(ctx, companyId)));
