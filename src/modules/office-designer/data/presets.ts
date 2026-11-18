import type { Door, FloorZone, Layout, Placed, Wall } from "./types";

/**
 * A sample office modelled on a typical small-office floor plan (about 6.27 m × 9.97 m plus a 1.20 m
 * balcony): two washrooms, reception, a meeting room for 8, a kitchenette, an open workspace with two
 * 4-person bench desks, a manager's office with its own washroom, and a balcony. All values in cm.
 */
const W = 627;
const L = 997;
const BAL = 120;

const ext = 15; // exterior wall thickness
const int = 10; // partition thickness

const walls: Wall[] = [
  // Exterior: entrance gap on the top wall (x 250–340)
  { x1: 0, y1: 0, x2: 250, y2: 0, thickness: ext },
  { x1: 340, y1: 0, x2: W, y2: 0, thickness: ext },
  { x1: 0, y1: 0, x2: 0, y2: L, thickness: ext },
  { x1: W, y1: 0, x2: W, y2: L, thickness: ext },
  // Glazed front onto the balcony
  { x1: 0, y1: L, x2: W, y2: L, thickness: 6, glass: true },
  // Washroom 1 (top-left) and washroom 2 below it
  { x1: 120, y1: 0, x2: 120, y2: 70, thickness: int },
  { x1: 0, y1: 150, x2: 120, y2: 150, thickness: int },
  { x1: 105, y1: 150, x2: 105, y2: 240, thickness: int },
  { x1: 0, y1: 320, x2: 105, y2: 320, thickness: int },
  // Reception: bottom wall, open toward the workspace on the right
  { x1: 105, y1: 320, x2: 250, y2: 320, thickness: int },
  // Meeting room: left and bottom walls (door gap 330, 230–300)
  { x1: 330, y1: 0, x2: 330, y2: 230, thickness: int },
  { x1: 330, y1: 300, x2: W, y2: 300, thickness: int },
  // Manager's office: top wall with a door gap (330–410), left wall
  { x1: 410, y1: 515, x2: W, y2: 515, thickness: int },
  { x1: 320, y1: 515, x2: 330, y2: 515, thickness: int },
  { x1: 320, y1: 515, x2: 320, y2: L, thickness: int },
  // Manager's washroom (bottom-right)
  { x1: 490, y1: 810, x2: W, y2: 810, thickness: int },
  { x1: 490, y1: 870, x2: 490, y2: L, thickness: int },
];

const doors: Door[] = [
  { x: 340, y: 0, width: 88, rotation: 90 }, // entrance, opening inwards
  { x: 120, y: 70, width: 75, rotation: 90 }, // washroom 1
  { x: 105, y: 240, width: 75, rotation: 90 }, // washroom 2
  { x: 330, y: 230, width: 70, rotation: 90 }, // meeting room
  { x: 330, y: 515, width: 78, rotation: 0 }, // manager's office
  { x: 490, y: 810, width: 60, rotation: 90 }, // manager's washroom
];

const floors: FloorZone[] = [
  { x: 0, y: 0, w: W, h: L, kind: "tile" },
  { x: 0, y: 0, w: 120, h: 150, kind: "wet" },
  { x: 0, y: 150, w: 105, h: 170, kind: "wet" },
  { x: 490, y: 810, w: W - 490, h: L - 810, kind: "wet" },
  { x: 0, y: L, w: W, h: BAL, kind: "deck" },
];

