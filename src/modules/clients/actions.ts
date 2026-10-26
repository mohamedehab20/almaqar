"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id } from "@/server/validation";
import { ROOM_KEYS } from "@/modules/departments/rooms";
import { PORTAL_FEATURES } from "./access";
import * as svc from "./service";

const text = (max: number) => z.string().trim().max(max).nullable().optional();
const fields = {
  kind: z.enum(["client", "visitor"]).optional(),
  room: z.enum(ROOM_KEYS as [string, ...string[]]).nullable().optional(),
  departmentId: id.nullable().optional(),
  industry: text(80),
  status: z.enum(["active", "onboarding", "paused"]).optional(),
  managerId: id.nullable().optional(),
  contactName: text(120),
  contactPhone: text(40),
  contactEmail: z.email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  notes: text(2000),
  portalAccess: z.array(z.enum(PORTAL_FEATURES)).max(PORTAL_FEATURES.length).optional(),
};

/** Invite codes are renewed with marketing's regenerateInviteCode. */
export const createPortalClient = action(companyInput.extend({ name: z.string().trim().min(1).max(120), ...fields }), (input) =>
  withUser((ctx) => svc.createPortalClient(ctx, input)),
);

export const updatePortalClient = action(z.object({ clientId: id, name: z.string().trim().min(1).max(120).optional(), ...fields }), (input) =>
  withUser((ctx) => svc.updatePortalClient(ctx, input)),
);

export const deletePortalClient = action(z.object({ clientId: id }), (input) => withUser((ctx) => svc.deletePortalClient(ctx, input)));

export const bookClientMeeting = action(
  z.object({ clientId: id, title: text(200), startsAt: z.iso.datetime({ offset: true }), durationMinutes: z.number().int().min(10).max(480), location: text(300), attendeeIds: z.array(id).max(20).optional() }),
  (input) => withUser((ctx) => svc.bookClientMeeting(ctx, input)),
);
