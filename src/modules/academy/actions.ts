"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const setLessonDone = action(z.object({ lessonId: z.string().min(1).max(60), done: z.boolean() }), (input) =>
  withUser((ctx) => svc.setLessonDone(ctx, input)),
);
