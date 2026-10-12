"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, localized, optionalLocalized } from "@/server/validation";
import * as svc from "./service";

export const createAgent = action(
  companyInput.extend({
    kind: z.enum(["general", "specialist"]),
    name: localized(80),
    role: optionalLocalized(120).optional(),
    description: optionalLocalized(1000).optional(),
    skills: z.array(localized(60)).max(20).optional(),
    area: optionalLocalized(60).optional(),
  }),
  (input) => withUser((ctx) => svc.createAgent(ctx, input)),
);

export const setAgentStatus = action(z.object({ agentId: id, status: z.enum(["active", "busy", "paused"]) }), (input) =>
  withUser((ctx) => svc.setAgentStatus(ctx, input)),
);

export const queueTask = action(z.object({ agentId: id, task: z.string().trim().min(1).max(4000) }), (input) =>
  withUser((ctx) => svc.queueTask(ctx, input)),
);

export const completeTask = action(z.object({ agentId: id, result: z.string().max(8000).optional() }), (input) =>
  withUser((ctx) => svc.completeTask(ctx, input)),
);
