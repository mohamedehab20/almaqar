"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, isoDate } from "@/server/validation";
import { TIME_ZONES } from "./calc";
import * as svc from "./service";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const clockIn = action(companyInput, (input) => withUser((ctx) => svc.clockIn(ctx, input)));

export const clockOut = action(companyInput, (input) => withUser((ctx) => svc.clockOut(ctx, input)));

/** memberId empty = yourself */
export const addWorkSession = action(
  companyInput.extend({ memberId: id.nullable().optional(), date: isoDate, from: time, to: time, note: z.string().trim().max(500).nullable().optional() }),
  (input) => withUser((ctx) => svc.addWorkSession(ctx, input)),
);

export const deleteWorkSession = action(z.object({ sessionId: id }), (input) => withUser((ctx) => svc.deleteWorkSession(ctx, input)));

export const saveWorkSettings = action(
  companyInput.extend({
    dayStart: time,
    dayEnd: time,
    breakMinutes: z.number().int().min(0).max(600),
    graceMinutes: z.number().int().min(0).max(240),
    timeZone: z.enum(TIME_ZONES),
  }),
  (input) => withUser((ctx) => svc.saveWorkSettings(ctx, input)),
);
