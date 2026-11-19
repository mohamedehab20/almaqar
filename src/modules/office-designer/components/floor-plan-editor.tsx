"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { addCustomItems, isCustomItem, removeCustomItem, useCustomItems, withInlineImages } from "@/modules/office-designer/data/custom";
import { ITEMS, itemById } from "@/modules/office-designer/data/items";
import { emptyRoom, sampleOffice } from "@/modules/office-designer/data/presets";
import { CATEGORIES, type Category, type Column, type Door, type FloorZone, type FurnitureItem, type Layout, type Opening, type OpeningKind, type Placed, type Wall } from "@/modules/office-designer/data/types";
import type { Lang, Strings } from "./i18n";
import { Catalog } from "./catalog";
import { DrawPanel, DROPPABLE, type Tool } from "./plan/draw-panel";
import { rotateLayout, rotatePlaced } from "./plan/rotate";
import {
  COLUMN_SIZE,
  DOOR_KINDS,
  GRID,
  OPENING_KINDS,
  OPENING_WIDTH,
  WALL_THICKNESS,
  WINDOW_KINDS,
  dist,
  drawColumn,
  drawOpening,
  onWall,
  openingShapes,
  openingTransform,
  project,
  snapPoint,
  wallAngle,
  wallLength,
  type Pt,
} from "./plan/geometry";
import { itemPicture, useItemPictures } from "@/modules/office-designer/data/raster";
import { TopViewIcon } from "./top-view-icon";
import { UploadDialog } from "./upload-dialog";

const MARGIN = 50; // cm of free space drawn around the plan

/** Floor coverings and things that sit on a desk do not collide with furniture. */
const ignoresOverlap = (item: FurnitureItem) => item.subcategory === "rug" || item.category === "tech" || (item.category === "plants" && item.widthCm <= 30);

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Drawn size of a piece after its scale. */
const sized = (p: Placed, item: FurnitureItem) => ({ w: Math.round(item.widthCm * (p.scale ?? 1)), d: Math.round(item.depthCm * (p.scale ?? 1)) });

/** The footprint on the floor (rotation swaps width and depth at 90° / 270°). */
function footprint(p: Placed, item: FurnitureItem): Box {
  const turned = p.rotation === 90 || p.rotation === 270;
  const { w, d } = sized(p, item);
  return { x: p.x, y: p.y, w: turned ? d : w, h: turned ? w : d };
}

const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 });

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const ROT = [0, 90, 180, 270] as const;

/** A layout's walls; older layouts without any are a plain rectangle. */
const wallsOf = (l: Layout) => l.walls ?? emptyRoom(l.roomWidthCm, l.roomLengthCm).walls!;
const floorsOf = (l: Layout): FloorZone[] => l.floors ?? [{ x: 0, y: 0, w: l.roomWidthCm, h: l.roomLengthCm, kind: "tile" }];
/** Still just the empty starter room, so a size change can redraw its walls. */
const isPlainRoom = (l: Layout) => !l.openings?.length && !l.doors?.length && JSON.stringify(l.walls) === JSON.stringify(emptyRoom(l.roomWidthCm, l.roomLengthCm).walls);

/** Where the plan is kept: the company's design on the server, or this browser in the public demo. */
export type DesignStore = {
  load: () => Promise<{ layout: unknown; canEdit: boolean; uploads: boolean }>;
  save: (layout: Layout) => Promise<"ok" | "forbidden" | "failed">;
};

/**
 * Accepts only a well-formed layout (walls, doors, openings, columns and floors are optional). Pieces whose item
 * is unknown here (an uploaded piece that was removed) are skipped.
 */
function parseLayout(v: unknown): Layout | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isNum(o.roomWidthCm) || !isNum(o.roomLengthCm) || !Array.isArray(o.placed)) return null;
  const placed: Placed[] = [];
  for (const p of o.placed as Record<string, unknown>[]) {
    if (!p || typeof p.itemId !== "string" || !isNum(p.x) || !isNum(p.y)) return null;
    if (!itemById(p.itemId)) continue;
    const rotation = ROT.includes(p.rotation as Placed["rotation"]) ? (p.rotation as Placed["rotation"]) : 0;
    const scale = isNum(p.scale) ? clamp(p.scale, SCALE_MIN, SCALE_MAX) : 1;
    placed.push({ uid: typeof p.uid === "string" ? p.uid : uid(), itemId: p.itemId, x: p.x, y: p.y, rotation, ...(scale !== 1 && { scale }), ...(p.mirror === true && { mirror: true }) });
  }
  const list = <T,>(x: unknown, ok: (e: Record<string, unknown>) => boolean): T[] | undefined =>
    Array.isArray(x) ? (x.filter((e) => e && typeof e === "object" && ok(e as Record<string, unknown>)) as T[]) : undefined;
  return {
    roomWidthCm: clamp(o.roomWidthCm, 100, 5000),
    roomLengthCm: clamp(o.roomLengthCm, 100, 5000),
    placed,
    walls: list<Wall>(o.walls, (w) => [w.x1, w.y1, w.x2, w.y2, w.thickness].every(isNum)),
    doors: list<Door>(o.doors, (d) => [d.x, d.y, d.width].every(isNum) && ROT.includes(d.rotation as Door["rotation"])),
    floors: list<FloorZone>(o.floors, (f) => [f.x, f.y, f.w, f.h].every(isNum) && ["tile", "wet", "wood", "deck"].includes(f.kind as string)),
    openings: list<Opening>(o.openings, (e) => typeof e.id === "string" && [e.x, e.y, e.angle, e.width, e.thickness].every(isNum) && OPENING_KINDS.includes(e.kind as OpeningKind)),
    columns: list<Column>(o.columns, (c) => typeof c.id === "string" && [c.x, c.y, c.size].every(isNum)),
  };
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // uploaded images come from Storage; keeps the PNG export canvas readable
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const FLOOR_FILL: Record<FloorZone["kind"], string> = { tile: "url(#floor-tile)", wet: "url(#floor-wet)", wood: "url(#floor-wood)", deck: "url(#floor-deck)" };
const FLOOR_COLOR: Record<FloorZone["kind"], string> = { tile: "#efeeec", wet: "#f4f4f2", wood: "#e2cfb2", deck: "#e8e5df" };

/** What is selected besides furniture: a wall (by index), a door / window, or a column. */
type Pick = { kind: "wall"; index: number } | { kind: "opening"; id: string } | { kind: "column"; id: string } | { kind: "floor"; index: number } | null;
const FLOOR_KINDS: FloorZone["kind"][] = ["tile", "wood", "wet", "deck"];

/** A drag in progress on the plan. */
type Gesture =
  | { type: "item"; uid: string; dx: number; dy: number; moved: boolean }
  | { type: "wall"; index: number; start: Pt; walls: Wall[]; links: { index: number; end: 1 | 2; of: 1 | 2 }[]; on: Attached; moved: boolean }
  | { type: "end"; index: number; end: 1 | 2; walls: Wall[]; links: { index: number; end: 1 | 2 }[]; on: Attached; moved: boolean }
  | { type: "opening"; id: string; moved: boolean }
  | { type: "column"; id: string; dx: number; dy: number; moved: boolean };

const isOpeningTool = (t: Tool): t is OpeningKind => OPENING_KINDS.includes(t as OpeningKind);
const snapGrid = (p: Pt): Pt => ({ x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID });

/** Which wall each door / window sits on, and where along it (so it can follow the wall when the wall moves). */
type Attached = { id: string; index: number; t: number }[];
function attach(openings: Opening[] | undefined, walls: Wall[]): Attached {
  const out: Attached = [];
  for (const o of openings ?? []) {
    const index = walls.findIndex((w) => project(o, w).d < 1);
    if (index >= 0) out.push({ id: o.id, index, t: project(o, walls[index]).t });
  }
  return out;
}
const openingsOn = (l: Layout, index: number) => attach(l.openings, wallsOf(l)).filter((a) => a.index === index);

