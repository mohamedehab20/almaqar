import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { events } from "@/db/schema";
import type { Ctx } from "@/server/context";
import type { Event, EventFilter, EventPayload, EventSeverity, EventSource, EventType } from "./types";

const asList = <T,>(v: T | T[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

/** Newest first. */
export async function listEvents(ctx: Ctx, companyId: string, filter: EventFilter = {}, limit = 100): Promise<Event[]> {
  const where: SQL[] = [eq(events.companyId, companyId)];
  const types = asList(filter.type);
  const sources = asList(filter.source);
  const severities = asList(filter.severity);
  if (types) where.push(inArray(events.type, types));
  if (sources) where.push(inArray(events.source, sources));
  if (severities) where.push(inArray(events.severity, severities));

  const rows = await ctx.tx
    .select()
    .from(events)
    .where(and(...where))
    .orderBy(desc(events.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    type: r.type as EventType,
    source: r.source,
    severity: r.severity,
    payload: r.payload,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Appends an event to the company's activity log (events are never edited). */
export async function emitEvent(
  ctx: Ctx,
  companyId: string,
  event: { type: EventType; payload?: EventPayload; source?: EventSource; severity?: EventSeverity },
) {
  await ctx.tx.insert(events).values({
    companyId,
    type: event.type,
    source: event.source ?? "user",
    severity: event.severity ?? "info",
    payload: event.payload ?? {},
  });
}
