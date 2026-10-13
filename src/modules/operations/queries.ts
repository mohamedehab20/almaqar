import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import { listOperations as listOperationsSvc } from "@/modules/automation/service";
import * as svc from "./service";

export const listOperations = cache((companyId: string) => withUser((ctx) => listOperationsSvc(ctx, companyId)));
export const getOperationsStats = cache((companyId: string, days?: number) => withUser((ctx) => svc.getOperationsStats(ctx, companyId, days)));
export const listNotes = cache((companyId: string, departmentId?: string) => withUser((ctx) => svc.listNotes(ctx, companyId, departmentId)));
export const listTasks = cache((companyId: string, assigneeId?: string) => withUser((ctx) => svc.listTasks(ctx, companyId, assigneeId)));
export const listSchedule = cache((companyId: string, from: string, to: string, memberId?: string) =>
  withUser((ctx) => svc.listSchedule(ctx, companyId, { from, to, memberId })),
);
