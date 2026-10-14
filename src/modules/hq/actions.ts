"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, localized, optionalLocalized } from "@/server/validation";
import * as svc from "./service";

const presence = z.enum(["available", "busy", "meeting", "restroom", "waiting", "away", "offline"]);
const color = z.enum(["blue", "violet", "amber", "emerald"]);
const rect = { x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() };

export const updateCompany = action(
  companyInput.extend({ name: localized(100).optional(), floor: z.object({ widthM: z.number().positive(), depthM: z.number().positive() }).optional() }),
  (input) => withUser((ctx) => svc.updateCompany(ctx, input)),
);

export const setMyStatus = action(
  companyInput.extend({ status: presence, currentTask: optionalLocalized(140).nullable().optional() }),
  (input) => withUser((ctx) => svc.setMyStatus(ctx, input)),
);

/** Your own name and title in this company. */
export const updateMyProfile = action(companyInput.extend({ name: localized(80).optional(), title: optionalLocalized(80).optional() }), (input) =>
  withUser((ctx) => svc.updateMyProfile(ctx, input)),
);

/** Adds the member, then emails them an invite when SUPABASE_SECRET_KEY is set (otherwise they just sign up with that email). */
export const inviteMember = action(
  companyInput.extend({
    email: z.email(),
    name: localized(80),
    title: optionalLocalized(80).optional(),
    departmentId: id.nullable().optional(),
    roleId: id.nullable().optional(),
  }),
  async (input) => {
    const member = await withUser((ctx) => svc.inviteMember(ctx, input));
    const admin = createAdminClient();
    let emailed = false;
    if (admin) {
      const { error } = await admin.auth.admin.inviteUserByEmail(member.email!);
      emailed = !error; // an existing account gets no invite email; it is linked on next sign-in
    }
    return { member, emailed };
  },
);

export const updateMember = action(
  companyInput.extend({
    memberId: id,
    name: localized(80).optional(),
    title: optionalLocalized(80).optional(),
    departmentId: id.nullable().optional(),
    roleId: id.nullable().optional(),
  }),
  (input) => withUser((ctx) => svc.updateMember(ctx, input)),
);

export const removeMember = action(companyInput.extend({ memberId: id }), (input) => withUser((ctx) => svc.removeMember(ctx, input)));

export const createDepartment = action(companyInput.extend({ name: localized(60), color: color.optional(), managerId: id.nullable().optional() }), (input) =>
  withUser((ctx) => svc.createDepartment(ctx, input)),
);

export const updateDepartment = action(
  companyInput.extend({ departmentId: id, name: localized(60).optional(), color: color.optional(), active: z.boolean().optional(), managerId: id.nullable().optional() }),
  (input) => withUser((ctx) => svc.updateDepartment(ctx, input)),
);

export const deleteDepartment = action(companyInput.extend({ departmentId: id }), (input) => withUser((ctx) => svc.deleteDepartment(ctx, input)));

export const saveFloorPlan = action(
  companyInput.extend({
    rooms: z.array(z.object({ type: z.enum(["meeting", "ceo", "open"]), code: z.string().max(20).optional(), ...rect })).max(100),
    furniture: z
      .array(z.object({ roomIndex: z.number().int().min(0), kind: z.enum(["desk", "meetingTable"]), memberId: id.optional(), ...rect }))
      .max(500),
    zones: z.array(z.object({ roomIndex: z.number().int().min(0), departmentId: id, ...rect })).max(100),
  }),
  (input) => withUser((ctx) => svc.saveFloorPlan(ctx, input)),
);
