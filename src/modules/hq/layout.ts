/**
 * A starting office for a company that has not drawn its own floor plan yet: the meeting room, the
 * manager's office with the owner's desk, and the open workspace split into one section per department
 * (up to four), with a desk for each of its people. Same 1000 × 650 grid as the floor editor.
 * Pure, so the main hall shows the real team from the first day.
 */
import type { FurnitureItem, Room, Zone } from "./mock";

type Person = { id: string; departmentId: string | null };
type Dept = { id: string };

const MAX_ZONES = 4;
const ROWS = 3;

export function defaultOffice(departments: Dept[], people: Person[], ownerId: string | null) {
  const rooms: Room[] = [
    { id: "auto-meeting", type: "meeting", x: 0, y: 0, w: 540, h: 300 },
    { id: "auto-ceo", type: "ceo", x: 540, y: 0, w: 460, h: 300 },
    { id: "auto-open", type: "open", x: 0, y: 300, w: 1000, h: 350 },
  ];
  const furniture: FurnitureItem[] = [{ id: "auto-table", kind: "meetingTable", roomId: "auto-meeting", x: 70, y: 150, w: 360, h: 80 }];
  if (ownerId) furniture.push({ id: "auto-owner", kind: "desk", roomId: "auto-ceo", x: 700, y: 140, w: 150, h: 90, memberId: ownerId });

  // Departments with people first (in their order), then empty ones, up to four sections
  const staffed = departments.filter((d) => people.some((p) => p.departmentId === d.id && p.id !== ownerId));
  const shown = [...staffed, ...departments.filter((d) => !staffed.includes(d))].slice(0, MAX_ZONES);
  const zones: Zone[] = [];
  const gap = 10;
  const width = shown.length ? (970 - gap * (shown.length - 1)) / shown.length : 0;
  shown.forEach((dept, i) => {
    // Right to left, like the demo office
    const x = 985 - (i + 1) * width - i * gap;
    zones.push({ id: `auto-zone-${dept.id}`, roomId: "auto-open", departmentId: dept.id, x, y: 365, w: width, h: 270 });
    const cols = Math.max(1, Math.floor(width / 210));
    const deskW = Math.min(195, width / cols - 20);
    const seated = people.filter((p) => p.departmentId === dept.id && p.id !== ownerId).slice(0, cols * ROWS);
    seated.forEach((person, n) => {
      const col = n % cols;
      const row = Math.floor(n / cols);
      furniture.push({ id: `auto-desk-${person.id}`, kind: "desk", roomId: "auto-open", x: x + 10 + col * (width / cols), y: 400 + row * 75, w: deskW, h: 60, memberId: person.id });
    });
  });
  return { rooms, furniture, zones };
}
