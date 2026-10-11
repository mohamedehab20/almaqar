"use client";

import { useSyncExternalStore } from "react";
import { briefs as demoBriefs, type Brief } from "./briefs-mock";

/**
 * Briefs shared between the client's portal (visitor login) and the Marketing team's inbox.
 *
 * Until the backend exists they live in the browser's localStorage, so a brief sent from the
 * client portal shows up in Marketing → Client portal → Incoming requests (same browser, any tab),
 * and the team's "received / needs clarification" shows up for the client.
 * TODO(backend): replace with an API + realtime subscription; keep `useBriefs` / `updateBriefs`.
 */

const KEY = "almaqr.briefs.v1";
const listeners = new Set<() => void>();
let cache: Brief[] | null = null;

function read(): Brief[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Brief[]) : demoBriefs;
  } catch {
    cache = demoBriefs;
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Other tabs write to localStorage → refresh this tab
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useBriefs(): Brief[] {
  return useSyncExternalStore(subscribe, read, () => demoBriefs);
}

export function updateBriefs(update: (prev: Brief[]) => Brief[]) {
  cache = update(read());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: keep the in-memory copy for this tab
  }
  listeners.forEach((listener) => listener());
}
