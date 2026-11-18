import type { Column, Opening, OpeningKind, Wall } from "@/modules/office-designer/data/types";

/** Geometry for the drawing tools: snapping, putting doors and windows on walls, and their drawn symbols. */

export type Pt = { x: number; y: number };

export const GRID = 5; // cm
export const DOOR_KINDS: OpeningKind[] = ["single", "double", "sliding"];
export const WINDOW_KINDS: OpeningKind[] = ["window", "bay", "french"];
export const OPENING_KINDS: OpeningKind[] = [...DOOR_KINDS, ...WINDOW_KINDS];
export const OPENING_WIDTH: Record<OpeningKind, number> = { single: 90, double: 160, sliding: 180, window: 120, bay: 180, french: 150 };
export const WALL_THICKNESS = 12;
export const COLUMN_SIZE = 30;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const wallLength = (w: Wall) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
export const wallAngle = (w: Wall) => (Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180) / Math.PI;

/** The closest point on a wall's centre line; `t` is its place along the wall (0 = start, 1 = end). */
export function project(p: Pt, w: Wall) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const t = clamp(((p.x - w.x1) * dx + (p.y - w.y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const q = { x: w.x1 + t * dx, y: w.y1 + t * dy };
  return { t, q, d: dist(p, q) };
}

/**
 * Snaps a point while drawing: onto a wall end first; otherwise onto the grid, kept straight (horizontal or
 * vertical) from `from` when it is nearly straight or `straight` is held; a first point also snaps onto a wall.
 */
export function snapPoint(p: Pt, walls: Wall[], { from, straight, reach }: { from?: Pt | null; straight?: boolean; reach: number }): Pt {
  let best: Pt | null = null;
  let bestD = reach;
  for (const w of walls) {
    for (const e of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
      const d = dist(p, e);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
  }
  if (best) return { ...best };
  let q = { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
  if (from) {
    const dx = q.x - from.x;
    const dy = q.y - from.y;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    if ((straight && Math.abs(dx) >= Math.abs(dy)) || angle < 8 || angle > 172) q = { x: q.x, y: from.y };
    else if (straight || Math.abs(angle - 90) < 8) q = { x: from.x, y: q.y };
    return q;
  }
  for (const w of walls) {
    const { q: on, d } = project(p, w);
    if (d < reach) return { x: Math.round(on.x), y: Math.round(on.y) };
  }
  return q;
}

/** Where an opening of `width` lands on the nearest wall (within `reach`), kept fully on that wall; null if none. */
export function onWall(p: Pt, walls: Wall[], width: number, reach: number) {
  let best: { w: Wall; t: number; d: number; len: number } | null = null;
  for (const w of walls) {
    const len = wallLength(w);
    if (len < width) continue;
    const { t, d } = project(p, w);
    if (d <= Math.max(reach, w.thickness) && (!best || d < best.d)) best = { w, t, d, len };
  }
  if (!best) return null;
  const { w, len } = best;
  const half = width / 2 / len;
  const t = clamp(best.t, half, 1 - half);
  return { x: w.x1 + t * (w.x2 - w.x1), y: w.y1 + t * (w.y2 - w.y1), angle: wallAngle(w), thickness: w.thickness };
}

export type Shape = { d: string; fill?: string; stroke?: string; width?: number; dash?: string };

const GREY = "#9a9a9a";
const INK = "#2a2a2a";
const CUT = "#f7f6f3";

/**
 * The plan symbol of a door or window in its own frame: the wall runs along x (centred on 0), the room side is +y.
 * Used for the canvas, the tool icons and the PNG export (as SVG paths), so all three always match.
 */
export function openingShapes(kind: OpeningKind, width: number, thickness: number): Shape[] {
  const w = width;
  const h = w / 2;
  const t = thickness / 2;
  const cut: Shape = { d: `M ${-h} ${-t - 0.6} H ${h} V ${t + 0.6} H ${-h} Z`, fill: CUT };
  const jambs: Shape = { d: `M ${-h} ${-t} V ${t} M ${h} ${-t} V ${t}`, stroke: INK, width: 2 };
  const frame: Shape = { d: `M ${-h} ${-t} H ${h} V ${t} H ${-h} Z`, fill: "#ffffff", stroke: INK, width: 1 };
  const glass: Shape = { d: `M ${-h} 0 H ${h}`, stroke: "#6f9fc2", width: 1.4 };
  switch (kind) {
    case "single":
      return [
        cut,
        { d: `M ${-h} ${t} L ${h} ${t} A ${w} ${w} 0 0 1 ${-h} ${t + w} Z`, fill: "rgba(0,0,0,0.05)", stroke: GREY, width: 1 },
        { d: `M ${-h} ${t} V ${t + w}`, stroke: INK, width: 2 },
        jambs,
      ];
    case "double":
      return [
        cut,
        { d: `M ${-h} ${t} L 0 ${t} A ${h} ${h} 0 0 1 ${-h} ${t + h} Z`, fill: "rgba(0,0,0,0.05)", stroke: GREY, width: 1 },
        { d: `M ${h} ${t} L 0 ${t} A ${h} ${h} 0 0 0 ${h} ${t + h} Z`, fill: "rgba(0,0,0,0.05)", stroke: GREY, width: 1 },
        { d: `M ${-h} ${t} V ${t + h} M ${h} ${t} V ${t + h}`, stroke: INK, width: 2 },
        jambs,
      ];
    case "sliding":
      return [
        cut,
        { d: `M ${-h} -2.5 H ${w * 0.08} V 0.5 H ${-h} Z`, fill: "#ffffff", stroke: INK, width: 1 },
        { d: `M ${-w * 0.08} -0.5 H ${h} V 2.5 H ${-w * 0.08} Z`, fill: "#ffffff", stroke: INK, width: 1 },
        jambs,
      ];
    case "window":
      return [cut, frame, glass, jambs];
    case "bay": {
      const d = Math.min(45, w * 0.25);
      return [cut, { d: `M ${-h} ${-t} L ${-h + d} ${-t - d} H ${h - d} L ${h} ${-t} Z`, fill: "#ffffff", stroke: INK, width: 1.2 }, frame, glass, jambs];
    }
    case "french":
      return [
        cut,
        frame,
        glass,
        { d: `M 0 ${t} A ${h} ${h} 0 0 1 ${-h} ${t + h} M 0 ${t} A ${h} ${h} 0 0 0 ${h} ${t + h}`, stroke: GREY, width: 1, dash: "4 3" },
        { d: `M ${-h} ${t} V ${t + h} M ${h} ${t} V ${t + h}`, stroke: GREY, width: 1.2 },
        jambs,
      ];
  }
}

/** SVG transform that places an opening's frame on the plan. */
export const openingTransform = (o: Opening) => `translate(${o.x} ${o.y}) rotate(${o.angle}) scale(${o.hinge ? -1 : 1} ${o.flip ? -1 : 1})`;

/** Draws an opening onto a 2D canvas (PNG export). */
export function drawOpening(ctx: CanvasRenderingContext2D, o: Opening) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate((o.angle * Math.PI) / 180);
  ctx.scale(o.hinge ? -1 : 1, o.flip ? -1 : 1);
  for (const s of openingShapes(o.kind, o.width, o.thickness)) {
    const path = new Path2D(s.d);
    if (s.fill) {
      ctx.fillStyle = s.fill;
      ctx.fill(path);
    }
    if (s.stroke) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.width ?? 1;
      ctx.setLineDash(s.dash ? s.dash.split(" ").map(Number) : []);
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

export function drawColumn(ctx: CanvasRenderingContext2D, c: Column) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  if (c.round) ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2);
  else ctx.rect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size);
  ctx.fill();
}
