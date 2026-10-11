/**
 * An Event is a single thing that happened in the system (an order was created, a payment
 * failed, an automation ran…). Events are append-only: once recorded they never change.
 *
 * The Operations room shows them on a timeline (critical ones become alerts) and the
 * Automation room uses their `type` to trigger rules.
 *
 * Note: this `Event` shadows the DOM's global `Event` type in files that import it.
 * Import it under another name there if you also need the DOM one:
 *   import type { Event as SystemEvent } from "@/modules/events/types";
 */

/** "domain.action", e.g. "order.created", "payment.failed". Known types are listed in EVENT_TYPES. */
export type EventType = `${string}.${string}`;

export type EventSource = "system" | "user" | "automation" | "integration";

export type EventSeverity = "info" | "warning" | "critical";

/** Extra details that depend on the event type, e.g. { orderId: "SO-1022", amount: 12000 }. */
export type EventPayload = Record<string, unknown>;

export interface Event<P extends EventPayload = EventPayload> {
  id: string;
  type: EventType;
  source: EventSource;
  severity: EventSeverity;
  payload: P;
  /** ISO 8601 timestamp */
  createdAt: string;
}

export type EventFilter = {
  type?: EventType | EventType[];
  source?: EventSource | EventSource[];
  severity?: EventSeverity | EventSeverity[];
};