/** Puts doors and windows back on their (moved) walls at their place along them. */
function refit(openings: Opening[] | undefined, walls: Wall[], on: Attached) {
  if (!openings || !on.length) return openings;
  return openings.map((o) => {
    const at = on.find((x) => x.id === o.id);
    const w = at && walls[at.index];
    return w ? { ...o, x: w.x1 + at.t * (w.x2 - w.x1), y: w.y1 + at.t * (w.y2 - w.y1), angle: wallAngle(w), thickness: w.thickness } : o;
  });
}

/** Text along a wall (or a line being drawn): its length in cm, kept upright. */
function LengthLabel({ a, b, zoom, side = 1 }: { a: Pt; b: Pt; zoom: number; side?: number }) {
  const len = dist(a, b);
  if (len < 1) return null;
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90 || angle <= -90) angle += 180;
  const off = (16 / zoom) * side;
  const nx = (-(b.y - a.y) / len) * off;
  const ny = ((b.x - a.x) / len) * off;
  const x = (a.x + b.x) / 2 + nx;
  const y = (a.y + b.y) / 2 + ny;
  return (
    <text x={x} y={y} transform={`rotate(${angle} ${x} ${y})`} textAnchor="middle" dominantBaseline="middle" className="len-label" style={{ fontSize: 12 / zoom, strokeWidth: 4 / zoom }}>
      {Math.round(len)} cm
    </text>
  );
}

function OpeningSymbol({ o }: { o: Opening }) {
  return (
    <>
      {openingShapes(o.kind, o.width, o.thickness).map((s, i) => (
        <path key={i} d={s.d} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
      ))}
    </>
  );
}

const ICON: Record<string, string> = {
  save: "M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6",
  undo: "M9 7L4 12l5 5 M4 12h11a5 5 0 0 1 0 10h-3",
  redo: "M15 7l5 5-5 5 M20 12H9a5 5 0 0 0 0 10h3",
  clear: "M14 4l6 6-9 9H6l-3-3z M9 9l6 6 M11 19h9",
  open: "M3 7h6l2 2h10v10H3z",
  export: "M12 3v12 M7 8l5-5 5 5 M4 15v5h16v-5",
  draw: "M4 20h4L19 9l-4-4L4 16z M13 7l4 4 M3 3h6 M3 3v6",
  furniture: "M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3 M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z M5 18v2 M19 18v2",
  catalog: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
};

/** What fills the editor under the top bar: the drawing tools, the furniture library, or the catalog. */
type Mode = "draw" | "furniture" | "catalog";
const TopIcon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICON[name]} />
  </svg>
);

/**
 * The office plan editor at true scale (1 unit = 1 cm). The top bar, pinned, has two groups: save, undo / redo,
 * clear, open, export; and what to show (drawing tools, furniture, catalog).
 * Left: "Draw Floor Plan" (walls, rooms, doors, windows, columns) or "Furniture Plan" (the furniture library).
 * Right: the properties of whatever is selected. Furniture: drag, R rotates, M mirrors, right-click for more.
 */
