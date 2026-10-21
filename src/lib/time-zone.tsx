"use client";

import { createContext, useContext } from "react";
import { DEFAULT_WORK_SETTINGS } from "@/modules/hours/calc";

/**
 * The company's time zone (work settings), for every date and time shown on screen. The server and the
 * browser format with the same zone, so the HTML matches (no hydration error) and everyone sees the
 * company's clock. The public demo uses the default zone.
 */
const TimeZoneContext = createContext<string>(DEFAULT_WORK_SETTINGS.timeZone);

export function TimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export const useTimeZone = () => useContext(TimeZoneContext);
