"use client";

import type { Shape2D, ShapeKind } from "@/modules/office-designer/data/types";
import type { Strings } from "../i18n";
import { dist, type Pt } from "./geometry";

/**
 * Free 2D drawing on the plan: half circles (arcs), circles, lines, rectangles, text and dimension lines.
 * Everything a shape needs is here: making it from a drag, drawing it (SVG and PNG export), moving and turning it,
 * and its properties panel.
 */

export const SHAPE_KINDS: ShapeKind[] = ["arc", "circle", "line", "rect", "text", "dim"];
export const COLORS = ["#1b1b1b", "#5b6470", "#2563eb", "#dc2626", "#16a34a", "#d97706"];
const DIM_COLOR = "#2563eb";

const rad = (deg: number) => (deg * Math.PI) / 180;
const round = (v: number) => Math.round(v * 10) / 10;

/** A new shape from a drag (a → b); text from a click at a. Null when the drag is too small. */
export function makeShape(kind: ShapeKind, a: Pt, b: Pt, id: string, defaultText: string): Shape2D | null {
  const base = { id, kind, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  switch (kind) {
    case "line":
      return dist(a, b) < 10 ? null : { ...base, width: 2, color: COLORS[0] };
    case "dim":
      return dist(a, b) < 10 ? null : { ...base, width: 1.5, color: DIM_COLOR };
    case "rect":
      return Math.abs(b.x - a.x) < 10 || Math.abs(b.y - a.y) < 10 ? null : { ...base, width: 2, color: COLORS[0] };
    case "circle":
      return dist(a, b) < 10 ? null : { ...base, x2: a.x, y2: a.y, r: round(dist(a, b)), width: 12, color: COLORS[0] };
    case "arc": {
      // a → b is the diameter; the half circle bulges to the right of a → b (going from a towards smaller angles)
      if (dist(a, b) < 20) return null;
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const a0 = (Math.atan2(a.y - c.y, a.x - c.x) * 180) / Math.PI;
      return { ...base, x1: round(c.x), y1: round(c.y), x2: round(c.x), y2: round(c.y), r: round(dist(a, b) / 2), a0: round(a0), sweep: -180, width: 12, color: COLORS[0] };
    }
    case "text":
      return { ...base, x2: a.x, y2: a.y, text: defaultText, size: 30, width: 0, color: COLORS[0] };
  }
}

/** The two ends of an arc. */
function arcEnds(s: Shape2D) {
  const r = s.r ?? 0;
  const a0 = rad(s.a0 ?? 0);
  const a1 = rad((s.a0 ?? 0) + (s.sweep ?? 180));
  return [
    { x: s.x1 + r * Math.cos(a0), y: s.y1 + r * Math.sin(a0) },
    { x: s.x1 + r * Math.cos(a1), y: s.y1 + r * Math.sin(a1) },
  ];
}

/** SVG path of an arc (a full turn is drawn as a circle). */
export function arcPath(s: Shape2D) {
  const r = s.r ?? 0;
  const sweep = s.sweep ?? 180;
  if (Math.abs(sweep) >= 359.9) return `M ${s.x1 - r} ${s.y1} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  const [p0, p1] = arcEnds(s);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 1 : 0} ${p1.x} ${p1.y}`;
}

const box = (s: Shape2D) => ({ x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) });
const dash = (s: Shape2D) => (s.dashed ? `${Math.max(4, s.width * 4)} ${Math.max(3, s.width * 3)}` : undefined);
const tint = (hex: string) => `${hex}22`;
const textWidth = (s: Shape2D) => (s.text ?? "").length * (s.size ?? 30) * 0.58;

