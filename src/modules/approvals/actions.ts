"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, isoDate } from "@/server/validation";
import * as svc from "./service";

const file = z.object({ path: z.string().min(3).max(400), name: z.string().min(1).max(200), size: z.number().int().min(0), type: z.string().max(120) });

/** Files are uploaded first with uploadAttachment({ folder: "approvals" }), then passed here. */
export const requestApproval = action(
  companyInput.extend({
    approverId: id,
    kind: z.enum(["action", "position"]),
    title: z.string().trim().min(1).max(200),
    details: z.string().trim().max(4000).nullable().optional(),
    dueOn: isoDate.nullable().optional(),
    attachments: z.array(file).max(svc.MAX_APPROVAL_FILES).optional(),
  }),
  (input) => withUser((ctx) => svc.requestApproval(ctx, input)),
);

export const decideApproval = action(
  z.object({ approvalId: id, decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).nullable().optional() }),
  (input) => withUser((ctx) => svc.decideApproval(ctx, input)),
);

export const cancelApproval = action(z.object({ approvalId: id }), (input) => withUser((ctx) => svc.cancelApproval(ctx, input)));
