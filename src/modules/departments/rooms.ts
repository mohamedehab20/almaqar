/**
 * The rooms of the HQ a company can turn on or off from «إدارة الأقسام» (same order as the sidebar).
 * `soon`: still being built, so it stays off whatever the company chooses.
 * `locked`: always on. HR holds «إدارة الأقسام» itself, so turning it off would leave no way back.
 */
export const ROOMS = [
  { key: "hr", soon: false, locked: true },
  { key: "clients", soon: false },
  { key: "operations", soon: false },
  { key: "automation", soon: false },
  { key: "marketing", soon: false },
  { key: "analytics", soon: false },
  { key: "meetings", soon: false },
  { key: "accounts", soon: true },
  { key: "sales", soon: true },
  { key: "agents", soon: true },
  { key: "archive", soon: true },
] as const;

export type RoomKey = (typeof ROOMS)[number]["key"];
export const ROOM_KEYS = ROOMS.map((r) => r.key) as RoomKey[];
export const isSoon = (room: string) => ROOMS.some((r) => r.key === room && r.soon);
export const isLocked = (room: string) => ROOMS.some((r) => r.key === room && "locked" in r && r.locked);
