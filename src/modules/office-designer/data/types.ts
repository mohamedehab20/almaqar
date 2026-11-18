export type Category = "seating" | "desks" | "tables" | "storage" | "tech" | "plants" | "decor" | "bath" | "kitchen";

export type FurnitureItem = {
  id: string; // e.g. "SEAT-ARM-001"
  nameEn: string;
  nameAr: string;
  category: Category;
  subcategory: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  clearanceCm: number; // free space needed around the item
  material: string;
  colorHex: string;
  tags: string[];
  svg: string; // top-view SVG, viewBox "0 0 widthCm depthCm"
  imageUrl?: string; // if present, shown instead of svg
};

/** One item placed on the floor plan. x / y = top-left corner of its footprint in cm; rotation in degrees. */
export type Placed = {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  /** Size multiplier (1 = catalog size), 0.5–2 */
  scale?: number;
  /** Flipped left ↔ right */
  mirror?: boolean;
};

/** A wall segment (cm). `glass`: a glazed front (drawn thin and light). */
/** `room`: set on the walls and the floor drawn together by the Room tool, so they can be removed together. */
export type Wall = { x1: number; y1: number; x2: number; y2: number; thickness: number; glass?: boolean; room?: string };

/** A swing door: hinge at (x, y); closed along +x, opens 90° toward +y; `rotation` turns it around the hinge. */
export type Door = { x: number; y: number; width: number; rotation: 0 | 90 | 180 | 270 };

/** Floor finish of an area: office tiles, small wet-area tiles, wood, or an outdoor deck. */
export type FloorZone = { x: number; y: number; w: number; h: number; kind: "tile" | "wet" | "wood" | "deck"; room?: string };

export type Layout = {
  roomWidthCm: number;
  roomLengthCm: number;
  placed: Placed[];
  /** Optional architecture (a preset office); without it the room is a plain rectangle */
  walls?: Wall[];
  doors?: Door[];
  floors?: FloorZone[];
  /** Doors and windows drawn into walls with the drawing tools */
  openings?: Opening[];
  columns?: Column[];
};

export type OpeningKind = "single" | "double" | "sliding" | "window" | "bay" | "french";

/**
 * A door or window set into a wall. x / y = its centre on the wall line, angle = the wall direction (degrees),
 * thickness = the wall's. `flip` swings it to the other side of the wall, `hinge` swaps its hinge end.
 */
export type Opening = { id: string; x: number; y: number; angle: number; width: number; thickness: number; kind: OpeningKind; flip?: boolean; hinge?: boolean };

/** A structural column (cm): x / y = centre, square or round. */
export type Column = { id: string; x: number; y: number; size: number; round?: boolean };

export const CATEGORIES: Category[] = ["seating", "desks", "tables", "storage", "tech", "bath", "kitchen", "plants", "decor"];
