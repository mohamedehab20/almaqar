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
  // ---------- More pieces ----------
  item(
    { id: "SEAT-SEC-001", nameEn: "L-shaped sectional sofa", nameAr: "كنبة ركنة L", category: "seating", subcategory: "sofa", widthCm: 280, depthCm: 180, heightCm: 82, clearanceCm: 60, material: "Linen", colorHex: "#8e8a83", tags: ["sofa", "sectional", "corner", "lounge", "كنبة", "ركنة"] },
    (b) => draw.sectional(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-SOF-004", nameEn: "4-seat sofa", nameAr: "كنبة ٤ مقاعد", category: "seating", subcategory: "sofa", widthCm: 280, depthCm: 95, heightCm: 82, clearanceCm: 60, material: "Wool fabric", colorHex: "#5b6b7a", tags: ["sofa", "lounge", "reception", "كنبة"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 4),
  ),
  item(
    { id: "SEAT-ARM-002", nameEn: "Mustard armchair", nameAr: "فوتيه مستردة", category: "seating", subcategory: "armchair", widthCm: 78, depthCm: 76, heightCm: 80, clearanceCm: 45, material: "Velvet", colorHex: "#c9932f", tags: ["armchair", "velvet", "lounge", "فوتيه"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 1),
  ),
  item(
    { id: "SEAT-ARM-004", nameEn: "Navy club chair", nameAr: "فوتيه كحلي", category: "seating", subcategory: "armchair", widthCm: 85, depthCm: 85, heightCm: 78, clearanceCm: 45, material: "Leather", colorHex: "#2f3e5c", tags: ["armchair", "club", "leather", "فوتيه", "جلد"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 1),
  ),
  item(
    { id: "SEAT-OFF-002", nameEn: "Executive chair", nameAr: "كرسي مدير", category: "seating", subcategory: "office chair", widthCm: 70, depthCm: 70, heightCm: 120, clearanceCm: 60, material: "Leather, aluminium", colorHex: "#2b2b2e", tags: ["office", "executive", "manager", "كرسي", "مدير"] },
    (b) => draw.officeChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-OFF-003", nameEn: "Task chair (grey)", nameAr: "كرسي شغل رمادي", category: "seating", subcategory: "office chair", widthCm: 60, depthCm: 60, heightCm: 100, clearanceCm: 60, material: "Mesh", colorHex: "#8a9099", tags: ["office", "task", "mesh", "كرسي", "مكتب"] },
    (b) => draw.officeChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-SHL-002", nameEn: "Black shell chair", nameAr: "كرسي أسود", category: "seating", subcategory: "side chair", widthCm: 50, depthCm: 52, heightCm: 82, clearanceCm: 40, material: "Polypropylene", colorHex: "#3b3d42", tags: ["chair", "meeting", "dining", "كرسي"] },
    (b) => draw.shellChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-SHL-003", nameEn: "Oak shell chair", nameAr: "كرسي خشب", category: "seating", subcategory: "side chair", widthCm: 50, depthCm: 52, heightCm: 82, clearanceCm: 40, material: "Oak veneer", colorHex: "#c8a679", tags: ["chair", "meeting", "wood", "كرسي", "خشب"] },
    (b) => draw.shellChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-STL-001", nameEn: "Bar stool", nameAr: "كرسي بار", category: "seating", subcategory: "stool", widthCm: 42, depthCm: 42, heightCm: 75, clearanceCm: 30, material: "Leather, steel", colorHex: "#7a5236", tags: ["stool", "bar", "counter", "كرسي", "بار"] },
    (b) => draw.stool(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-BEAN-001", nameEn: "Bean bag", nameAr: "بين باج", category: "seating", subcategory: "bean bag", widthCm: 90, depthCm: 90, heightCm: 70, clearanceCm: 40, material: "Canvas", colorHex: "#d0703f", tags: ["bean bag", "lounge", "relax", "بين باج", "استرخاء"] },
    (b) => draw.beanBag(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "SEAT-BNC-001", nameEn: "Upholstered bench", nameAr: "بنش منجد", category: "seating", subcategory: "bench", widthCm: 140, depthCm: 45, heightCm: 45, clearanceCm: 40, material: "Fabric", colorHex: "#9c8b76", tags: ["bench", "waiting", "reception", "بنش", "انتظار"] },
    (b) => draw.upholstered(b.widthCm, b.depthCm, b.colorHex, 3, { arms: false, back: false }),
  ),
  item(
    { id: "SEAT-POU-002", nameEn: "Round pouf (grey)", nameAr: "بوف رمادي", category: "seating", subcategory: "pouf", widthCm: 45, depthCm: 45, heightCm: 42, clearanceCm: 30, material: "Felt", colorHex: "#9aa0a6", tags: ["pouf", "ottoman", "بوف"] },
    (b) => draw.tubChair(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DESK-BEN-006", nameEn: "6-person bench desk", nameAr: "مكتب جماعي ٦ أفراد", category: "desks", subcategory: "bench desk", widthCm: 240, depthCm: 140, heightCm: 75, clearanceCm: 70, material: "Laminate, steel", colorHex: "#efede8", tags: ["desk", "bench", "team", "open plan", "مكتب", "جماعي"] },
    (b) => draw.benchDesk(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DESK-STD-001", nameEn: "Standing desk", nameAr: "مكتب وقوف", category: "desks", subcategory: "standing desk", widthCm: 140, depthCm: 70, heightCm: 110, clearanceCm: 70, material: "Oak top, steel", colorHex: "#d9c3a0", tags: ["desk", "standing", "adjustable", "مكتب", "وقوف"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { grain: true }),
  ),
  item(
    { id: "DESK-SML-001", nameEn: "Compact desk", nameAr: "مكتب صغير", category: "desks", subcategory: "desk", widthCm: 100, depthCm: 55, heightCm: 75, clearanceCm: 60, material: "Birch", colorHex: "#e2cfae", tags: ["desk", "small", "home office", "مكتب", "صغير"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { grain: true }),
  ),
  item(
    { id: "DESK-L-002", nameEn: "Dark L-shaped desk", nameAr: "مكتب L غامق", category: "desks", subcategory: "desk", widthCm: 180, depthCm: 160, heightCm: 75, clearanceCm: 70, material: "Walnut", colorHex: "#6b4a35", tags: ["desk", "corner", "manager", "مكتب", "ركنة"] },
    (b) => draw.lDesk(b.widthCm, b.depthCm, b.colorHex, 60),
  ),
  item(
    { id: "TBL-MEET-008", nameEn: "Meeting table for 8", nameAr: "ترابيزة اجتماعات ٨ أفراد", category: "tables", subcategory: "meeting table", widthCm: 280, depthCm: 110, heightCm: 75, clearanceCm: 90, material: "Walnut", colorHex: "#7a5a43", tags: ["meeting", "conference", "table", "اجتماعات", "ترابيزة"] },
    (b) => draw.meetingTable(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "TBL-MEET-012", nameEn: "Boardroom table for 12", nameAr: "ترابيزة اجتماعات ١٢ فرد", category: "tables", subcategory: "meeting table", widthCm: 400, depthCm: 140, heightCm: 75, clearanceCm: 100, material: "Oak", colorHex: "#a98257", tags: ["meeting", "boardroom", "conference", "اجتماعات", "مجلس إدارة"] },
    (b) => draw.meetingTable(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "TBL-RND-004", nameEn: "Round table for 4", nameAr: "ترابيزة مدورة ٤ أفراد", category: "tables", subcategory: "round table", widthCm: 110, depthCm: 110, heightCm: 75, clearanceCm: 80, material: "White laminate", colorHex: "#efece6", tags: ["round", "meeting", "cafe", "ترابيزة", "مدورة"] },
    (b) => draw.roundTop(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "TBL-RND-002", nameEn: "Café table", nameAr: "ترابيزة كافيه", category: "tables", subcategory: "round table", widthCm: 70, depthCm: 70, heightCm: 75, clearanceCm: 60, material: "Marble", colorHex: "#d8d4cc", tags: ["cafe", "bistro", "round", "ترابيزة", "كافيه"] },
    (b) => draw.roundTop(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "TBL-DIN-001", nameEn: "Dining / pantry table", nameAr: "ترابيزة بوفيه", category: "tables", subcategory: "dining table", widthCm: 160, depthCm: 80, heightCm: 75, clearanceCm: 80, material: "Oak", colorHex: "#c7a37a", tags: ["dining", "pantry", "lunch", "ترابيزة", "أكل"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { grain: true, rx: 6 }),
  ),
  item(
    { id: "TBL-COF-002", nameEn: "Square coffee table", nameAr: "ترابيزة قهوة مربعة", category: "tables", subcategory: "coffee table", widthCm: 90, depthCm: 90, heightCm: 38, clearanceCm: 40, material: "Walnut", colorHex: "#6e4f3a", tags: ["coffee", "lounge", "square", "ترابيزة", "قهوة"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { grain: true, rx: 4 }),
  ),
  item(
    { id: "STO-FIL-001", nameEn: "Filing cabinet", nameAr: "دولاب ملفات", category: "storage", subcategory: "filing cabinet", widthCm: 50, depthCm: 60, heightCm: 130, clearanceCm: 70, material: "Steel", colorHex: "#9aa0a8", tags: ["filing", "cabinet", "documents", "ملفات", "أرشيف"] },
    (b) => draw.drawers(b.widthCm, b.depthCm, b.colorHex, 4),
  ),
  item(
    { id: "STO-LCK-001", nameEn: "Staff lockers", nameAr: "لوكرات موظفين", category: "storage", subcategory: "lockers", widthCm: 120, depthCm: 50, heightCm: 180, clearanceCm: 70, material: "Steel", colorHex: "#6f8fa8", tags: ["lockers", "staff", "storage", "لوكر", "دواليب"] },
    (b) => draw.drawers(b.widthCm, b.depthCm, b.colorHex, 3),
  ),
  item(
    { id: "STO-SHF-002", nameEn: "Tall bookcase (white)", nameAr: "مكتبة بيضا عالية", category: "storage", subcategory: "bookshelf", widthCm: 90, depthCm: 35, heightCm: 200, clearanceCm: 60, material: "Lacquer", colorHex: "#f1efea", tags: ["bookshelf", "books", "storage", "مكتبة", "كتب"] },
    (b) => draw.bookshelf(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "STO-WRD-001", nameEn: "Wardrobe", nameAr: "دولاب ملابس", category: "storage", subcategory: "wardrobe", widthCm: 120, depthCm: 60, heightCm: 210, clearanceCm: 70, material: "Oak veneer", colorHex: "#c9ad85", tags: ["wardrobe", "closet", "coats", "دولاب", "ملابس"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { frontEdge: true }),
  ),
  item(
    { id: "TECH-TV-001", nameEn: "Large display / TV", nameAr: "شاشة عرض كبيرة", category: "tech", subcategory: "display", widthCm: 165, depthCm: 30, heightCm: 100, clearanceCm: 80, material: "Glass, aluminium", colorHex: "#1d1f22", tags: ["tv", "screen", "display", "meeting", "شاشة", "تلفزيون"] },
    (b) => draw.tv(b.widthCm, b.depthCm),
  ),
  item(
    { id: "TECH-WB-001", nameEn: "Whiteboard on stand", nameAr: "سبورة بيضا", category: "tech", subcategory: "whiteboard", widthCm: 180, depthCm: 60, heightCm: 190, clearanceCm: 80, material: "Enamel, steel", colorHex: "#ffffff", tags: ["whiteboard", "board", "meeting", "سبورة"] },
    (b) => draw.whiteboard(b.widthCm, b.depthCm),
  ),
  item(
    { id: "TECH-WTR-001", nameEn: "Water cooler", nameAr: "كولدير مياه", category: "tech", subcategory: "water cooler", widthCm: 35, depthCm: 35, heightCm: 110, clearanceCm: 50, material: "Plastic", colorHex: "#e4e6e9", tags: ["water", "cooler", "pantry", "مياه", "كولدير"] },
    (b) => draw.waterCooler(b.widthCm, b.depthCm),
  ),
  item(
    { id: "BATH-SHW-001", nameEn: "Shower", nameAr: "دش", category: "bath", subcategory: "shower", widthCm: 90, depthCm: 90, heightCm: 200, clearanceCm: 60, material: "Ceramic, glass", colorHex: "#f1f4f6", tags: ["shower", "bathroom", "دش", "حمام"] },
    (b) => draw.shower(b.widthCm, b.depthCm),
  ),
  item(
    { id: "BATH-TUB-001", nameEn: "Bathtub", nameAr: "بانيو", category: "bath", subcategory: "bathtub", widthCm: 170, depthCm: 75, heightCm: 55, clearanceCm: 60, material: "Acrylic", colorHex: "#ffffff", tags: ["bathtub", "bath", "بانيو", "حمام"] },
    (b) => draw.bathtub(b.widthCm, b.depthCm),
  ),
  item(
    { id: "BATH-VAN-002", nameEn: "Double vanity", nameAr: "حوض مزدوج", category: "bath", subcategory: "washbasin", widthCm: 120, depthCm: 50, heightCm: 85, clearanceCm: 50, material: "Marble, ceramic", colorHex: "#e6dccd", tags: ["sink", "double", "bathroom", "حوض", "حمام"] },
    (b) => draw.vanity(b.widthCm, b.depthCm, b.colorHex, 2),
  ),
  item(
    { id: "KIT-FRG-001", nameEn: "Fridge", nameAr: "تلاجة", category: "kitchen", subcategory: "fridge", widthCm: 70, depthCm: 70, heightCm: 180, clearanceCm: 90, material: "Steel", colorHex: "#eef0f2", tags: ["fridge", "refrigerator", "pantry", "تلاجة", "مطبخ"] },
    (b) => draw.fridge(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "KIT-CNT-002", nameEn: "Kitchen island", nameAr: "جزيرة مطبخ", category: "kitchen", subcategory: "counter", widthCm: 200, depthCm: 90, heightCm: 90, clearanceCm: 90, material: "Quartz", colorHex: "#d9d6cf", tags: ["island", "kitchen", "counter", "جزيرة", "مطبخ"] },
    (b) => draw.slab(b.widthCm, b.depthCm, b.colorHex, { rx: 4 }),
  ),
  item(
    { id: "PLT-MED-001", nameEn: "Medium plant", nameAr: "نبتة متوسطة", category: "plants", subcategory: "plant", widthCm: 50, depthCm: 50, heightCm: 100, clearanceCm: 20, material: "Ceramic pot", colorHex: "#3f7d4f", tags: ["plant", "green", "نبتة", "زرع"] },
    (b) => draw.plant(b.widthCm, b.depthCm, "#d8d2c6", b.colorHex, 9),
  ),
  item(
    { id: "PLT-TRE-001", nameEn: "Indoor tree", nameAr: "شجرة داخلية", category: "plants", subcategory: "tree", widthCm: 90, depthCm: 90, heightCm: 200, clearanceCm: 30, material: "Concrete pot", colorHex: "#2f6b3c", tags: ["tree", "ficus", "plant", "شجرة", "زرع"] },
    (b) => draw.plant(b.widthCm, b.depthCm, "#8d8a84", b.colorHex, 14),
  ),
  item(
    { id: "PLT-BOX-001", nameEn: "Planter box", nameAr: "حوض زرع طولي", category: "plants", subcategory: "planter", widthCm: 120, depthCm: 35, heightCm: 60, clearanceCm: 20, material: "Wood", colorHex: "#3d7a4a", tags: ["planter", "divider", "plants", "زرع", "حوض"] },
    (b) => draw.planterBox(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DEC-RUG-002", nameEn: "Round rug", nameAr: "سجادة مدورة", category: "decor", subcategory: "rug", widthCm: 200, depthCm: 200, heightCm: 1, clearanceCm: 0, material: "Wool", colorHex: "#b6a58c", tags: ["rug", "round", "carpet", "سجادة", "مدورة"] },
    (b) => draw.roundRug(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DEC-RUG-003", nameEn: "Blue runner rug", nameAr: "سجادة طولية زرقا", category: "decor", subcategory: "rug", widthCm: 240, depthCm: 80, heightCm: 1, clearanceCm: 0, material: "Wool", colorHex: "#4f6d8f", tags: ["rug", "runner", "corridor", "سجادة", "ممر"] },
    (b) => draw.rug(b.widthCm, b.depthCm, b.colorHex),
  ),
  item(
    { id: "DEC-LMP-002", nameEn: "Arc floor lamp", nameAr: "أباجورة قوس", category: "decor", subcategory: "lighting", widthCm: 45, depthCm: 45, heightCm: 190, clearanceCm: 20, material: "Brass", colorHex: "#c9a45a", tags: ["lamp", "lighting", "أباجورة", "إضاءة"] },
    (b) => draw.floorLamp(b.widthCm, b.depthCm, b.colorHex),
  ),
];

/** Looks up a catalog piece or one the user uploaded. */
export const itemById = (id: string) => ITEMS.find((i) => i.id === id) ?? customItems().find((i) => i.id === id);
