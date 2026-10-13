import "server-only";
import { cache } from "react";
import { getMyPermissions as getMyPermissionsSvc } from "@/server/permissions";
import { withUser } from "@/server/session";
import { getSignedInCompany } from "@/modules/hq/queries";
import { ROOM_VIEW } from "./catalog";
import * as svc from "./service";

export const getMyPermissions = cache((companyId: string) => withUser((ctx) => getMyPermissionsSvc(ctx, companyId)));
export const listRoles = cache((companyId: string) => withUser((ctx) => svc.listRoles(ctx, companyId)));
export const getPermissionsOverview = cache((companyId: string) => withUser((ctx) => svc.getPermissionsOverview(ctx, companyId)));

/**
 * Rooms the signed-in member may open at /c/<slug> (keys of ROOM_VIEW), and whether they are the owner.
 * null: not a signed-in member (the public demo), where every room stays open.
 */
export const getRoomAccess = cache(async (slug: string) => {
  const current = await getSignedInCompany(slug);
  if (!current) return null;
  const mine = await getMyPermissions(current.company.id);
  return {
    owner: mine.owner,
    rooms: Object.entries(ROOM_VIEW)
      .filter(([, key]) => mine.scopes[key])
      .map(([room]) => room),
  };
});
