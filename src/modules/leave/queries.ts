import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getLeaveData = cache((companyId: string) => withUser((ctx) => svc.getLeaveData(ctx, companyId)));