/** Ticks and the length of a dimension line, in the line's own frame. */
function dimParts(s: Shape2D, labelSize: number) {
  const len = dist({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
  let angle = (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;
  const upright = angle > 90 || angle <= -90;
  if (upright) angle += 180;
  return { len, angle, tick: Math.max(8, labelSize * 0.6), cx: (s.x1 + s.x2) / 2, cy: (s.y1 + s.y2) / 2 };
}

/** One shape on the plan, with a wider invisible outline to click, and its selection highlight. */
export function ShapeView({ s, selected, zoom, onDown }: { s: Shape2D; selected: boolean; zoom: number; onDown?: (e: React.PointerEvent) => void }) {
  const hit = Math.max(s.width, 10 / zoom);
  const common = { stroke: s.color, strokeWidth: s.width, strokeDasharray: dash(s), strokeLinecap: "round" as const };
  const glow = { stroke: "#2563eb", strokeOpacity: 0.35, strokeWidth: s.width + 8 / zoom, fill: "none", pointerEvents: "none" as const };
  const grab = { stroke: "transparent", strokeWidth: hit, fill: "none", className: "shape-hit", onPointerDown: onDown, pointerEvents: onDown ? undefined : ("none" as const) };
  switch (s.kind) {
    case "line":
      return (
        <g>
          {selected && <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...glow} />}
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...common} pointerEvents="none" />
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...grab} />
        </g>
      );
    case "rect": {
      const b = box(s);
      return (
        <g>
          {selected && <rect x={b.x} y={b.y} width={b.w} height={b.h} {...glow} />}
          <rect x={b.x} y={b.y} width={b.w} height={b.h} {...common} fill={s.fill ? tint(s.color) : "none"} pointerEvents="none" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} {...grab} fill={s.fill ? "transparent" : "none"} />
        </g>
      );
    }
    case "circle":
      return (
        <g>
          {selected && <circle cx={s.x1} cy={s.y1} r={s.r} {...glow} />}
          <circle cx={s.x1} cy={s.y1} r={s.r} {...common} fill={s.fill ? tint(s.color) : "none"} pointerEvents="none" />
          <circle cx={s.x1} cy={s.y1} r={s.r} {...grab} fill={s.fill ? "transparent" : "none"} />
        </g>
      );
    case "arc": {
      const d = arcPath(s);
      return (
        <g>
          {selected && <path d={d} {...glow} />}
          <path d={d} {...common} strokeLinecap="butt" fill="none" pointerEvents="none" />
          <path d={d} {...grab} />
        </g>
      );
    }
    case "dim": {
      const label = Math.max(14, 12 / zoom);
      const p = dimParts(s, label);
      return (
        <g>
          {selected && <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...glow} />}
          <g transform={`translate(${p.cx} ${p.cy}) rotate(${p.angle})`} pointerEvents="none">
            <line x1={-p.len / 2} y1={0} x2={p.len / 2} y2={0} stroke={s.color} strokeWidth={s.width} />
            <line x1={-p.len / 2} y1={-p.tick} x2={-p.len / 2} y2={p.tick} stroke={s.color} strokeWidth={s.width} />
            <line x1={p.len / 2} y1={-p.tick} x2={p.len / 2} y2={p.tick} stroke={s.color} strokeWidth={s.width} />
            <text y={-p.tick * 0.6} textAnchor="middle" fontSize={label} fontWeight={700} fill={s.color} className="shape-label">
              {Math.round(p.len)} cm
            </text>
          </g>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...grab} />
        </g>
      );
    }
    case "text": {
      const w = textWidth(s);
      const h = (s.size ?? 30) * 1.2;
      return (
        <g>
          {selected && <rect x={s.x1 - w / 2 - 4} y={s.y1 - h / 2} width={w + 8} height={h} rx={4} fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth={1.5 / zoom} pointerEvents="none" />}
          <text x={s.x1} y={s.y1} textAnchor="middle" dominantBaseline="central" fontSize={s.size} fontWeight={600} fill={s.color} pointerEvents="none">
            {s.text}
          </text>
          <rect x={s.x1 - w / 2} y={s.y1 - h / 2} width={w} height={h} fill="transparent" className="shape-hit" onPointerDown={onDown} pointerEvents={onDown ? undefined : "none"} />
        </g>
      );
    }
  }
}

/** Moves a shape by (dx, dy). */
export const moveShape = (s: Shape2D, dx: number, dy: number): Shape2D => ({ ...s, x1: round(s.x1 + dx), y1: round(s.y1 + dy), x2: round(s.x2 + dx), y2: round(s.y2 + dy) });

/** Turns a shape a quarter with the whole plan (`pt` maps a point the same way the plan does). */
export function turnShape(s: Shape2D, pt: (x: number, y: number) => Pt, cw: boolean): Shape2D {
  const a = pt(s.x1, s.y1);
  const b = pt(s.x2, s.y2);
  return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...(s.kind === "arc" && { a0: (((s.a0 ?? 0) + (cw ? 90 : -90)) % 360 + 360) % 360 }) };
}

/** Draws a shape on a 2D canvas (PNG export). */
export function drawShape(ctx: CanvasRenderingContext2D, s: Shape2D) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = s.kind === "arc" ? "butt" : "round";
  const d = dash(s);
  ctx.setLineDash(d ? d.split(" ").map(Number) : []);
  if (s.kind === "line") {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  } else if (s.kind === "rect" || s.kind === "circle" || s.kind === "arc") {
    const path = s.kind === "rect" ? (() => { const b = box(s); return `M ${b.x} ${b.y} h ${b.w} v ${b.h} h ${-b.w} Z`; })() : s.kind === "circle" ? arcPath({ ...s, sweep: 360 }) : arcPath(s);
    const p = new Path2D(path);
    if (s.fill && s.kind !== "arc") {
      ctx.fillStyle = tint(s.color);
      ctx.fill(p);
    }
    ctx.stroke(p);
  } else if (s.kind === "dim") {
    const p = dimParts(s, 16);
    ctx.translate(p.cx, p.cy);
    ctx.rotate(rad(p.angle));
    ctx.beginPath();
    ctx.moveTo(-p.len / 2, 0);
    ctx.lineTo(p.len / 2, 0);
    ctx.moveTo(-p.len / 2, -p.tick);
    ctx.lineTo(-p.len / 2, p.tick);
    ctx.moveTo(p.len / 2, -p.tick);
    ctx.lineTo(p.len / 2, p.tick);
    ctx.stroke();
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(p.len)} cm`, 0, -p.tick * 0.6);
  } else if (s.kind === "text") {
    ctx.font = `600 ${s.size ?? 30}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.text ?? "", s.x1, s.y1);
  }
  ctx.restore();
}

