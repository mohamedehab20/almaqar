import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getRecruitmentData = cache((companyId: string) => withUser((ctx) => svc.getRecruitmentData(ctx, companyId)));
