import { EVENT_TYPES, type EventTypeConfig } from "./constants";
import type { Event, EventFilter } from "./types";

/** Newest first. Returns a new array; the input is not changed. */
export function sortByNewest<E extends Event>(events: readonly E[]): E[] {
  return [...events].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const matches = <T>(value: T, wanted: T | T[] | undefined) =>
  wanted === undefined || (Array.isArray(wanted) ? wanted.length === 0 || wanted.includes(value) : value === wanted);

/**
 * Keep events that match every given criterion. Each criterion can be one value or a list
 * (any of); a missing criterion or an empty list means "don't filter on it".
 */
export function filterEvents<E extends Event>(events: readonly E[], filter: EventFilter): E[] {
  return events.filter(
    (event) =>
      matches(event.type, filter.type) && matches(event.source, filter.source) && matches(event.severity, filter.severity),
  );
}

/** Only the critical events (the ones shown as alerts), newest first. */
export function getCriticalEvents<E extends Event>(events: readonly E[]): E[] {
  return sortByNewest(filterEvents(events, { severity: "critical" }));
}

/** Display config for a type; `undefined` for a type that is not in EVENT_TYPES. */
export function getEventTypeConfig(type: string): EventTypeConfig | undefined {
  return EVENT_TYPES.find((config) => config.type === type);
}