/** The drag preview while drawing a shape. */
export function ShapePreview({ kind, a, b, zoom }: { kind: ShapeKind; a: Pt; b: Pt; zoom: number }) {
  const s = makeShape(kind, a, b, "preview", "");
  if (!s || kind === "text") return null;
  return (
    <g opacity={0.6} pointerEvents="none">
      <ShapeView s={s} selected={false} zoom={zoom} />
    </g>
  );
}

/** Properties of the selected shape. */
export function ShapeInspector({ s, t, change, remove }: { s: Shape2D; t: Strings; change: (next: (s: Shape2D) => Shape2D) => void; remove: () => void }) {
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo));
  const length = dist({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
  return (
    <>
      <h3>{t.shapeKinds[s.kind]}</h3>
      <div className="props">
        {s.kind === "text" && (
          <>
            <label>
              {t.textLabel}
              <input className="input" value={s.text ?? ""} maxLength={60} onChange={(e) => change((x) => ({ ...x, text: e.target.value }))} />
            </label>
            <label>
              {t.textSize}
              <input className="input" type="number" min={8} max={200} value={s.size ?? 30} onChange={(e) => change((x) => ({ ...x, size: num(e.target.value, 8, 200) }))} />
            </label>
          </>
        )}
        {(s.kind === "arc" || s.kind === "circle") && (
          <label>
            {t.radiusCm}
            <input className="input" type="number" min={10} max={3000} value={Math.round(s.r ?? 0)} onChange={(e) => change((x) => ({ ...x, r: num(e.target.value, 10, 3000) }))} />
          </label>
        )}
        {s.kind === "arc" && (
          <>
            <label>
              {t.angleDeg} ({Math.abs(s.sweep ?? 180)}°)
              <input
                type="range"
                dir="ltr"
                min={10}
                max={360}
                step={5}
                value={Math.abs(s.sweep ?? 180)}
                onChange={(e) => change((x) => ({ ...x, sweep: Math.sign(x.sweep ?? 180) * Number(e.target.value) }))}
              />
            </label>
            <div className="row-2">
              <button type="button" className="btn btn-ghost" onClick={() => change((x) => ({ ...x, sweep: -(x.sweep ?? 180) }))}>
                ⇅ {t.flipSide}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => change((x) => ({ ...x, a0: (((x.a0 ?? 0) + 45) % 360) }))}>
                ⟳ 45°
              </button>
            </div>
          </>
        )}
        {(s.kind === "line" || s.kind === "dim") && (
          <label>
            {t.lengthCm}
            <input
              className="input"
              type="number"
              min={10}
              max={5000}
              value={Math.round(length)}
              onChange={(e) =>
                change((x) => {
                  const k = num(e.target.value, 10, 5000) / (length || 1);
                  return { ...x, x2: round(x.x1 + (x.x2 - x.x1) * k), y2: round(x.y1 + (x.y2 - x.y1) * k) };
                })
              }
            />
          </label>
        )}
        {s.kind === "rect" && (
          <div className="row-2">
            <label>
              {t.width}
              <input className="input" type="number" min={10} max={5000} value={Math.round(box(s).w)} onChange={(e) => change((x) => ({ ...x, x2: Math.min(x.x1, x.x2) + num(e.target.value, 10, 5000), x1: Math.min(x.x1, x.x2) }))} />
            </label>
            <label>
              {t.length}
              <input className="input" type="number" min={10} max={5000} value={Math.round(box(s).h)} onChange={(e) => change((x) => ({ ...x, y2: Math.min(x.y1, x.y2) + num(e.target.value, 10, 5000), y1: Math.min(x.y1, x.y2) }))} />
            </label>
          </div>
        )}
        {s.kind !== "text" && (
          <label>
            {t.thicknessCm}
            <input className="input" type="number" min={0.5} max={60} step={0.5} value={s.width} onChange={(e) => change((x) => ({ ...x, width: num(e.target.value, 0.5, 60) }))} />
          </label>
        )}
        <div className="swatches" role="group" aria-label={t.color}>
          {COLORS.map((c) => (
            <button key={c} type="button" className={`swatch${s.color === c ? " swatch-on" : ""}`} style={{ background: c }} aria-label={c} aria-pressed={s.color === c} onClick={() => change((x) => ({ ...x, color: c }))} />
          ))}
        </div>
        {(s.kind === "line" || s.kind === "rect" || s.kind === "circle" || s.kind === "arc") && (
          <label className="toggle">
            <input type="checkbox" checked={!!s.dashed} onChange={(e) => change((x) => ({ ...x, dashed: e.target.checked || undefined }))} />
            {t.dashed}
          </label>
        )}
        {(s.kind === "rect" || s.kind === "circle") && (
          <label className="toggle">
            <input type="checkbox" checked={!!s.fill} onChange={(e) => change((x) => ({ ...x, fill: e.target.checked || undefined }))} />
            {t.fillShape}
          </label>
        )}
        <button type="button" className="btn btn-danger" onClick={remove}>
          {t.remove}
        </button>
      </div>
    </>
  );
}
