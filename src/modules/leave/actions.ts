"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, isoDate } from "@/server/validation";
import { LEAVE_TYPES } from "./calc";
import * as svc from "./service";

const leaveType = z.enum(LEAVE_TYPES);
const days = z.number().min(0).max(366);

export const requestLeave = action(
  companyInput.extend({ type: leaveType, startsOn: isoDate, endsOn: isoDate, reason: z.string().trim().max(1000).nullable().optional() }),
  (input) => withUser((ctx) => svc.requestLeave(ctx, input)),
);

export const cancelLeave = action(z.object({ requestId: id }), (input) => withUser((ctx) => svc.cancelLeave(ctx, input)));

export const decideLeave = action(
  z.object({ requestId: id, decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).nullable().optional() }),
  (input) => withUser((ctx) => svc.decideLeave(ctx, input)),
);

/** allowance null = back to the company default */
export const setLeaveAllowance = action(
  z.object({ memberId: id, year: z.number().int().min(2000).max(2100), type: leaveType, allowance: days.nullable() }),
  (input) => withUser((ctx) => svc.setLeaveAllowance(ctx, input)),
);

export const saveLeaveSettings = action(
  companyInput.extend({
    allowances: z.object({ annual: days.nullable(), casual: days.nullable(), sick: days.nullable(), unpaid: days.nullable() }),
    weekendDays: z.array(z.number().int().min(0).max(6)).max(3),
  }),
  (input) => withUser((ctx) => svc.saveLeaveSettings(ctx, input)),
);
