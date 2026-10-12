import "server-only";
import { supabaseEnv } from "@/lib/supabase/env";
import { getClaims, withUser } from "@/server/session";
import { createMockEvents } from "./mock";
import { listEvents } from "./service";
import type { Event, EventFilter } from "./types";

/**
 * The single place screens get events from. Reads the company's `events` table when Supabase is
 * configured and the user is signed in; otherwise returns the demo data, so screens keep working.
 *
 * Call it from a Server Component and pass the result down as props: the demo times are
 * relative to "now", so computing them once on the server avoids server/client mismatches.
 */
export async function fetchEvents(companyId?: string, filter?: EventFilter): Promise<Event[]> {
  if (companyId && supabaseEnv() && (await getClaims())) {
    return withUser((ctx) => listEvents(ctx, companyId, filter));
  }
  return createMockEvents();
}