export function FloorPlan({ lang, t, shadow, setShadow, store }: { lang: Lang; t: Strings; shadow: boolean; setShadow: (v: boolean) => void; store: DesignStore }) {
  const [layout, setLayout] = useState<Layout>(() => sampleOffice());
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(0.62); // screen px per cm
  const [showClearance, setShowClearance] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [hoverDrop, setHoverDrop] = useState(false);
  const [menu, setMenu] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState<Mode>("draw");
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<Pt | null>(null); // where the wall being drawn starts
  const [chainStart, setChainStart] = useState<Pt | null>(null);
  const [roomStart, setRoomStart] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [past, setPast] = useState<Layout[]>([]);
  const [future, setFuture] = useState<Layout[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [access, setAccess] = useState({ canEdit: false, uploads: false });
  const custom = useCustomItems();
  const lastSaved = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const layoutRef = useRef(layout);

  // Load the saved design once (the uploaded pieces it may use come with it)
  useEffect(() => {
    let live = true;
    store
      .load()
      .then(({ layout: raw, canEdit, uploads }) => {
        if (!live) return;
        const saved = parseLayout(raw);
        if (saved) setLayout(saved);
        lastSaved.current = JSON.stringify(saved ?? null);
        setAccess({ canEdit, uploads });
      })
      .catch(() => live && setMessage(t.loadFailed))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [store, t.loadFailed]);

  /** Saves the plan if it changed since the last save. */
  const persist = useCallback(
    async (next: Layout, announce: boolean) => {
      const json = JSON.stringify(next);
      if (json === lastSaved.current && !announce) return;
      const result = await store.save(next);
      if (result === "ok") {
        lastSaved.current = json;
        if (announce) {
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1800);
        }
      } else setMessage(result === "forbidden" ? t.viewOnly : t.saveFailed);
    },
    [store, t.viewOnly, t.saveFailed],
  );
  // Saves on its own a moment after the last change (only for those who may change the design)
  useEffect(() => {
    layoutRef.current = layout;
    if (!loaded || !access.canEdit) return;
    const timer = setTimeout(() => persist(layout, false), 1500);
    return () => clearTimeout(timer);
  }, [layout, loaded, access.canEdit, persist]);

  // ---------- History ----------
  /** Remembers the layout as it is now, before a change, so Undo can go back to it. */
  const record = useCallback(() => {
    setPast((p) => [...p.slice(-99), layoutRef.current]);
    setFuture([]);
  }, []);
  const commit = (change: (l: Layout) => Layout) => {
    record();
    setLayout(change);
  };
  const deselect = () => {
    setSelected(null);
    setPick(null);
    setMenu(null);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [...f, layoutRef.current]);
    setLayout(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    deselect();
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, layoutRef.current]);
    setLayout(future[future.length - 1]);
    setFuture((f) => f.slice(0, -1));
    deselect();
  };

  const { roomWidthCm: W, roomLengthCm: L } = layout;
  const walls = wallsOf(layout);
  const floors = floorsOf(layout);
  const openings = layout.openings ?? [];
  const columns = layout.columns ?? [];
  const reach = 14 / zoom; // snapping distance: 14 screen px
  const placedItems = useMemo(() => layout.placed.map((p) => ({ p, item: itemById(p.itemId)! })).filter((x) => x.item), [layout.placed]);
  // Pieces in the plan are turned and flipped, so they use bitmaps of the drawings (see data/raster.ts)
  const placedKinds = useMemo(() => [...new Map(placedItems.map(({ item }) => [item.id, item])).values()], [placedItems]);
  useItemPictures(placedKinds);

  // Red: an item whose footprint overlaps another item, or whose clearance zone covers another item
  const conflicts = useMemo(() => {
    const bad = new Set<string>();
    const solid = placedItems.filter(({ item }) => !ignoresOverlap(item));
    for (let i = 0; i < solid.length; i++) {
      for (let j = 0; j < solid.length; j++) {
        if (i === j) continue;
        const a = solid[i];
        const b = solid[j];
        const fa = footprint(a.p, a.item);
        const fb = footprint(b.p, b.item);
        if (overlap(fa, fb) || (showClearance && overlap(grow(fa, a.item.clearanceCm), fb))) {
          bad.add(a.p.uid);
          bad.add(b.p.uid);
        }
      }
    }
    return bad;
  }, [placedItems, showClearance]);

  const usedM2 = placedItems.filter(({ item }) => item.subcategory !== "rug").reduce((sum, { p, item }) => {
    const f = footprint(p, item);
    return sum + (f.w * f.h) / 10000;
  }, 0);

  /** Screen point → plan cm (the SVG's own coordinate system). */
  const toCm = useCallback((clientX: number, clientY: number) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }, []);
  const inPlan = (p: Pt): Pt => ({ x: clamp(p.x, 0, W), y: clamp(p.y, 0, L) });

  // ---------- Furniture ----------
  const keepInRoom = useCallback(
    (p: Placed): Placed => {
      const f = footprint(p, itemById(p.itemId)!);
      return { ...p, x: Math.round(clamp(p.x, 0, Math.max(0, W - f.w))), y: Math.round(clamp(p.y, 0, Math.max(0, L - f.h))) };
    },
    [W, L],
  );
  const update = (id: string, change: (p: Placed) => Placed) => setLayout((l) => ({ ...l, placed: l.placed.map((p) => (p.uid === id ? change(p) : p)) }));

  const add = (item: FurnitureItem, centreX: number, centreY: number) => {
    const p = keepInRoom({ uid: uid(), itemId: item.id, x: centreX - item.widthCm / 2, y: centreY - item.depthCm / 2, rotation: 0 });
    commit((l) => ({ ...l, placed: [...l.placed, p] }));
    setSelected(p.uid);
    setPick(null);
  };

  /** Changes a piece around its centre (rotate, scale), then keeps it inside the plan. */
  const reshape = useCallback(
    (id: string, change: (p: Placed) => Placed) => {
      record();
      setLayout((l) => ({
        ...l,
        placed: l.placed.map((p) => {
          if (p.uid !== id) return p;
          const item = itemById(p.itemId)!;
          const before = footprint(p, item);
          const next = change(p);
          const after = footprint(next, item);
          const x = p.x + (before.w - after.w) / 2;
          const y = p.y + (before.h - after.h) / 2;
          return { ...next, x: Math.round(clamp(x, 0, Math.max(0, l.roomWidthCm - after.w))), y: Math.round(clamp(y, 0, Math.max(0, l.roomLengthCm - after.h))) };
        }),
      }));
    },
    [record],
  );
  const rotate = (id: string) => reshape(id, (p) => ({ ...p, rotation: ((p.rotation + 90) % 360) as Placed["rotation"] }));
  const setScale = (id: string, s: number) => reshape(id, (p) => ({ ...p, scale: +clamp(s, SCALE_MIN, SCALE_MAX).toFixed(2) }));
  const mirror = (id: string) => {
    record();
    update(id, (p) => ({ ...p, mirror: !p.mirror }));
  };
  const duplicate = (id: string) => {
    const p = layout.placed.find((x) => x.uid === id);
    if (!p) return;
    const copy = keepInRoom({ ...p, uid: uid(), x: p.x + 20, y: p.y + 20 });
    commit((l) => ({ ...l, placed: [...l.placed, copy] }));
    setSelected(copy.uid);
  };
  const remove = (id: string) => {
    commit((l) => ({ ...l, placed: l.placed.filter((p) => p.uid !== id) }));
    setSelected(null);
  };

  // ---------- Walls, doors, windows, columns ----------
  const changeTool = (next: Tool) => {
    setTool(next);
    setDraft(null);
    setChainStart(null);
    setRoomStart(null);
    setCursor(null);
    setMessage(null);
    if (next !== "select") deselect();
  };
  const endChain = () => {
    setDraft(null);
    setChainStart(null);
  };
  const setWalls = (l: Layout, next: Wall[]): Layout => ({ ...l, walls: next });

  const addOpening = (kind: OpeningKind, at: Pt) => {
    const width = OPENING_WIDTH[kind];
    const spot = onWall(at, walls, width, 40);
    if (!spot) {
      setMessage(t.dropOnWall);
      return;
    }
    const o: Opening = { id: uid(), kind, width, ...spot };
    commit((l) => ({ ...l, openings: [...(l.openings ?? []), o] }));
    changeTool("select");
    setPick({ kind: "opening", id: o.id });
  };
  const addColumn = (round: boolean, at: Pt) => {
    const p = inPlan(snapGrid(at));
    const c: Column = { id: uid(), x: p.x, y: p.y, size: COLUMN_SIZE, ...(round && { round: true }) };
    commit((l) => ({ ...l, columns: [...(l.columns ?? []), c] }));
    changeTool("select");
    setPick({ kind: "column", id: c.id });
  };
  const placeTool = (k: Tool, at: Pt) => {
    if (isOpeningTool(k)) addOpening(k, at);
    else if (k === "column" || k === "roundColumn") addColumn(k === "roundColumn", at);
  };

  const editWall = (index: number, change: (w: Wall) => Wall) =>
    commit((l) => {
      const list = wallsOf(l);
      const before = list[index];
      const after = change(before);
      // Walls joined at the moved end follow it; doors and windows on the wall stay on it
      const ends = [1, 2] as const;
      const next = list.map((w, i) => {
        if (i === index) return after;
        let out = w;
        for (const e of ends) {
          const old = e === 1 ? { x: before.x1, y: before.y1 } : { x: before.x2, y: before.y2 };
          const now = e === 1 ? { x: after.x1, y: after.y1 } : { x: after.x2, y: after.y2 };
          if (old.x === now.x && old.y === now.y) continue;
          if (dist(old, { x: w.x1, y: w.y1 }) < 1) out = { ...out, x1: now.x, y1: now.y };
          if (dist(old, { x: w.x2, y: w.y2 }) < 1) out = { ...out, x2: now.x, y2: now.y };
        }
        return out;
      });
      return { ...setWalls(l, next), openings: refit(l.openings, next, attach(l.openings, list)) };
    });
  const setWallLength = (index: number, len: number) =>
    editWall(index, (w) => {
      const l0 = wallLength(w) || 1;
      const k = clamp(len, 10, 5000) / l0;
      return { ...w, x2: Math.round(w.x1 + (w.x2 - w.x1) * k), y2: Math.round(w.y1 + (w.y2 - w.y1) * k) };
    });
  const deleteWall = (index: number) =>
    commit((l) => {
      const gone = new Set(openingsOn(l, index).map((o) => o.id));
      const room = wallsOf(l)[index]?.room;
      const rest = wallsOf(l).filter((_, i) => i !== index);
      // The last wall of a drawn room takes the room's floor with it
      const floors = room && !rest.some((w) => w.room === room) ? l.floors?.filter((f) => f.room !== room) : l.floors;
      return { ...setWalls(l, rest), floors, openings: l.openings?.filter((o) => !gone.has(o.id)) };
    });
  const editOpening = (id: string, change: (o: Opening) => Opening) => commit((l) => ({ ...l, openings: (l.openings ?? []).map((o) => (o.id === id ? change(o) : o)) }));
  const editColumn = (id: string, change: (c: Column) => Column) => commit((l) => ({ ...l, columns: (l.columns ?? []).map((c) => (c.id === id ? change(c) : c)) }));
  const deletePick = () => {
    if (!pick) return;
    if (pick.kind === "wall") deleteWall(pick.index);
    else if (pick.kind === "floor") commit((l) => ({ ...l, floors: floorsOf(l).filter((_, i) => i !== pick.index) }));
    else if (pick.kind === "opening") commit((l) => ({ ...l, openings: (l.openings ?? []).filter((o) => o.id !== pick.id) }));
    else commit((l) => ({ ...l, columns: (l.columns ?? []).filter((c) => c.id !== pick.id) }));
    setPick(null);
  };

  // ---------- Pointer on the plan ----------
  const onCanvasDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const at = toCm(e.clientX, e.clientY);
    setExportOpen(false);
    if (tool === "select") return deselect();
    if (tool === "wall" || tool === "glass") {
      const p = inPlan(snapPoint(at, walls, { from: draft, straight: e.shiftKey, reach }));
      if (!draft) {
        setDraft(p);
        setChainStart(p);
        return;
      }
      if (dist(draft, p) < 10) return;
      const w: Wall = { x1: draft.x, y1: draft.y, x2: p.x, y2: p.y, thickness: tool === "glass" ? 6 : WALL_THICKNESS, ...(tool === "glass" && { glass: true }) };
      commit((l) => setWalls(l, [...wallsOf(l), w]));
      if (chainStart && dist(p, chainStart) < 1) endChain(); // closed the loop
      else setDraft(p);
      return;
    }
    if (tool === "room") {
      setRoomStart(inPlan(snapPoint(at, walls, { reach })));
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    placeTool(tool, at);
  };

  const onCanvasMove = (e: React.PointerEvent) => {
    const at = toCm(e.clientX, e.clientY);
    const g = gesture.current;
    if (g) {
      if (!g.moved) {
        g.moved = true;
        record();
      }
      if (g.type === "item") update(g.uid, (p) => keepInRoom({ ...p, x: at.x - g.dx, y: at.y - g.dy }));
      else if (g.type === "column") setLayout((l) => ({ ...l, columns: (l.columns ?? []).map((c) => (c.id === g.id ? { ...c, ...inPlan(snapGrid({ x: at.x - g.dx, y: at.y - g.dy })) } : c)) }));
      else if (g.type === "opening") {
        const o = openings.find((x) => x.id === g.id);
        const spot = o && onWall(at, walls, o.width, 40);
        if (spot) setLayout((l) => ({ ...l, openings: (l.openings ?? []).map((x) => (x.id === g.id ? { ...x, ...spot } : x)) }));
      } else if (g.type === "wall") {
        const dx = Math.round((at.x - g.start.x) / GRID) * GRID;
        const dy = Math.round((at.y - g.start.y) / GRID) * GRID;
        const moved = g.walls.map((w, i) => {
          if (i === g.index) return { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy };
          let out = w;
          for (const link of g.links.filter((k) => k.index === i)) out = link.end === 1 ? { ...out, x1: w.x1 + dx, y1: w.y1 + dy } : { ...out, x2: w.x2 + dx, y2: w.y2 + dy };
          return out;
        });
        setLayout((l) => ({ ...setWalls(l, moved), openings: refit(l.openings, moved, g.on) }));
      } else if (g.type === "end") {
        const self = g.walls[g.index];
        const other = g.end === 1 ? { x: self.x2, y: self.y2 } : { x: self.x1, y: self.y1 };
        const p = inPlan(snapPoint(at, g.walls.filter((_, i) => i !== g.index), { from: other, straight: e.shiftKey, reach }));
        const moved = g.walls.map((w, i) => {
          const hit = i === g.index ? g.end : g.links.find((k) => k.index === i)?.end;
          if (!hit) return w;
          return hit === 1 ? { ...w, x1: p.x, y1: p.y } : { ...w, x2: p.x, y2: p.y };
        });
        setLayout((l) => ({ ...setWalls(l, moved), openings: refit(l.openings, moved, g.on) }));
      }
      return;
    }
    if (tool === "select") return;
    if (tool === "wall" || tool === "glass") setCursor(inPlan(snapPoint(at, walls, { from: draft, straight: e.shiftKey, reach })));
    else if (tool === "room") setCursor(inPlan(roomStart ? snapGrid(at) : snapPoint(at, walls, { reach })));
    else setCursor(at);
  };

  const onCanvasUp = () => {
    gesture.current = null;
    if (tool === "room" && roomStart && cursor) {
      const x1 = Math.min(roomStart.x, cursor.x);
      const y1 = Math.min(roomStart.y, cursor.y);
      const x2 = Math.max(roomStart.x, cursor.x);
      const y2 = Math.max(roomStart.y, cursor.y);
      if (x2 - x1 >= 50 && y2 - y1 >= 50) {
        const th = WALL_THICKNESS;
        const id = uid(); // ties the four walls to their floor
        const room: Wall[] = [
          { x1, y1, x2, y2: y1, thickness: th, room: id },
          { x1: x2, y1, x2, y2, thickness: th, room: id },
          { x1: x2, y1: y2, x2: x1, y2, thickness: th, room: id },
          { x1, y1: y2, x2: x1, y2: y1, thickness: th, room: id },
        ];
        commit((l) => ({ ...setWalls(l, [...wallsOf(l), ...room]), floors: [...(l.floors ?? []), { x: x1, y: y1, w: x2 - x1, h: y2 - y1, kind: "wood", room: id }] }));
      }
      setRoomStart(null);
    }
  };

  const onItemDown = (e: React.PointerEvent, p: Placed) => {
    e.stopPropagation();
    setSelected(p.uid);
    setPick(null);
    setMenu(null);
    if (e.button !== 0) return; // right-click opens the menu instead of dragging
    const at = toCm(e.clientX, e.clientY);
    gesture.current = { type: "item", uid: p.uid, dx: at.x - p.x, dy: at.y - p.y, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onWallDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(null);
    setPick({ kind: "wall", index });
    const w = walls[index];
    const links: { index: number; end: 1 | 2; of: 1 | 2 }[] = [];
    walls.forEach((o, i) => {
      if (i === index) return;
      for (const side of [1, 2] as const) {
        const p = side === 1 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
        if (dist(p, { x: o.x1, y: o.y1 }) < 1) links.push({ index: i, end: 1, of: side });
        if (dist(p, { x: o.x2, y: o.y2 }) < 1) links.push({ index: i, end: 2, of: side });
      }
    });
    gesture.current = { type: "wall", index, start: toCm(e.clientX, e.clientY), walls, links, on: attach(openings, walls), moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onEndDown = (e: React.PointerEvent, index: number, end: 1 | 2) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const w = walls[index];
    const p = end === 1 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    const links: { index: number; end: 1 | 2 }[] = [];
    walls.forEach((o, i) => {
      if (i === index) return;
      if (dist(p, { x: o.x1, y: o.y1 }) < 1) links.push({ index: i, end: 1 });
      if (dist(p, { x: o.x2, y: o.y2 }) < 1) links.push({ index: i, end: 2 });
    });
    gesture.current = { type: "end", index, end, walls, links, on: attach(openings, walls), moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onOpeningDown = (e: React.PointerEvent, o: Opening) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(null);
    setPick({ kind: "opening", id: o.id });
    gesture.current = { type: "opening", id: o.id, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onColumnDown = (e: React.PointerEvent, c: Column) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(null);
    setPick({ kind: "column", id: c.id });
    const at = toCm(e.clientX, e.clientY);
    gesture.current = { type: "column", id: c.id, dx: at.x - c.x, dy: at.y - c.y, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  // ---------- Drop from the side panel ----------
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHoverDrop(false);
    const data = e.dataTransfer.getData("text/plain");
    const at = toCm(e.clientX, e.clientY);
    if (data.startsWith("tool:")) {
      const k = data.slice(5) as Tool;
      if (DROPPABLE.includes(k)) placeTool(k, at);
      return;
    }
    const item = itemById(data);
    if (item) add(item, at.x, at.y);
  };

  // ---------- Size, presets, clear ----------
  const setSize = (width: number, length: number) =>
    commit((l) => {
      const w = clamp(width || 100, 100, 5000);
      const h = clamp(length || 100, 100, 5000);
      // The starter room keeps its outer walls on the new size; anything drawn stays as drawn
      return isPlainRoom(l) ? { ...emptyRoom(w, h), placed: l.placed, columns: l.columns } : { ...l, roomWidthCm: w, roomLengthCm: h };
    });
  const loadPreset = (next: Layout) => {
    commit(() => next);
    deselect();
    changeTool("select");
  };
  const clearAll = () => {
    commit((l) => ({ roomWidthCm: l.roomWidthCm, roomLengthCm: l.roomLengthCm, placed: [], walls: [], doors: [], floors: [], openings: [], columns: [] }));
    deselect();
    endChain();
  };
  /** Turns the whole plan a quarter turn (portrait ↔ landscape). */
  const turnPlan = (cw: boolean) => {
    commit((l) => {
      const turned = rotateLayout(l, cw);
      return {
        ...turned,
        placed: l.placed.map((p) => {
          const item = itemById(p.itemId);
          if (!item) return p;
          const f = footprint(p, item);
          return rotatePlaced(p, { w: f.w, h: f.h }, l.roomWidthCm, l.roomLengthCm, cw);
        }),
      };
    });
    setMenu(null);
    endChain();
  };
  const portrait = L >= W;

  const save = () => (access.canEdit ? persist(layout, true) : setMessage(t.viewOnly));

  // ---------- Export / import ----------
  // Uploaded pieces used in the plan travel inside the JSON, so the file opens in another browser too
  const exportJson = async () => {
    const used = new Set(layout.placed.map((p) => p.itemId));
    const customItems = await withInlineImages(custom.filter((i) => used.has(i.id)));
    download("my-company-layout.json", new Blob([JSON.stringify({ ...layout, ...(customItems.length && { customItems }) }, null, 2)], { type: "application/json" }));
  };
  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (Array.isArray(json?.customItems) && !(await addCustomItems(json.customItems.filter(isCustomItem)))) setMessage(t.uploadServerFailed);
      const parsed = parseLayout(json);
      if (!parsed) throw new Error("bad layout");
      commit(() => parsed);
      deselect();
      setMessage(null);
    } catch {
      setMessage(t.importFailed);
    }
  };
  const exportPng = async () => {
    const scale = 2; // px per cm in the image
    const pad = 30;
    const canvas = document.createElement("canvas");
    canvas.width = (W + pad * 2) * scale;
    canvas.height = (L + pad * 2) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W + pad * 2, L + pad * 2);
    ctx.translate(pad, pad);
    for (const f of floors) {
      ctx.fillStyle = FLOOR_COLOR[f.kind];
      ctx.fillRect(f.x, f.y, f.w, f.h);
      const step = f.kind === "wet" ? 30 : f.kind === "deck" ? 15 : 60;
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 0.8;
      for (let x = f.x + step; x < f.x + f.w; x += step) if (f.kind !== "deck") ctx.strokeRect(x, f.y, 0, f.h);
      for (let y = f.y + step; y < f.y + f.h; y += step) ctx.strokeRect(f.x, y, f.w, 0);
    }
    for (const { p, item } of placedItems) {
      const f = footprint(p, item);
      const img = await loadImage(itemPicture(item)).catch(() => null);
      ctx.save();
      ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
      ctx.rotate((p.rotation * Math.PI) / 180);
      if (p.mirror) ctx.scale(-1, 1);
      if (shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
      }
      const { w, d } = sized(p, item);
      if (img) ctx.drawImage(img, -w / 2, -d / 2, w, d);
      ctx.restore();
    }
    for (const w of walls) {
      ctx.strokeStyle = w.glass ? "#9fb7c8" : "#1b1b1b";
      ctx.lineWidth = w.thickness;
      ctx.lineCap = "square";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
    for (const d of layout.doors ?? []) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate((d.rotation * Math.PI) / 180);
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, d.width);
      ctx.arc(0, 0, d.width, Math.PI / 2, 0, true);
      ctx.stroke();
      ctx.restore();
    }
    openings.forEach((o) => drawOpening(ctx, o));
    columns.forEach((c) => drawColumn(ctx, c));
    canvas.toBlob((blob) => blob && download("my-company-plan.png", blob), "image/png");
  };

  // ---------- Keyboard ----------
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const typing = ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "s") {
      e.preventDefault();
      return save();
    }
    if (typing) return;
    if (mod && k === "z") {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && k === "y") {
      e.preventDefault();
      return redo();
    }
    if (mod || uploading) return;
    if (e.key === "Escape") {
      setMenu(null);
      if (draft) endChain();
      else if (roomStart) setRoomStart(null);
      else if (tool !== "select") changeTool("select");
      else deselect();
      return;
    }
    if (k === "v") return changeTool("select");
    if (k === "b") return changeTool("wall");
    if (k === "f") return changeTool("room");
    if (selected) {
      if (k === "r") rotate(selected);
      else if (k === "m") mirror(selected);
      else if (e.key === "Delete" || e.key === "Backspace") remove(selected);
    } else if (pick && (e.key === "Delete" || e.key === "Backspace")) deletePick();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const sel = placedItems.find(({ p }) => p.uid === selected) ?? null;
  const menuOf = menu ? placedItems.find(({ p }) => p.uid === menu.uid) ?? null : null;
  const name = (item: FurnitureItem) => (lang === "ar" ? item.nameAr : item.nameEn);
  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Uploaded pieces first, so a fresh upload is right there
    return [...custom, ...ITEMS].filter((i) => category === "all" || i.category === category).filter(
      (i) => !q || i.nameEn.toLowerCase().includes(q) || i.nameAr.includes(q) || i.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [custom, query, category]);
  /** Removes an uploaded piece from the library and from the plan. */
  const dropUpload = async (id: string) => {
    if (!(await removeCustomItem(id))) return setMessage(t.uploadServerFailed);
    commit((l) => ({ ...l, placed: l.placed.filter((p) => p.itemId !== id) }));
    setSelected(null);
  };

  const pickedWall = pick?.kind === "wall" ? walls[pick.index] ?? null : null;
  const pickedOpening = pick?.kind === "opening" ? openings.find((o) => o.id === pick.id) ?? null : null;
  const pickedColumn = pick?.kind === "column" ? columns.find((c) => c.id === pick.id) ?? null : null;
  const selecting = tool === "select";
  const ghostSpot = isOpeningTool(tool) && cursor ? onWall(cursor, walls, OPENING_WIDTH[tool], 40) : null;
  const hint = selecting ? t.hintSelect : tool === "wall" || tool === "glass" ? t.hintWall : tool === "room" ? t.hintRoom : isOpeningTool(tool) ? t.hintOpening : t.hintColumn;
  const handle = 7 / zoom;

  return (
    <div className="plan">
      {/* ---------- Top bar ---------- */}
      <div className="plan-topbar">
        <div className="top-group" role="toolbar" aria-label={t.save}>
          <button type="button" className="top-btn" onClick={save}>
            <TopIcon name="save" />
            {savedFlash ? t.saved : t.save}
          </button>
          <span className="top-sep" />
          <button type="button" className="top-btn" onClick={undo} disabled={!past.length}>
            <TopIcon name="undo" />
            {t.undo}
          </button>
          <button type="button" className="top-btn" onClick={redo} disabled={!future.length}>
            <TopIcon name="redo" />
            {t.redo}
          </button>
          <button type="button" className="top-btn" onClick={clearAll}>
            <TopIcon name="clear" />
            {t.clearAll}
          </button>
          <span className="top-sep" />
          <button type="button" className="top-btn" onClick={() => fileRef.current?.click()}>
            <TopIcon name="open" />
            {t.open}
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => (importJson(e.target.files?.[0]), (e.target.value = ""))} />
          <div className="top-menu">
            <button type="button" className="top-btn" aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)}>
              <TopIcon name="export" />
              {t.exportMenu} ▾
            </button>
            {exportOpen && (
              <div className="top-dropdown" role="menu">
                <button type="button" role="menuitem" onClick={() => (exportPng(), setExportOpen(false))}>
                  {t.exportPng}
                </button>
                <button type="button" role="menuitem" onClick={() => (exportJson(), setExportOpen(false))}>
                  {t.exportJson}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="top-group" role="tablist" aria-label={t.floorPlan}>
          {(["draw", "furniture", "catalog"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={panel === m}
              className={`top-btn${panel === m ? " top-on" : ""}`}
              onClick={() => {
                setPanel(m);
                if (m !== "draw") changeTool("select");
              }}
            >
              <TopIcon name={m} />
              {m === "draw" ? t.drawPlan : m === "furniture" ? t.furniturePlan : t.catalog}
            </button>
          ))}
        </div>
      </div>

      {panel === "catalog" ? (
        <div className="plan-catalog">
          <Catalog lang={lang} t={t} shadow={shadow} setShadow={setShadow} />
        </div>
      ) : (
        <>
          {/* ---------- Left: drawing tools or the furniture library ---------- */}
          <aside className="plan-side library">
            {panel === "draw" ? (
              <>
                <div className="library-head">
                  <h3>{t.drawPlan}</h3>
                </div>
                <DrawPanel t={t} tool={tool} setTool={changeTool} />
              </>
            ) : (
              <>
                <div className="library-head">
                  <h3>{t.furniturePlan}</h3>
                </div>
                {access.uploads && access.canEdit && (
                  <button type="button" className="btn btn-primary btn-small upload-open" onClick={() => setUploading(true)}>
                    + {t.upload}
                  </button>
                )}
                <input className="input lib-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} />
                <div className="chips chips-small" role="group">
                  {(["all", ...CATEGORIES] as const).map((c) => (
                    <button key={c} type="button" className={`chip${category === c ? " chip-on" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
                      {c === "all" ? t.all : t.categories[c]}
                    </button>
                  ))}
                </div>
                <p className="muted small">{t.dragHint}</p>
                <ul className="library-grid">
                  {library.map((item) => (
                    <li
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => add(item, W / 2, L / 2)}
                      className="library-item"
                      title={name(item)}
                    >
                      <TopViewIcon item={item} size={64} shadow={false} />
                      <span className="library-name">{name(item)}</span>
                      <span className="muted tiny" dir="ltr">
                        {item.widthCm}×{item.depthCm}
                      </span>
                      {item.id.startsWith("USR-") && (
                        <>
                          <span className="upload-badge">{t.uploaded}</span>
                          <button type="button" className="upload-remove" title={t.removeUpload} aria-label={t.removeUpload} onClick={(e) => (e.stopPropagation(), dropUpload(item.id))}>
                            ×
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>

          {/* ---------- The plan ---------- */}
          <div className="plan-main">
            <div className="toolbar wrap">
              <button type="button" className="btn btn-ghost" onClick={() => loadPreset(sampleOffice())}>
                {t.sample}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => loadPreset(emptyRoom(600, 400))}>
                {t.empty}
              </button>
              <label className="field-inline">
                {t.width}
                <input className="input num" type="number" min={100} max={5000} step={10} value={W} onChange={(e) => setSize(Number(e.target.value), L)} />
              </label>
              <label className="field-inline">
                {t.length}
                <input className="input num" type="number" min={100} max={5000} step={10} value={L} onChange={(e) => setSize(W, Number(e.target.value))} />
              </label>
              <span className="field-inline">
                <button type="button" className="btn btn-ghost sq" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))} aria-label="−">
                  −
                </button>
                <span dir="ltr" className="zoom">
                  {Math.round(zoom * 100)}%
                </span>
                <button type="button" className="btn btn-ghost sq" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} aria-label="+">
                  +
                </button>
              </span>
              <label className="toggle">
                <input type="checkbox" checked={showClearance} onChange={(e) => setShowClearance(e.target.checked)} />
                {t.clearance}
              </label>
              <label className="toggle">
                <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
                {t.shadows}
              </label>
            </div>
            <p className="tool-hint">{hint}</p>
            {loaded && !access.canEdit && <p className="view-only">{t.viewOnly}</p>}

            <div
              className={`canvas-wrap${hoverDrop ? " canvas-drop" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (!hoverDrop) setHoverDrop(true);
              }}
              onDragLeave={() => setHoverDrop(false)}
              onDrop={onDrop}
            >
              <svg
                ref={svgRef}
                className={`canvas${selecting ? "" : " drawing"}`}
                width={(W + MARGIN * 2) * zoom}
                height={(L + MARGIN * 2) * zoom}
                viewBox={`${-MARGIN} ${-MARGIN} ${W + MARGIN * 2} ${L + MARGIN * 2}`}
                onPointerDown={onCanvasDown}
                onPointerMove={onCanvasMove}
                onPointerUp={onCanvasUp}
                onPointerLeave={() => !gesture.current && setCursor(null)}
                onDoubleClick={endChain}
                onContextMenu={(e) => (e.preventDefault(), draft && endChain())}
              >
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <rect width="50" height="50" fill="#fbfbfa" />
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e6e4e0" strokeWidth="0.8" />
                  </pattern>
                  <pattern id="floor-tile" width="60" height="60" patternUnits="userSpaceOnUse">
                    <rect width="60" height="60" fill="#efeeec" />
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#dcdad6" strokeWidth="0.8" />
                  </pattern>
                  <pattern id="floor-wet" width="30" height="30" patternUnits="userSpaceOnUse">
                    <rect width="30" height="30" fill="#f5f5f3" />
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#dedcd8" strokeWidth="0.7" />
                  </pattern>
                  <pattern id="floor-wood" width="120" height="18" patternUnits="userSpaceOnUse">
                    <rect width="120" height="18" fill="#e2cfb2" />
                    <path d="M 0 18 H 120 M 70 0 V 18" stroke="#cdb795" strokeWidth="0.8" />
                  </pattern>
                  <pattern id="floor-deck" width="200" height="14" patternUnits="userSpaceOnUse">
                    <rect width="200" height="14" fill="#e9e6e0" />
                    <path d="M 0 14 H 200" stroke="#d6d2ca" strokeWidth="1" />
                  </pattern>
                  <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="5" />
                  </filter>
                </defs>

                {/* Drawing area grid, then floor finishes */}
                <rect x={0} y={0} width={W} height={L} fill="url(#grid)" stroke="#d9d6d0" strokeDasharray="6 6" strokeWidth={1} />
                {floors.map((f, i) => (
                  <rect
                    key={i}
                    x={f.x}
                    y={f.y}
                    width={f.w}
                    height={f.h}
                    fill={FLOOR_FILL[f.kind]}
                    pointerEvents={selecting ? undefined : "none"}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setSelected(null);
                      setMenu(null);
                      setPick({ kind: "floor", index: i });
                    }}
                  />
                ))}

                {/* Shadows: their own layer under every item */}
                {shadow &&
                  placedItems
                    .filter(({ item }) => item.subcategory !== "rug")
                    .map(({ p, item }) => {
                      const f = footprint(p, item);
                      return <rect key={`s-${p.uid}`} x={f.x + 1.5} y={f.y + 4} width={f.w} height={f.h} rx={Math.min(f.w, f.h) * 0.18} fill="#000" opacity={0.16} filter="url(#soft-shadow)" pointerEvents="none" />;
                    })}

                {/* Rugs first, then furniture, then things on surfaces */}
                {[...placedItems]
                  .sort((a, b) => Number(b.item.subcategory === "rug") - Number(a.item.subcategory === "rug") || Number(a.item.category === "tech") - Number(b.item.category === "tech"))
                  .map(({ p, item }) => {
                    const f = footprint(p, item);
                    const bad = conflicts.has(p.uid);
                    const { w, d } = sized(p, item);
                    return (
                      <g
                        key={p.uid}
                        className="placed"
                        pointerEvents={selecting ? undefined : "none"}
                        onPointerDown={(e) => onItemDown(e, p)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelected(p.uid);
                          setPick(null);
                          setMenu({ uid: p.uid, x: e.clientX, y: e.clientY });
                        }}
                      >
                        <g transform={`translate(${f.x + f.w / 2} ${f.y + f.h / 2}) rotate(${p.rotation})${p.mirror ? " scale(-1 1)" : ""}`}>
                          <image href={itemPicture(item)} x={-w / 2} y={-d / 2} width={w} height={d} preserveAspectRatio="none" />
                        </g>
                        {showClearance && item.clearanceCm > 0 && (
                          <rect
                            x={f.x - item.clearanceCm}
                            y={f.y - item.clearanceCm}
                            width={f.w + item.clearanceCm * 2}
                            height={f.h + item.clearanceCm * 2}
                            fill={bad ? "rgba(220,38,38,0.05)" : "none"}
                            stroke={bad ? "#dc2626" : "#9aa3ad"}
                            strokeWidth={1}
                            strokeDasharray="6 5"
                            pointerEvents="none"
                          />
                        )}
                        {bad && <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="rgba(220,38,38,0.16)" stroke="#dc2626" strokeWidth={1.5} pointerEvents="none" />}
                        {p.uid === selected && <rect x={f.x - 3} y={f.y - 3} width={f.w + 6} height={f.h + 6} fill="none" stroke="#2563eb" strokeWidth={2} pointerEvents="none" />}
                      </g>
                    );
                  })}

                {/* Walls on top of the furniture; in Select they can be clicked and dragged */}
                {walls.map((w, i) => (
                  <g key={`w${i}`}>
                    <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={w.glass ? "#9fb7c8" : "#1b1b1b"} strokeWidth={w.thickness} strokeLinecap="square" pointerEvents="none" />
                    {selecting && (
                      <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="transparent" strokeWidth={Math.max(w.thickness, 8 / zoom)} className="wall-hit" onPointerDown={(e) => onWallDown(e, i)} />
                    )}
                  </g>
                ))}
                {(layout.doors ?? []).map((d, i) => (
                  <g key={`d${i}`} transform={`translate(${d.x} ${d.y}) rotate(${d.rotation})`} pointerEvents="none">
                    <line x1={0} y1={0} x2={0} y2={d.width} stroke="#4b4b4b" strokeWidth={1.6} />
                    <path d={`M ${d.width} 0 A ${d.width} ${d.width} 0 0 1 0 ${d.width}`} fill="none" stroke="#8a8a8a" strokeWidth={1} strokeDasharray="4 3" />
                  </g>
                ))}

                {/* Doors and windows cut into their walls */}
                {openings.map((o) => (
                  <g key={o.id} transform={openingTransform(o)} className="opening" pointerEvents={selecting ? undefined : "none"} onPointerDown={(e) => onOpeningDown(e, o)}>
                    <OpeningSymbol o={o} />
                    {pick?.kind === "opening" && pick.id === o.id && (
                      <rect x={-o.width / 2 - 3} y={-o.thickness / 2 - 3} width={o.width + 6} height={o.thickness + 6} fill="none" stroke="#2563eb" strokeWidth={2} />
                    )}
                  </g>
                ))}
                {columns.map((c) => {
                  const on = pick?.kind === "column" && pick.id === c.id;
                  const common = { fill: "#2a2a2a", stroke: on ? "#2563eb" : "none", strokeWidth: 3, className: "column", pointerEvents: selecting ? undefined : "none", onPointerDown: (e: React.PointerEvent) => onColumnDown(e, c) } as const;
                  return c.round ? <circle key={c.id} cx={c.x} cy={c.y} r={c.size / 2} {...common} /> : <rect key={c.id} x={c.x - c.size / 2} y={c.y - c.size / 2} width={c.size} height={c.size} {...common} />;
                })}

                {pick?.kind === "floor" && floors[pick.index] && (
                  <rect
                    x={floors[pick.index].x}
                    y={floors[pick.index].y}
                    width={floors[pick.index].w}
                    height={floors[pick.index].h}
                    fill="rgba(37,99,235,0.08)"
                    stroke="#2563eb"
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${8 / zoom} ${5 / zoom}`}
                    pointerEvents="none"
                  />
                )}

                {/* The selected wall: its length and handles on both ends */}
                {pickedWall && pick?.kind === "wall" && (
                  <g>
                    <line x1={pickedWall.x1} y1={pickedWall.y1} x2={pickedWall.x2} y2={pickedWall.y2} stroke="#2563eb" strokeOpacity={0.35} strokeWidth={pickedWall.thickness + 6} pointerEvents="none" />
                    <LengthLabel a={{ x: pickedWall.x1, y: pickedWall.y1 }} b={{ x: pickedWall.x2, y: pickedWall.y2 }} zoom={zoom} side={-1} />
                    {([1, 2] as const).map((end) => (
                      <circle
                        key={end}
                        cx={end === 1 ? pickedWall.x1 : pickedWall.x2}
                        cy={end === 1 ? pickedWall.y1 : pickedWall.y2}
                        r={handle}
                        fill="#fff"
                        stroke="#2563eb"
                        strokeWidth={2 / zoom}
                        className="wall-handle"
                        onPointerDown={(e) => onEndDown(e, pick.index, end)}
                      />
                    ))}
                  </g>
                )}

                {/* Previews while drawing */}
                {(tool === "wall" || tool === "glass") && cursor && (
                  <g pointerEvents="none">
                    {draft && (
                      <>
                        <line x1={draft.x} y1={draft.y} x2={cursor.x} y2={cursor.y} stroke={tool === "glass" ? "#9fb7c8" : "#1b1b1b"} strokeOpacity={0.55} strokeWidth={tool === "glass" ? 6 : WALL_THICKNESS} strokeLinecap="square" />
                        <LengthLabel a={draft} b={cursor} zoom={zoom} side={-1} />
                      </>
                    )}
                    <circle cx={cursor.x} cy={cursor.y} r={handle * 0.7} fill="#2563eb" />
                  </g>
                )}
                {tool === "room" && roomStart && cursor && (
                  <g pointerEvents="none">
                    <rect
                      x={Math.min(roomStart.x, cursor.x)}
                      y={Math.min(roomStart.y, cursor.y)}
                      width={Math.abs(cursor.x - roomStart.x)}
                      height={Math.abs(cursor.y - roomStart.y)}
                      fill="rgba(226,207,178,0.5)"
                      stroke="#1b1b1b"
                      strokeOpacity={0.6}
                      strokeWidth={WALL_THICKNESS}
                    />
                    <LengthLabel a={{ x: Math.min(roomStart.x, cursor.x), y: Math.min(roomStart.y, cursor.y) }} b={{ x: Math.max(roomStart.x, cursor.x), y: Math.min(roomStart.y, cursor.y) }} zoom={zoom} side={-1} />
                    <LengthLabel a={{ x: Math.min(roomStart.x, cursor.x), y: Math.max(roomStart.y, cursor.y) }} b={{ x: Math.min(roomStart.x, cursor.x), y: Math.min(roomStart.y, cursor.y) }} zoom={zoom} side={-1} />
                  </g>
                )}
                {isOpeningTool(tool) && ghostSpot && (
                  <g transform={openingTransform({ id: "ghost", kind: tool, width: OPENING_WIDTH[tool], ...ghostSpot })} opacity={0.6} pointerEvents="none">
                    <OpeningSymbol o={{ id: "ghost", kind: tool, width: OPENING_WIDTH[tool], ...ghostSpot }} />
                  </g>
                )}
                {(tool === "column" || tool === "roundColumn") && cursor && (
                  <g opacity={0.5} pointerEvents="none">
                    {tool === "roundColumn" ? (
                      <circle cx={snapGrid(cursor).x} cy={snapGrid(cursor).y} r={COLUMN_SIZE / 2} fill="#2a2a2a" />
                    ) : (
                      <rect x={snapGrid(cursor).x - COLUMN_SIZE / 2} y={snapGrid(cursor).y - COLUMN_SIZE / 2} width={COLUMN_SIZE} height={COLUMN_SIZE} fill="#2a2a2a" />
                    )}
                  </g>
                )}

                <text x={W / 2} y={-18} textAnchor="middle" className="dim">
                  {(W / 100).toFixed(2)} m
                </text>
                <text x={-20} y={L / 2} textAnchor="middle" className="dim" transform={`rotate(-90 ${-20} ${L / 2})`}>
                  {(L / 100).toFixed(2)} m
                </text>
              </svg>
            </div>

            {/* ---------- Under the plan: portrait or landscape, and quarter turns ---------- */}
            <div className="plan-orient">
              <span className="muted small">{t.orientation}</span>
              <div className="segmented orient-seg" role="group" aria-label={t.orientation}>
                <button type="button" className={portrait ? "seg-on" : ""} aria-pressed={portrait} onClick={() => !portrait && turnPlan(true)}>
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                    <rect x="5" y="2" width="10" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  {t.portrait}
                </button>
                <button type="button" className={!portrait ? "seg-on" : ""} aria-pressed={!portrait} onClick={() => portrait && turnPlan(true)}>
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                    <rect x="2" y="5" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  {t.landscape}
                </button>
              </div>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => turnPlan(false)} title={t.turnLeft}>
                ⟲ {t.turnLeft}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => turnPlan(true)} title={t.turnRight}>
                ⟳ {t.turnRight}
              </button>
              <span className="muted small" dir="ltr">
                {(W / 100).toFixed(2)} × {(L / 100).toFixed(2)} m
              </span>
            </div>

            {/* ---------- Right-click menu on a piece ---------- */}
            {menu && menuOf && (
              <>
                <div className="ctx-backdrop" onPointerDown={() => setMenu(null)} onContextMenu={(e) => (e.preventDefault(), setMenu(null))} />
                <div
                  className="ctx-menu"
                  role="menu"
                  style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 230) }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="ctx-title">{name(menuOf.item)}</div>
                  <div className="ctx-row">
                    <span>{t.scale}</span>
                    <span className="ctx-scale" dir="ltr">
                      <button type="button" className="btn btn-ghost sq" aria-label="−" onClick={() => setScale(menu.uid, (menuOf.p.scale ?? 1) - 0.1)} disabled={(menuOf.p.scale ?? 1) <= SCALE_MIN}>
                        −
                      </button>
                      <span className="zoom">{Math.round((menuOf.p.scale ?? 1) * 100)}%</span>
                      <button type="button" className="btn btn-ghost sq" aria-label="+" onClick={() => setScale(menu.uid, (menuOf.p.scale ?? 1) + 0.1)} disabled={(menuOf.p.scale ?? 1) >= SCALE_MAX}>
                        +
                      </button>
                    </span>
                  </div>
                  <input
                    className="ctx-slider"
                    dir="ltr"
                    type="range"
                    min={SCALE_MIN * 100}
                    max={SCALE_MAX * 100}
                    step={5}
                    value={Math.round((menuOf.p.scale ?? 1) * 100)}
                    onChange={(e) => setScale(menu.uid, Number(e.target.value) / 100)}
                    aria-label={t.scale}
                  />
                  {(menuOf.p.scale ?? 1) !== 1 && (
                    <button type="button" role="menuitem" className="ctx-item muted" onClick={() => setScale(menu.uid, 1)}>
                      {t.resetSize}
                    </button>
                  )}
                  <button type="button" role="menuitem" className="ctx-item" onClick={() => mirror(menu.uid)}>
                    {t.mirror} <kbd>M</kbd>
                  </button>
                  <button type="button" role="menuitem" className="ctx-item" onClick={() => (duplicate(menu.uid), setMenu(null))}>
                    {t.copy}
                  </button>
                  <button type="button" role="menuitem" className="ctx-item" onClick={() => rotate(menu.uid)}>
                    {t.rotateMenu} <kbd>R</kbd>
                  </button>
                  <button type="button" role="menuitem" className="ctx-item danger" onClick={() => (remove(menu.uid), setMenu(null))}>
                    {t.remove}
                  </button>
                </div>
              </>
            )}

            <div className="statusbar">
              <span>
                {t.count}: <b>{layout.placed.length}</b>
              </span>
              <span>
                {t.area}:{" "}
                <b dir="ltr">
                  {usedM2.toFixed(2)} / {((W * L) / 10000).toFixed(2)} m²
                </b>
              </span>
              <span className={conflicts.size ? "danger" : ""}>
                {t.overlaps}: <b>{conflicts.size}</b>
              </span>
            </div>
            {message && <p className="danger small">{message}</p>}
          </div>

          {uploading && <UploadDialog t={t} onClose={() => setUploading(false)} onAdded={() => (setCategory("all"), setQuery(""))} />}

          {/* ---------- Right: properties of what is selected ---------- */}
          <aside className="plan-inspector">
            {pickedWall && pick?.kind === "wall" ? (
              <>
                <h3>{t.wallProps}</h3>
                <div className="props">
                  <label>
                    {t.lengthCm}
                    <input className="input" type="number" min={10} max={5000} value={Math.round(wallLength(pickedWall))} onChange={(e) => setWallLength(pick.index, Number(e.target.value))} />
                  </label>
                  <label>
                    {t.thicknessCm}
                    <input
                      className="input"
                      type="number"
                      min={2}
                      max={60}
                      value={pickedWall.thickness}
                      onChange={(e) => {
                        const th = clamp(Number(e.target.value) || 2, 2, 60);
                        editWall(pick.index, (w) => ({ ...w, thickness: th }));
                      }}
                    />
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={!!pickedWall.glass} onChange={(e) => editWall(pick.index, (w) => ({ ...w, glass: e.target.checked || undefined }))} />
                    {t.glass}
                  </label>
                  <button type="button" className="btn btn-danger" onClick={deletePick}>
                    {t.remove}
                  </button>
                </div>
              </>
            ) : pickedOpening ? (
              <>
                <h3>{DOOR_KINDS.includes(pickedOpening.kind) ? t.door : t.window}</h3>
                <div className="props">
                  <div className="segmented" role="group">
                    {(DOOR_KINDS.includes(pickedOpening.kind) ? DOOR_KINDS : WINDOW_KINDS).map((k) => (
                      <button key={k} type="button" className={pickedOpening.kind === k ? "seg-on" : ""} aria-pressed={pickedOpening.kind === k} onClick={() => editOpening(pickedOpening.id, (o) => ({ ...o, kind: k }))}>
                        {{ single: t.singleDoor, double: t.doubleDoor, sliding: t.slidingDoor, window: t.windows, bay: t.bayWindow, french: t.frenchWindow }[k]}
                      </button>
                    ))}
                  </div>
                  <label>
                    {t.width}
                    <input
                      className="input"
                      type="number"
                      min={40}
                      max={400}
                      value={pickedOpening.width}
                      onChange={(e) => editOpening(pickedOpening.id, (o) => ({ ...o, width: clamp(Number(e.target.value) || 40, 40, 400) }))}
                    />
                  </label>
                  <input
                    type="range"
                    dir="ltr"
                    min={40}
                    max={400}
                    step={5}
                    value={pickedOpening.width}
                    onChange={(e) => editOpening(pickedOpening.id, (o) => ({ ...o, width: Number(e.target.value) }))}
                    aria-label={t.width}
                  />
                  <div className="row-2">
                    <button type="button" className="btn btn-ghost" onClick={() => editOpening(pickedOpening.id, (o) => ({ ...o, flip: !o.flip }))}>
                      ⇅ {t.flipSide}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => editOpening(pickedOpening.id, (o) => ({ ...o, hinge: !o.hinge }))}>
                      ⇆ {t.flipHinge}
                    </button>
                  </div>
                  <button type="button" className="btn btn-danger" onClick={deletePick}>
                    {t.remove}
                  </button>
                </div>
              </>
            ) : pick?.kind === "floor" && floors[pick.index] ? (
              <>
                <h3>{t.floorProps}</h3>
                <div className="props">
                  <p className="muted small" dir="ltr">
                    {(floors[pick.index].w / 100).toFixed(2)} × {(floors[pick.index].h / 100).toFixed(2)} m
                  </p>
                  <div className="segmented" role="group">
                    {FLOOR_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={floors[pick.index].kind === k ? "seg-on" : ""}
                        aria-pressed={floors[pick.index].kind === k}
                        onClick={() => commit((l) => ({ ...l, floors: floorsOf(l).map((f, i) => (i === pick.index ? { ...f, kind: k } : f)) }))}
                      >
                        {t.floorKinds[k]}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn btn-danger" onClick={deletePick}>
                    {t.remove}
                  </button>
                </div>
              </>
            ) : pickedColumn ? (
              <>
                <h3>{t.columnProps}</h3>
                <div className="props">
                  <label>
                    {t.sizeCm}
                    <input
                      className="input"
                      type="number"
                      min={10}
                      max={150}
                      value={pickedColumn.size}
                      onChange={(e) => editColumn(pickedColumn.id, (c) => ({ ...c, size: clamp(Number(e.target.value) || 10, 10, 150) }))}
                    />
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={!!pickedColumn.round} onChange={(e) => editColumn(pickedColumn.id, (c) => ({ ...c, round: e.target.checked || undefined }))} />
                    {t.round}
                  </label>
                  <button type="button" className="btn btn-danger" onClick={deletePick}>
                    {t.remove}
                  </button>
                </div>
              </>
            ) : sel ? (
              <>
                <h3>{t.selected}</h3>
                <TopViewIcon item={sel.item} size={110} shadow={shadow} />
                <p className="inspector-name">{name(sel.item)}</p>
                <p className="muted small" dir="ltr">
                  {sized(sel.p, sel.item).w} × {sized(sel.p, sel.item).d} cm · {sel.p.rotation}°{(sel.p.scale ?? 1) !== 1 && ` · ${Math.round((sel.p.scale ?? 1) * 100)}%`}
                  {sel.p.mirror && " · ⇋"}
                </p>
                <div className="stack">
                  <button type="button" className="btn btn-primary" onClick={() => rotate(sel.p.uid)}>
                    {t.rotate}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => duplicate(sel.p.uid)}>
                    {t.duplicate}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => remove(sel.p.uid)}>
                    {t.remove}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{t.properties}</h3>
                <p className="muted small">{t.nothingSelected}</p>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
