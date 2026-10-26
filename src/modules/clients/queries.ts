import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import { signedUrls } from "@/modules/files/storage";
import * as svc from "./service";

export const getClientPortalData = cache((companyId: string) => withUser((ctx) => svc.getClientPortalData(ctx, companyId)));

/** A client user's own portal, with short-lived links to their files. */
export const getMyPortal = cache(async () => {
  const portal = await withUser((ctx) => svc.getMyPortal(ctx));
  if (!portal) return null;
  const urls = await signedUrls(portal.files.map((f) => f.path));
  return { ...portal, files: portal.files.map((f) => ({ ...f, url: urls[f.path] ?? null })) };
});
