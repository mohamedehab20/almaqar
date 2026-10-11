/**
 * Demo data for the Sales page: sales orders (to clients) and purchase orders (from suppliers).
 * Amounts are in SAR like the rest of the demo. Clients come from the marketing client list.
 */

type Localized = { ar: string; en: string };

export type OrderType = "sale" | "purchase";
export type OrderStatus = "draft" | "pending" | "approved" | "fulfilled" | "cancelled";

export type OrderItem = { name: string; qty: number; unitPrice: number };

export type Order = {
  id: string;
  number: string;
  type: OrderType;
  /** Client id for sales, supplier id for purchases */
  partyId: string;
  items: OrderItem[];
  date: string;
  deliveryDate: string;
  status: OrderStatus;
};

export type Supplier = { id: string; name: Localized; category: Localized };

export const suppliers: Supplier[] = [
  { id: "s1", name: { ar: "مؤسسة الأثاث الحديث", en: "Modern Furniture Est." }, category: { ar: "أثاث مكتبي", en: "Office furniture" } },
  { id: "s2", name: { ar: "تقنية المستقبل", en: "Future Tech" }, category: { ar: "أجهزة وحاسبات", en: "Hardware & computers" } },
  { id: "s3", name: { ar: "مطبعة الرواد", en: "Al Rowad Printing" }, category: { ar: "طباعة ومطبوعات", en: "Printing" } },
  { id: "s4", name: { ar: "شركة الإمداد السريع", en: "Rapid Supply Co." }, category: { ar: "مستلزمات مكتبية", en: "Office supplies" } },
];

export const orders: Order[] = [
  {
    id: "o1",
    number: "SO-1021",
    type: "sale",
    partyId: "c3",
    items: [
      { name: "باقة تسويق شهرية", qty: 3, unitPrice: 8500 },
      { name: "تصوير فيديو تعريفي", qty: 1, unitPrice: 6000 },
    ],
    date: "2026-10-07",
    deliveryDate: "2026-11-07",
    status: "approved",
  },
  {
    id: "o2",
    number: "PO-2041",
    type: "purchase",
    partyId: "s1",
    items: [
      { name: "مكتب تنفيذي", qty: 4, unitPrice: 3200 },
      { name: "كرسي مريح", qty: 12, unitPrice: 950 },
    ],
    date: "2026-10-08",
    deliveryDate: "2026-10-20",
    status: "pending",
  },
  {
    id: "o3",
    number: "SO-1022",
    type: "sale",
    partyId: "c1",
    items: [{ name: "إدارة حسابات سوشيال", qty: 1, unitPrice: 12000 }],
    date: "2026-10-09",
    deliveryDate: "2026-10-31",
    status: "pending",
  },
  {
    id: "o4",
    number: "PO-2042",
    type: "purchase",
    partyId: "s2",
    items: [
      { name: "لابتوب", qty: 5, unitPrice: 4800 },
      { name: "شاشة 27 بوصة", qty: 5, unitPrice: 1100 },
    ],
    date: "2026-10-05",
    deliveryDate: "2026-10-12",
    status: "fulfilled",
  },
  {
    id: "o5",
    number: "SO-1020",
    type: "sale",
    partyId: "c2",
    items: [{ name: "حملة إعلانات ممولة", qty: 1, unitPrice: 15000 }],
    date: "2026-10-02",
    deliveryDate: "2026-10-25",
    status: "fulfilled",
  },
  {
    id: "o6",
    number: "PO-2043",
    type: "purchase",
    partyId: "s3",
    items: [{ name: "بروشورات A4", qty: 2000, unitPrice: 1.5 }],
    date: "2026-10-10",
    deliveryDate: "2026-10-18",
    status: "draft",
  },
];

export const orderTotal = (order: Pick<Order, "items">) =>
  order.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
