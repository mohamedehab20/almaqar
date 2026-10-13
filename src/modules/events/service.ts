import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { events, members, type Localized } from "@/db/schema";
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

/** Appends an event to the company's activity log (events are never edited). The caller's member row is the actor. */
export async function emitEvent(
  ctx: Ctx,
  companyId: string,
  event: { type: EventType; payload?: EventPayload; source?: EventSource; severity?: EventSeverity },
) {
  const [actor] = await ctx.tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.companyId, companyId), eq(members.userId, ctx.userId)));
  await ctx.tx.insert(events).values({
    companyId,
    type: event.type,
    source: event.source ?? "user",
    severity: event.severity ?? "info",
    payload: event.payload ?? {},
    actorId: actor?.id ?? null,
  });
}

// ---------- Activity feed (main hall) ----------

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/**
 * One line per event, in both languages: what happened, then who did it ("اعتماد الطلب PO-1001 — كريم عادل").
 * Noun phrases instead of verbs, so the Arabic is right whatever the actor's gender.
 */
function describe(type: string, p: EventPayload, who: Localized | null): Localized {
  const n = str(p.number) || str(p.code);
  const what = (ar: string, en: string): Localized => ({ ar: n ? `${ar} ${n}` : ar, en: n ? `${en} ${n}` : en });
  const ACTIONS: Record<string, Localized> = {
    "order.created": what("طلب جديد", "New order"),
    "order.pending": what("إرسال للاعتماد: الطلب", "Sent for approval: order"),
    "order.approved": what("اعتماد الطلب", "Order approved:"),
    "order.cancelled": what("إلغاء الطلب", "Order cancelled:"),
    "order.fulfilled": what("تسليم الطلب", "Order fulfilled:"),
    "operation.started": what("بدء العملية", "Operation started:"),
    "operation.completed": what("اكتمال العملية", "Operation completed:"),
    "operation.approve": what("موافقة على خطوة في", "Step approved in"),
    "operation.reject": what("رفض خطوة في", "Step rejected in"),
    "operation.request_changes": what("طلب تعديلات على", "Changes requested on"),
    "brief.received": { ar: "طلب جديد من عميل", en: "New brief from a client" },
    "brief.acknowledged": { ar: "استلام طلب عميل", en: "Client brief acknowledged" },
    "brief.clarification_requested": { ar: "طلب توضيح من عميل", en: "Clarification asked from a client" },
    "brief.reopened": { ar: "إعادة فتح طلب عميل", en: "Client brief reopened" },
    "client.created": { ar: "عميل جديد", en: "New client" },
    "member.invited": { ar: "دعوة موظف جديد", en: "New employee invited" },
    "member.removed": { ar: "إزالة موظف", en: "Employee removed" },
    "workflow.created": { ar: "مسار موافقة جديد", en: "New approval workflow" },
    "note.created": { ar: "ملاحظة جديدة", en: "New note" },
    "agent.task_queued": { ar: "مهمة جديدة لوكيل", en: "New task for an agent" },
    "agent.task_done": { ar: "وكيل أنهى مهمة", en: "An agent finished a task" },
  };
  const action = ACTIONS[type] ?? { ar: type, en: type };
  if (!who || (!who.ar && !who.en)) return action;
  return { ar: `${action.ar} — ${who.ar || who.en}`, en: `${action.en} — ${who.en || who.ar}` };
}

/** Newest first: what the main hall's activity panel shows (ActivityItem in hq/mock.ts, with an ISO time). */
export async function listActivity(ctx: Ctx, companyId: string, limit = 20) {
  const rows = await ctx.tx
    .select({ event: events, actor: members.name })
    .from(events)
    .leftJoin(members, eq(members.id, events.actorId))
    .where(eq(events.companyId, companyId))
    .orderBy(desc(events.createdAt))
    .limit(limit);
  return rows.map(({ event, actor }) => ({
    id: event.id,
    time: event.createdAt.toISOString(),
    type: event.type,
    actorId: event.actorId,
    text: describe(event.type, event.payload, actor),
  }));
}
