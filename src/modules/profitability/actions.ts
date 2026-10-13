"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, isoDate } from "@/server/validation";
import { TASK_TYPES } from "./calc";
import * as svc from "./service";

const money = z.number().min(0).max(1_000_000_000);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Owner: standard time per task type, minutes per revision, and the monthly costs behind the hourly cost. */
export const saveProfitabilitySettings = action(
  companyInput.extend({
    standardMinutes: z.record(z.enum(TASK_TYPES), z.number().int().min(0).max(10_000)),
    revisionMinutes: z.number().int().min(0).max(10_000),
    monthlySalaries: money,
    monthlyRent: money,
    monthlyTools: money,
    monthlyHours: z.number().min(0).max(100_000),
  }),
  (input) => withUser((ctx) => svc.saveProfitabilitySettings(ctx, input)),
);

export const setClientPackage = action(
  z.object({ clientId: id, deliverables: z.number().int().min(0).max(10_000).nullable(), revisionsPerPost: z.number().int().min(0).max(100).nullable() }),
  (input) => withUser((ctx) => svc.setClientPackage(ctx, input)),
);

export const createMeeting = action(
  companyInput.extend({ clientId: id.nullable().optional(), title: z.string().trim().min(1).max(200), startsAt: z.iso.datetime({ offset: true }), durationMinutes: z.number().int().min(1).max(24 * 60) }),
  (input) => withUser((ctx) => svc.createMeeting(ctx, input)),
);

export const createInvoice = action(
  z.object({ clientId: id, period: month, amount: money, issuedOn: isoDate, dueOn: isoDate, paidOn: isoDate.nullable().optional() }),
  (input) => withUser((ctx) => svc.createInvoice(ctx, input)),
);

export const markInvoicePaid = action(z.object({ invoiceId: id, paidOn: isoDate }), (input) => withUser((ctx) => svc.markInvoicePaid(ctx, input)));

export const createFreelancerPayment = action(
  z.object({ clientId: id, taskId: id.nullable().optional(), freelancer: z.string().trim().min(1).max(120), amount: money, paidOn: isoDate }),
  (input) => withUser((ctx) => svc.createFreelancerPayment(ctx, input)),
);
