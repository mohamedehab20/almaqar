import { createMockEvents } from "./mock";
import type { Event } from "./types";

/**
 * The single place screens get events from. Today it returns demo data; later it becomes a
 * real request (e.g. `fetch("/api/events")` or a Supabase query) with the same signature,
 * so components don't change.
 *
 * Call it from a Server Component and pass the result down as props: the demo times are
 * relative to "now", so computing them once on the server avoids server/client mismatches.
 */
export async function fetchEvents(): Promise<Event[]> {
  // TODO(backend): replace with the real events source
  return createMockEvents();
}
