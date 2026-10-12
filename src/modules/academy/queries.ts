import "server-only";
import { cache } from "react";
import { withUser } from "@/server/session";
import * as svc from "./service";

export const getMyProgress = cache(() => withUser((ctx) => svc.getMyProgress(ctx)));
