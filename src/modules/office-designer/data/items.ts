import { customItems } from "./custom";
import * as draw from "./draw";
import type { FurnitureItem } from "./types";

/**
 * The catalog. Each item's `svg` is a top-view drawing at real size (viewBox = widthCm × depthCm, front down).
 * To use a photo instead, put a PNG in public/furniture/ and set `imageUrl: "/furniture/<file>.png"`.
 */
type Base = Omit<FurnitureItem, "svg">;
const item = (base: Base, svg: (b: Base) => string): FurnitureItem => ({ ...base, svg: svg(base) });

export const ITEMS: FurnitureItem[] = [
  // ---------- Seating ----------
  item(
    { id: "SEAT-OFF-001", nameEn: "Office chair", nameAr: "كرسي مكتب", category: "seating", subcategory: "task chair", widthCm: 62, depthCm: 62, heightCm: 105, clearanceCm: 40, material: "Mesh, nylon base", colorHex: "#3f4b5b", tags: ["chair", "desk", "ergonomic", "كرسي", "مكتب"] },
    (b) => draw.officeChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-ARM-001", nameEn: "Velvet armchair", nameAr: "فوتيه قطيفة", category: "seating", subcategory: "armchair", widthCm: 82, depthCm: 80, heightCm: 85, clearanceCm: 45, material: "Velvet, oak legs", colorHex: "#2f6b5e", tags: ["armchair", "lounge", "velvet", "فوتيه", "قطيفة"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 1),
  ),
  item(
    { id: "SEAT-SOF-002", nameEn: "2-seat sofa", nameAr: "كنبة مقعدين", category: "seating", subcategory: "sofa", widthCm: 160, depthCm: 88, heightCm: 82, clearanceCm: 50, material: "Linen blend", colorHex: "#8a7f72", tags: ["sofa", "couch", "lounge", "كنبة"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 2),
  ),
  item(
    { id: "SEAT-SOF-003", nameEn: "3-seat sofa", nameAr: "كنبة ٣ مقاعد", category: "seating", subcategory: "sofa", widthCm: 220, depthCm: 92, heightCm: 82, clearanceCm: 50, material: "Velvet", colorHex: "#38557a", tags: ["sofa", "couch", "reception", "كنبة", "استقبال"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 3),
  ),
  item(
    { id: "SEAT-POU-001", nameEn: "Pouf", nameAr: "بوف", category: "seating", subcategory: "ottoman", widthCm: 50, depthCm: 50, heightCm: 42, clearanceCm: 30, material: "Bouclé", colorHex: "#c9a77c", tags: ["pouf", "ottoman", "stool", "بوف"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 1, { arms: false, back: false }),
  ),

  // ---------- Desks ----------
  item(
    { id: "DESK-REC-001", nameEn: "Rectangular desk", nameAr: "مكتب مستطيل", category: "desks", subcategory: "work desk", widthCm: 140, depthCm: 70, heightCm: 75, clearanceCm: 60, material: "Oak veneer, steel", colorHex: "#b8915f", tags: ["desk", "workstation", "مكتب"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { grain: true }),
  ),
  item(
    { id: "DESK-L-001", nameEn: "L-shaped desk", nameAr: "مكتب على شكل L", category: "desks", subcategory: "corner desk", widthCm: 160, depthCm: 140, heightCm: 75, clearanceCm: 60, material: "White laminate", colorHex: "#d9d4cb", tags: ["desk", "corner", "manager", "مكتب", "ركنة"] },
    (b) => draw.lDesk(b.widthCm, b.depthCm, b.colorHex, 60),
  ),

  // ---------- Tables ----------
  item(
    { id: "TBL-MEET-006", nameEn: "Meeting table (6 people)", nameAr: "ترابيزة اجتماعات ٦ أفراد", category: "tables", subcategory: "meeting table", widthCm: 200, depthCm: 100, heightCm: 75, clearanceCm: 90, material: "Walnut", colorHex: "#7a5236", tags: ["meeting", "conference", "table", "اجتماعات", "ترابيزة"] },
    (b) => draw.meetingTable(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "TBL-COF-001", nameEn: "Round coffee table", nameAr: "ترابيزة قهوة مدورة", category: "tables", subcategory: "coffee table", widthCm: 80, depthCm: 80, heightCm: 40, clearanceCm: 40, material: "Travertine", colorHex: "#d8cbb6", tags: ["coffee", "round", "lounge", "قهوة", "ترابيزة"] },
    (b) => draw.roundTop(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "TBL-SIDE-001", nameEn: "Side table", nameAr: "ترابيزة جانبية", category: "tables", subcategory: "side table", widthCm: 45, depthCm: 45, heightCm: 55, clearanceCm: 20, material: "Black metal", colorHex: "#3b3b3b", tags: ["side", "end table", "جانبية", "ترابيزة"] },
    (b) => draw.roundTop(b.widthCm, b.depthCm, b.colorHex),
  ),

  // ---------- Storage ----------
  item(
    { id: "STO-DRW-001", nameEn: "Drawer unit", nameAr: "وحدة أدراج", category: "storage", subcategory: "pedestal", widthCm: 42, depthCm: 55, heightCm: 60, clearanceCm: 50, material: "Steel", colorHex: "#9aa3ad", tags: ["drawers", "pedestal", "أدراج"] },
    (b) => draw.drawers(b.widthCm, b.depthCm, b.colorHex, 1),
  ),
  item(
    { id: "STO-CAB-001", nameEn: "Cabinet", nameAr: "دولاب", category: "storage", subcategory: "cabinet", widthCm: 100, depthCm: 45, heightCm: 200, clearanceCm: 60, material: "Laminate", colorHex: "#e3ddd2", tags: ["cabinet", "storage", "files", "دولاب", "تخزين"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "STO-SHF-001", nameEn: "Bookshelf", nameAr: "مكتبة كتب", category: "storage", subcategory: "shelf", widthCm: 120, depthCm: 35, heightCm: 180, clearanceCm: 50, material: "Oak", colorHex: "#c29a66", tags: ["books", "shelf", "library", "مكتبة", "كتب"] },
    (b) => draw.bookshelf(b.widthCm, b.depthCm, b.colorHex),
  ),

  // ---------- Tech ----------
  item(
    { id: "TECH-LAP-001", nameEn: "Laptop", nameAr: "لابتوب", category: "tech", subcategory: "computer", widthCm: 32, depthCm: 22, heightCm: 2, clearanceCm: 0, material: "Aluminium", colorHex: "#b9bdc4", tags: ["laptop", "computer", "لابتوب"] },
    (b) => draw.laptop(b.widthCm, b.depthCm),
  ),
  item(
    { id: "TECH-MON-001", nameEn: "Monitor", nameAr: "شاشة", category: "tech", subcategory: "display", widthCm: 61, depthCm: 22, heightCm: 45, clearanceCm: 0, material: "Plastic", colorHex: "#1f2226", tags: ["monitor", "screen", "display", "شاشة"] },
    (b) => draw.monitor(b.widthCm, b.depthCm),
  ),
  item(
    { id: "TECH-PRN-001", nameEn: "Printer", nameAr: "طابعة", category: "tech", subcategory: "printer", widthCm: 50, depthCm: 45, heightCm: 40, clearanceCm: 40, material: "Plastic", colorHex: "#d9dce0", tags: ["printer", "copier", "طابعة"] },
    (b) => draw.printer(b.widthCm, b.depthCm),
  ),

  // ---------- Plants ----------
  item(
    { id: "PLT-SML-001", nameEn: "Small plant", nameAr: "نبتة صغيرة", category: "plants", subcategory: "desk plant", widthCm: 30, depthCm: 30, heightCm: 35, clearanceCm: 5, material: "Ceramic pot", colorHex: "#4f8a4b", tags: ["plant", "green", "نبات", "زرع"] },
    (b) => draw.plant(b.widthCm, b.depthCm, "#e9e4dc", b.colorHex, 7),
  ),
  item(
    { id: "PLT-LRG-001", nameEn: "Large plant", nameAr: "نبتة كبيرة", category: "plants", subcategory: "floor plant", widthCm: 70, depthCm: 70, heightCm: 160, clearanceCm: 10, material: "Terracotta pot", colorHex: "#3d7a45", tags: ["plant", "monstera", "green", "نبات", "زرع"] },
    (b) => draw.plant(b.widthCm, b.depthCm, "#b9774f", b.colorHex, 11),
  ),

  // ---------- Decor ----------
  item(
    { id: "DEC-RUG-001", nameEn: "Rug", nameAr: "سجادة", category: "decor", subcategory: "rug", widthCm: 200, depthCm: 140, heightCm: 1, clearanceCm: 0, material: "Wool", colorHex: "#b9a68a", tags: ["rug", "carpet", "سجادة"] },
    (b) => draw.rug(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DEC-LMP-001", nameEn: "Floor lamp", nameAr: "أباجورة أرضية", category: "decor", subcategory: "lighting", widthCm: 40, depthCm: 40, heightCm: 160, clearanceCm: 10, material: "Linen shade, brass", colorHex: "#e8dcc2", tags: ["lamp", "light", "أباجورة", "إضاءة"] },
    (b) => draw.floorLamp(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DEC-CRD-001", nameEn: "Wooden credenza", nameAr: "كونسول خشب", category: "storage", subcategory: "credenza", widthCm: 240, depthCm: 40, heightCm: 75, clearanceCm: 40, material: "Walnut veneer", colorHex: "#8a5a37", tags: ["credenza", "sideboard", "wood", "كونسول", "خشب"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { grain: true }),
  ),

  // ---------- Office plan pieces ----------
  item(
    { id: "SEAT-SHL-001", nameEn: "White shell chair", nameAr: "كرسي أبيض", category: "seating", subcategory: "visitor chair", widthCm: 50, depthCm: 52, heightCm: 82, clearanceCm: 30, material: "Polypropylene", colorHex: "#f2f2f0", tags: ["chair", "white", "visitor", "كرسي", "أبيض"] },
    (b) => draw.shellChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  // Photographed pieces (top view, background removed). The drawing is only a fallback if the image cannot load.
  item(
    { id: "SEAT-TUB-002", nameEn: "Beige tub chair", nameAr: "كرسي مدور بيج", category: "seating", subcategory: "lounge chair", widthCm: 68, depthCm: 68, heightCm: 78, clearanceCm: 40, material: "Wool fabric, oak legs", colorHex: "#a8977f", tags: ["tub", "lounge", "fabric", "photo", "كرسي", "بيج"], imageUrl: "/furniture/tub-chair-beige.webp" },
    (b) => draw.tubChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-LNG-002", nameEn: "Rust lounge chair", nameAr: "كرسي استرخاء طوبي", category: "seating", subcategory: "lounge chair", widthCm: 76, depthCm: 71, heightCm: 76, clearanceCm: 40, material: "Velvet", colorHex: "#a5532a", tags: ["lounge", "velvet", "armchair", "photo", "استرخاء", "قطيفة"], imageUrl: "/furniture/lounge-chair-rust.webp" },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 1),
  ),
  item(
    { id: "SEAT-ARM-003", nameEn: "Petal velvet armchair", nameAr: "فوتيه قطيفة بتلات", category: "seating", subcategory: "armchair", widthCm: 96, depthCm: 89, heightCm: 80, clearanceCm: 45, material: "Velvet", colorHex: "#c4473a", tags: ["armchair", "velvet", "lounge", "photo", "فوتيه", "قطيفة"], imageUrl: "/furniture/petal-armchair-red.webp" },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 1),
  ),
  item(
    { id: "SEAT-TUB-001", nameEn: "Lounge tub chair", nameAr: "كرسي استرخاء مدور", category: "seating", subcategory: "lounge chair", widthCm: 80, depthCm: 80, heightCm: 75, clearanceCm: 40, material: "Leather", colorHex: "#8b5a2b", tags: ["lounge", "tub", "balcony", "استرخاء", "بلكونة"] },
    (b) => draw.tubChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DESK-BEN-004", nameEn: "Bench desk (4 people)", nameAr: "مكتب جماعي ٤ أفراد", category: "desks", subcategory: "bench desk", widthCm: 160, depthCm: 140, heightCm: 75, clearanceCm: 70, material: "White laminate, steel", colorHex: "#efede8", tags: ["bench", "workstation", "open office", "مكتب", "جماعي"] },
    (b) => draw.benchDesk(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DESK-MGR-001", nameEn: "Manager desk", nameAr: "مكتب مدير", category: "desks", subcategory: "executive desk", widthCm: 180, depthCm: 80, heightCm: 75, clearanceCm: 80, material: "White lacquer", colorHex: "#e9e7e2", tags: ["manager", "executive", "desk", "مدير", "مكتب"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "BATH-WC-001", nameEn: "Toilet", nameAr: "تواليت", category: "bath", subcategory: "toilet", widthCm: 38, depthCm: 68, heightCm: 80, clearanceCm: 25, material: "Ceramic", colorHex: "#ffffff", tags: ["toilet", "wc", "bathroom", "حمام", "تواليت"] },
    (b) => draw.toilet(b.widthCm, b.depthCm),
  ),
  item(
    { id: "BATH-VAN-001", nameEn: "Washbasin vanity", nameAr: "حوض بوحدة رخام", category: "bath", subcategory: "washbasin", widthCm: 60, depthCm: 45, heightCm: 85, clearanceCm: 40, material: "Marble, ceramic", colorHex: "#e6dccd", tags: ["sink", "basin", "bathroom", "حوض", "حمام"] },
    (b) => draw.vanity(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "KIT-CNT-001", nameEn: "Kitchenette counter", nameAr: "رخامة مطبخ", category: "kitchen", subcategory: "counter", widthCm: 180, depthCm: 60, heightCm: 90, clearanceCm: 80, material: "Granite top", colorHex: "#45484e", tags: ["kitchen", "sink", "hob", "pantry", "مطبخ", "بوفيه"] },
    (b) => draw.kitchenCounter(b.widthCm, b.depthCm),
  ),
];

/** Looks up a catalog piece or one the user uploaded. */
export const itemById = (id: string) => ITEMS.find((i) => i.id === id) ?? customItems().find((i) => i.id === id);
