"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import { companyInput, id } from "@/server/validation";
import { ROOM_KEYS } from "./rooms";
import * as svc from "./service";

/** Department changes go through the hq actions (createDepartment, updateDepartment, deleteDepartment). */
export const setRoom = action(
  companyInput.extend({ room: z.enum(ROOM_KEYS as [string, ...string[]]), enabled: z.boolean().optional(), managerId: id.nullable().optional() }),
  (input) => withUser((ctx) => svc.setRoom(ctx, input as Parameters<typeof svc.setRoom>[1])),
);
