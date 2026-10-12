"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, localized } from "@/server/validation";
import * as svc from "./service";

const step = z.object({ id: z.string().max(60).optional(), title: localized(120), assigneeId: id });
/** Upload the file first with files/actions uploadAttachment (folder "workflows"), then pass its result here. */
const attachment = z.object({ id: z.string().max(60), name: z.string().max(200), size: z.number().int().min(0), type: z.string().max(100), path: z.string().max(400) });

export const createWorkflow = action(
  companyInput.extend({ name: localized(120), steps: z.array(step).min(1).max(20), attachments: z.array(attachment).max(20).optional() }),
  (input) => withUser((ctx) => svc.createWorkflow(ctx, input)),
);

export const createWorkflowFromTemplate = action(
  companyInput.extend({ templateId: z.string().max(60), assigneeIds: z.array(id).min(1).max(20) }),
  (input) => withUser((ctx) => svc.createWorkflowFromTemplate(ctx, input)),
);

export const updateWorkflow = action(
  z.object({ workflowId: id, name: localized(120).optional(), steps: z.array(step).min(1).max(20).optional(), attachments: z.array(attachment).max(20).optional() }),
  (input) => withUser((ctx) => svc.updateWorkflow(ctx, input)),
);

export const deleteWorkflow = action(z.object({ workflowId: id }), (input) => withUser((ctx) => svc.deleteWorkflow(ctx, input)));

/** Starts a run of an approval workflow (Automation room). */
export const startRun = action(companyInput.extend({ workflowId: id, subject: localized(200), category: z.string().max(30).optional() }), (input) =>
  withUser((ctx) => svc.startOperation(ctx, input)),
);

export const actOnRun = action(
  z.object({ runId: id, action: z.enum(["approve", "reject", "request_changes"]), note: z.string().trim().max(1000).optional() }),
  (input) => withUser((ctx) => svc.actOnRun(ctx, input)),
);