/** [itemId, x, y, rotation] — x / y are the top-left of the footprint on the floor. */
const pieces: [string, number, number, Placed["rotation"]][] = [
  // Washrooms
  ["BATH-WC-001", 8, 10, 270],
  ["BATH-VAN-001", 8, 85, 270],
  ["BATH-WC-001", 34, 160, 0],
  ["BATH-VAN-001", 8, 250, 270],
  // Reception: two armchairs at the back, the desk, its chair, a laptop and a plant
  ["SEAT-ARM-001", 140, 12, 0],
  ["SEAT-ARM-001", 230, 12, 0],
  ["DESK-REC-001", 140, 175, 0],
  ["SEAT-OFF-001", 179, 250, 180],
  ["TECH-LAP-001", 190, 190, 180],
  ["PLT-SML-001", 235, 182, 0],
  // Meeting room: table for 6 (3 each side), credenza along the bottom wall
  ["TBL-MEET-006", 430, 45, 90],
  ["SEAT-SHL-001", 376, 70, 270],
  ["SEAT-SHL-001", 376, 130, 270],
  ["SEAT-SHL-001", 376, 190, 270],
  ["SEAT-SHL-001", 532, 70, 90],
  ["SEAT-SHL-001", 532, 130, 90],
  ["SEAT-SHL-001", 532, 190, 90],
  ["TECH-LAP-001", 464, 120, 0],
  ["DEC-CRD-001", 370, 258, 0],
  // Kitchenette and the printer, against the meeting room wall
  ["KIT-CNT-001", 440, 306, 0],
  ["STO-CAB-001", 334, 306, 0],
  ["TECH-PRN-001", 360, 306, 0],
  // Open workspace: storage along the left wall, two bench desks with their chairs
  ["STO-SHF-001", 8, 345, 90],
  ["STO-DRW-001", 8, 480, 270],
  ["STO-SHF-001", 8, 640, 90],
  ["STO-DRW-001", 8, 780, 270],
  ["DESK-BEN-004", 70, 420, 0],
  ["SEAT-SHL-001", 85, 366, 0],
  ["SEAT-SHL-001", 165, 366, 0],
  ["SEAT-SHL-001", 85, 562, 180],
  ["SEAT-SHL-001", 165, 562, 180],
  ["DESK-BEN-004", 70, 690, 0],
  ["SEAT-SHL-001", 85, 636, 0],
  ["SEAT-SHL-001", 165, 636, 0],
  ["SEAT-SHL-001", 85, 832, 180],
  ["SEAT-SHL-001", 165, 832, 180],
  ["PLT-LRG-001", 230, 900, 0],
  // Manager's office: desk turned sideways, their chair behind it, two visitor chairs, a sideboard
  ["DESK-MGR-001", 430, 560, 90],
  ["SEAT-OFF-001", 520, 620, 90],
  ["SEAT-SHL-001", 370, 580, 270],
  ["SEAT-SHL-001", 370, 660, 270],
  ["TECH-LAP-001", 455, 600, 90],
  ["STO-DRW-001", 560, 735, 0],
  // Small table for two by the office wall
  ["DESK-REC-001", 335, 820, 90],
  ["SEAT-SHL-001", 412, 840, 90],
  ["SEAT-SHL-001", 412, 905, 90],
  // Manager's washroom
  ["BATH-VAN-001", 565, 820, 90],
  ["BATH-WC-001", 520, 922, 180],
  // Balcony
  ["SEAT-TUB-001", 330, 1015, 0],
  ["TBL-SIDE-001", 420, 1060, 0],
  ["PLT-SML-001", 80, 1040, 0],
  ["PLT-SML-001", 125, 1040, 0],
];

export function sampleOffice(): Layout {
  return {
    roomWidthCm: W,
    roomLengthCm: L + BAL,
    walls,
    doors,
    floors,
    // Deterministic ids: this runs during the first render, where random values are not allowed
    placed: pieces.map(([itemId, x, y, rotation], i) => ({ uid: `sample-${i}`, itemId, x, y, rotation })),
  };
}

/** A plain rectangular room with only its outer walls. */
export function emptyRoom(width = 600, length = 400): Layout {
  return {
    roomWidthCm: width,
    roomLengthCm: length,
    placed: [],
    walls: [
      { x1: 0, y1: 0, x2: width, y2: 0, thickness: ext },
      { x1: width, y1: 0, x2: width, y2: length, thickness: ext },
      { x1: width, y1: length, x2: 0, y2: length, thickness: ext },
      { x1: 0, y1: length, x2: 0, y2: 0, thickness: ext },
    ],
    doors: [],
    floors: [{ x: 0, y: 0, w: width, h: length, kind: "tile" }],
  };
}
