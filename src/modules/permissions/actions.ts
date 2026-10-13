"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, localized } from "@/server/validation";
import { PERMISSION_KEYS, type PermissionKey } from "./catalog";
import * as svc from "./service";

const key = z.enum(PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]]);
/** null = every department (only scoped permissions keep a list) */
const departmentIds = z.array(id).max(100).nullable();

export const createRole = action(companyInput.extend({ name: localized(60), copyFromRoleId: id.nullable().optional() }), (input) =>
  withUser((ctx) => svc.createRole(ctx, input)),
);

export const renameRole = action(z.object({ roleId: id, name: localized(60) }), (input) => withUser((ctx) => svc.renameRole(ctx, input)));

export const deleteRole = action(z.object({ roleId: id }), (input) => withUser((ctx) => svc.deleteRole(ctx, input)));

export const setRolePermissions = action(
  z.object({ roleId: id, permissions: z.array(z.object({ key, departmentIds })).max(PERMISSION_KEYS.length) }),
  (input) => withUser((ctx) => svc.setRolePermissions(ctx, input)),
);

export const assignRole = action(z.object({ memberId: id, roleId: id.nullable() }), (input) => withUser((ctx) => svc.assignRole(ctx, input)));

export const setMemberOverrides = action(
  z.object({
    memberId: id,
    overrides: z.array(z.object({ key, effect: z.enum(["grant", "deny"]), departmentIds })).max(PERMISSION_KEYS.length),
  }),
  (input) => withUser((ctx) => svc.setMemberOverrides(ctx, input)),
);
