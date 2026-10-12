import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const listOrders = cache((companyId: string) => withUser((ctx) => svc.listOrders(ctx, companyId)));
export const listSuppliers = cache((companyId: string) => withUser((ctx) => svc.listSuppliers(ctx, companyId)));
