import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import { signedUrls } from "@/modules/files/storage";
import { listOperations as listOperationsSvc } from "@/modules/automation/service";
import * as svc from "./service";

export const listOperations = cache((companyId: string) => withUser((ctx) => listOperationsSvc(ctx, companyId)));
export const getOperationsStats = cache((companyId: string, days?: number) => withUser((ctx) => svc.getOperationsStats(ctx, companyId, days)));
export const listNotes = cache((companyId: string, departmentId?: string) => withUser((ctx) => svc.listNotes(ctx, companyId, departmentId)));
/** The Operations room, with links to open each file attached to a note. */
export const getOperationsData = cache(async (companyId: string) => {
  const data = await withUser((ctx) => svc.getOperationsData(ctx, companyId));
  const urls = await signedUrls(data.notes.flatMap((n) => (n.attachments ?? []).map((f) => f.path)));
  return { ...data, notes: data.notes.map((n) => ({ ...n, attachments: n.attachments?.map((f) => ({ ...f, url: urls[f.path] })) })) };
});
export const getScheduleBoard = cache((companyId: string) => withUser((ctx) => svc.getScheduleBoard(ctx, companyId)));
export const getTaskBoard = cache((companyId: string) => withUser((ctx) => svc.getTaskBoard(ctx, companyId)));
export const listTasks = cache((companyId: string, assigneeId?: string) => withUser((ctx) => svc.listTasks(ctx, companyId, assigneeId)));
export const listSchedule = cache((companyId: string, from: string, to: string, memberId?: string) =>
  withUser((ctx) => svc.listSchedule(ctx, companyId, { from, to, memberId })),
);
