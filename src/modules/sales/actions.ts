"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id, isoDate, localized, optionalLocalized } from "@/server/validation";
import * as svc from "./service";

const items = z
  .array(z.object({ name: z.string().trim().min(1).max(200), qty: z.number().positive().max(1e6), unitPrice: z.number().min(0).max(1e9) }))
  .min(1)
  .max(100);

/** The order number (SO-#### / PO-####) comes back in the result. */
export const createOrder = action(
  companyInput.extend({
    type: z.enum(["sale", "purchase"]),
    partyId: id,
    items,
    deliveryDate: isoDate.nullable().optional(),
    status: z.enum(["draft", "pending"]).optional(),
  }),
  (input) => withUser((ctx) => svc.createOrder(ctx, input)),
);

export const updateOrder = action(z.object({ orderId: id, items: items.optional(), deliveryDate: isoDate.nullable().optional(), partyId: id.optional() }), (input) =>
  withUser((ctx) => svc.updateOrder(ctx, input)),
);

export const setOrderStatus = action(z.object({ orderId: id, status: z.enum(["draft", "pending", "approved", "fulfilled", "cancelled"]) }), (input) =>
  withUser((ctx) => svc.setOrderStatus(ctx, input)),
);

export const createSupplier = action(companyInput.extend({ name: localized(100), category: optionalLocalized(80).optional() }), (input) =>
  withUser((ctx) => svc.createSupplier(ctx, input)),
);
