import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import { signedUrls } from "@/modules/files/storage";
import * as svc from "./service";

/** The approvals page data, with links to open each attached file (images show as thumbnails). */
export const getApprovalsData = cache(async (companyId: string) => {
  const data = await withUser((ctx) => svc.getApprovalsData(ctx, companyId));
  const urls = await signedUrls(data.approvals.flatMap((a) => a.attachments.map((f) => f.path)));
  return { ...data, approvals: data.approvals.map((a) => ({ ...a, attachments: a.attachments.map((f) => ({ ...f, url: urls[f.path] })) })) };
});
