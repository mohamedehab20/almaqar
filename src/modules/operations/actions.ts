"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, localized } from "@/server/validation";
import { startOperation as startOperationSvc } from "@/modules/automation/service";
import * as svc from "./service";

const audience = z.discriminatedUnion("type", [
  z.object({ type: z.literal("company") }),
  z.object({ type: z.literal("custom"), departmentIds: z.array(id).max(50), memberIds: z.array(id).max(500) }),
]);

/** New operation from the Operations room ("add operation" dialog). Gets an OP-#### code. */
export const startOperation = action(
  companyInput.extend({
    subject: localized(200),
    category: z.enum(["contracts", "purchasing", "finance", "maintenance", "operations", "sales"]),
    nature: z.enum(["human", "automated", "autoCompleted"]),
    workflowId: id.nullable().optional(),
  }),
  (input) => withUser((ctx) => startOperationSvc(ctx, input)),
);

export const createNote = action(
  companyInput.extend({ text: z.string().trim().min(1).max(4000), audience, operationId: z.string().max(60).nullable().optional(), pinned: z.boolean().optional() }),
  (input) => withUser((ctx) => svc.createNote(ctx, input)),
);

export const setNotePinned = action(z.object({ noteId: id, pinned: z.boolean() }), (input) => withUser((ctx) => svc.setNotePinned(ctx, input)));

export const deleteNote = action(z.object({ noteId: id }), (input) => withUser((ctx) => svc.deleteNote(ctx, input)));
