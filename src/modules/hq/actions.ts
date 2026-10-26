"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { z } from "zod";
import { clerkEnabled } from "@/lib/clerk";
import { normalizePhone } from "@/lib/phone";
import { AppError } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
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

/**
 * Emails a Clerk invitation: a link to create the account with this address, which lands on /join and
 * opens the company. false when it could not be sent (Clerk off, or the address already has an account:
 * they simply sign in and the invite is linked).
 */
async function emailInvite(email: string, locale: "ar" | "en") {
  if (!clerkEnabled()) return false;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return false;
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({ emailAddress: email, redirectUrl: `${origin}${locale === "en" ? "/en" : ""}/join`, ignoreExisting: true, notify: true });
    return true;
  } catch {
    return false;
  }
}

/** Adds the member, then sends the invite by email (Clerk). The screen then offers WhatsApp to the number given. */
export const inviteMember = action(
  companyInput.extend({
    email: z.email(),
    phone: z.string().trim().min(8).max(25).refine((v) => normalizePhone(v) !== null),
    locale: z.enum(["ar", "en"]).optional(),
    name: localized(80),
    title: optionalLocalized(80).optional(),
    departmentId: id.nullable().optional(),
    roleId: id.nullable().optional(),
  }),
  async ({ locale, ...input }) => {
    const member = await withUser((ctx) => svc.inviteMember(ctx, input));
    const emailed = await emailInvite(member.email!, locale ?? "ar");
    return { member, emailed };
  },
);

/** Sends the invite email again to someone who has not activated their account yet (members.invite). */
export const resendInviteEmail = action(companyInput.extend({ memberId: id, locale: z.enum(["ar", "en"]).optional() }), async ({ companyId, memberId, locale }) => {
  const member = await withUser(async (ctx) => {
    const list = await svc.listMembers(ctx, companyId);
    const m = list.find((x) => x.id === memberId);
    if (!m || !m.email) throw new AppError("not_found");
    if (m.linked) throw new AppError("invalid");
    await requirePermission(ctx, companyId, "members.invite", m.departmentId || null);
    return m;
  });
  return { emailed: await emailInvite(member.email!, locale ?? "ar") };
});

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
