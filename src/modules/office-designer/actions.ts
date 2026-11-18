"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { requireMember } from "@/server/membership";
import { hasPermission, requirePermission } from "@/server/permissions";
import { withUser } from "@/server/session";
import { companyInput } from "@/server/validation";
import { CATEGORIES } from "./data/types";
import * as store from "./storage";

/**
 * The office designer in the main hall. Every member can see the company's design; changing it (the plan and
 * the uploaded furniture) needs "company.settings" (company and office settings).
 */

export const getOfficeDesign = action(companyInput, async ({ companyId }) => {
  const canEdit = await withUser(async (ctx) => {
    await requireMember(ctx, companyId);
    return hasPermission(ctx, companyId, "company.settings");
  });
  if (!store.storageReady()) return { layout: null, items: [], canEdit, stored: false };
  const [layout, items] = await Promise.all([store.readLayout(companyId), store.listItems(companyId)]);
  return { layout, items, canEdit, stored: true };
});

const layoutShape = z
  .object({ roomWidthCm: z.number().min(100).max(5000), roomLengthCm: z.number().min(100).max(5000), placed: z.array(z.unknown()).max(3000) })
  .passthrough();

export const saveOfficeLayout = action(companyInput.extend({ layout: layoutShape }), async ({ companyId, layout }) => {
  await withUser((ctx) => requirePermission(ctx, companyId, "company.settings"));
  await store.writeLayout(companyId, layout);
  return { saved: true };
});

export const uploadOfficeFurniture = action(
  companyInput.extend({
    meta: z.object({
      id: z.string().regex(/^USR-[A-Z0-9-]{4,40}$/),
      name: z.string().trim().min(1).max(80),
      category: z.enum(CATEGORIES as [string, ...string[]]),
      widthCm: z.number().min(5).max(2000),
      depthCm: z.number().min(5).max(2000),
      heightCm: z.number().min(0).max(2000),
    }),
    file: z.instanceof(File),
  }),
  async ({ companyId, meta, file }) => {
    await withUser((ctx) => requirePermission(ctx, companyId, "company.settings"));
    return store.addItem(
      companyId,
      { ...meta, category: meta.category as store.NewItem["category"], widthCm: Math.round(meta.widthCm), depthCm: Math.round(meta.depthCm), heightCm: Math.round(meta.heightCm) },
      file,
    );
  },
);

export const removeOfficeFurniture = action(companyInput.extend({ id: z.string().regex(/^USR-[A-Z0-9-]{4,40}$/) }), async ({ companyId, id }) => {
  await withUser((ctx) => requirePermission(ctx, companyId, "company.settings"));
  await store.removeItem(companyId, id);
  return { removed: true };
});
