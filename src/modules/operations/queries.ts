import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import { listOperations as listOperationsSvc } from "@/modules/automation/service";
import * as svc from "./service";

export const listOperations = cache((companyId: string) => withUser((ctx) => listOperationsSvc(ctx, companyId)));
export const listNotes = cache((companyId: string, departmentId?: string) => withUser((ctx) => svc.listNotes(ctx, companyId, departmentId)));
