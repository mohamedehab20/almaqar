"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, isoDate, localized, optionalLocalized } from "@/server/validation";
import { campaignTypes } from "./briefs-mock";
import * as svc from "./service";

const clientStatus = z.enum(["active", "onboarding", "paused"]);
const money = z.number().min(0).max(1e10);

// ---------- Clients ----------

export const createClient = action(
  companyInput.extend({
    name: localized(100),
    industry: optionalLocalized(80).optional(),
    managerId: id.nullable().optional(),
    monthlyBudget: money.optional(),
    status: clientStatus.optional(),
  }),
  (input) => withUser((ctx) => svc.createClient(ctx, input)),
);

export const updateClient = action(
  z.object({
    clientId: id,
    name: localized(100).optional(),
    industry: optionalLocalized(80).optional(),
    managerId: id.nullable().optional(),
    monthlyBudget: money.optional(),
    status: clientStatus.optional(),
  }),
  (input) => withUser((ctx) => svc.updateClient(ctx, input)),
);

export const regenerateInviteCode = action(z.object({ clientId: id }), (input) => withUser((ctx) => svc.regenerateInviteCode(ctx, input)));

// ---------- Briefs ----------

/** Client portal: send a brief (attach a file first with files/actions uploadAttachment, folder "briefs"). */
export const sendBrief = action(
  z.object({
    clientId: id,
    type: z.enum(campaignTypes),
    objective: localized(500),
    audience: localized(500),
    details: localized(4000),
    budget: money,
    deadline: isoDate.nullable().optional(),
    attachmentPath: z.string().max(400).nullable().optional(),
  }),
  (input) => withUser((ctx) => svc.sendBrief(ctx, input)),
);

export const setBriefStatus = action(z.object({ briefId: id, status: z.enum(["new", "received", "clarification"]) }), (input) =>
  withUser((ctx) => svc.setBriefStatus(ctx, input)),
);

export const replyToBrief = action(z.object({ briefId: id, reply: z.string().trim().min(1).max(4000) }), (input) =>
  withUser((ctx) => svc.replyToBrief(ctx, input)),
);

// ---------- Ideas ----------

const criterion = z.number().int().min(1).max(5);

export const createIdea = action(
  companyInput.extend({
    title: localized(200),
    clientId: id.nullable().optional(),
    briefId: id.nullable().optional(),
    format: optionalLocalized(80).optional(),
    hook: optionalLocalized(500).optional(),
    message: optionalLocalized(1000).optional(),
  }),
  (input) => withUser((ctx) => svc.createIdea(ctx, input)),
);

export const updateIdea = action(
  z.object({
    ideaId: id,
    stage: z.enum(["bank", "lab", "delivery"]).optional(),
    title: localized(200).optional(),
    format: optionalLocalized(80).optional(),
    hook: optionalLocalized(500).optional(),
    message: optionalLocalized(1000).optional(),
    versions: z
      .array(
        z.object({
          id: z.string().max(40),
          label: z.string().max(20),
          description: optionalLocalized(300),
          duration: z.string().max(20),
          views: z.number().min(0),
          completion: z.number().min(0).max(100),
          engagement: z.number().min(0).max(100),
        }),
      )
      .max(10)
      .optional(),
    ratings: z.object({ hook: criterion, clarity: criterion, fit: criterion, effort: criterion }).nullable().optional(),
    delivery: z.object({ status: z.enum(["awaiting", "approved", "changes"]), sentOn: isoDate }).nullable().optional(),
  }),
  (input) => withUser((ctx) => svc.updateIdea(ctx, input)),
);

export const deleteIdea = action(z.object({ ideaId: id }), (input) => withUser((ctx) => svc.deleteIdea(ctx, input)));
