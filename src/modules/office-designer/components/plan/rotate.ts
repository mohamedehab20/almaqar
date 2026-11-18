import type { Door, Layout, Placed } from "@/modules/office-designer/data/types";

/**
 * Turns the whole plan a quarter turn: clockwise (`cw`) or counter-clockwise. Width and length swap, and every
 * wall, door, window, column, floor and piece of furniture turns with it, so nothing moves relative to the rest.
 */
export function rotateLayout(l: Layout, cw: boolean): Layout {
  const W = l.roomWidthCm;
  const L = l.roomLengthCm;
  // A point and a box (top-left + size) after the turn
  const pt = (x: number, y: number) => (cw ? { x: L - y, y: x } : { x: y, y: W - x });
  const box = (x: number, y: number, w: number, h: number) => (cw ? { x: L - (y + h), y: x, w: h, h: w } : { x: y, y: W - (x + w), w: h, h: w });
  const turn = (deg: number) => (((deg + (cw ? 90 : -90)) % 360) + 360) % 360;

  return {
    ...l,
    roomWidthCm: L,
    roomLengthCm: W,
    walls: l.walls?.map((w) => {
      const a = pt(w.x1, w.y1);
      const b = pt(w.x2, w.y2);
      return { ...w, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }),
    doors: l.doors?.map((d) => ({ ...d, ...pt(d.x, d.y), rotation: turn(d.rotation) as Door["rotation"] })),
    floors: l.floors?.map((f) => ({ ...f, ...box(f.x, f.y, f.w, f.h) })),
    openings: l.openings?.map((o) => ({ ...o, ...pt(o.x, o.y), angle: turn(o.angle) })),
    columns: l.columns?.map((c) => ({ ...c, ...pt(c.x, c.y) })),
    // Furniture is turned by `rotatePlaced`, which needs each piece's size from the catalog
    placed: l.placed,
  };
}

/** Moves each piece of furniture with the plan (needs each piece's current footprint size). */
export function rotatePlaced(p: Placed, size: { w: number; h: number }, W: number, L: number, cw: boolean): Placed {
  const x = cw ? L - (p.y + size.h) : p.y;
  const y = cw ? p.x : W - (p.x + size.w);
  const rotation = ((((p.rotation + (cw ? 90 : -90)) % 360) + 360) % 360) as Placed["rotation"];
  return { ...p, x: Math.round(x), y: Math.round(y), rotation };
}
