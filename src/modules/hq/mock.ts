/**
 * Demo company data used until the backend exists.
 * Shapes follow the planned data model (IMPLEMENTATION_PLAN.md §4) so swapping
 * this file for real queries should not change the components.
 */

export const DEMO_COMPANY_SLUG = "demo";

type Localized = { ar: string; en: string };

export type PresenceStatus = "available" | "busy" | "meeting" | "restroom" | "waiting" | "away" | "offline";

/** Statuses a person can pick for themselves (offline is set by the system) */
export const selectableStatuses: PresenceStatus[] = ["available", "busy", "meeting", "restroom", "waiting", "away"];

export type Member = {
  id: string;
  name: Localized;
  title: Localized;
  departmentId: string;
  status: PresenceStatus;
  currentTask?: Localized;
};

/** Floor-plan units: the whole floor is 1000 × 650 (≈ 18.50m × 12.20m). */
export type Room = {
  id: string;
  type: "meeting" | "ceo" | "open";
  code?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FurnitureItem = {
  id: string;
  kind: "desk" | "meetingTable";
  roomId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** "Business object" binding: a desk belongs to a member */
  memberId?: string;
};

export type DepartmentColor = "blue" | "violet" | "amber" | "emerald";

export type Department = { id: string; name: Localized; color: DepartmentColor };

/** A department's area inside a room (e.g. sections of the open workspace) */
export type Zone = {
  id: string;
  roomId: string;
  departmentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ActivityItem = { id: string; time: string; text: Localized };

export const demoCompany = {
  slug: DEMO_COMPANY_SLUG,
  name: { ar: "شركة المقر التجريبية", en: "Al Maqr Demo Co." },
  floor: { widthM: 18.5, depthM: 12.2 },
};

export const currentUserId = "m1";

export const members: Member[] = [
  {
    id: "m1",
    departmentId: "d-exec",
    name: { ar: "خالد منصور", en: "Khaled Mansour" },
    title: { ar: "المدير التنفيذي", en: "CEO" },
    status: "available",
    currentTask: { ar: "مراجعة خطة الربع", en: "Reviewing the quarterly plan" },
  },
  {
    id: "m2",
    departmentId: "d-projects",
    name: { ar: "نور العتيبي", en: "Nour Al-Otaibi" },
    title: { ar: "مديرة المشروع", en: "Project manager" },
    status: "available",
    currentTask: { ar: "حملة العميل X", en: "Client X campaign" },
  },
  {
    id: "m3",
    departmentId: "d-tech",
    name: { ar: "أحمد كمال", en: "Ahmed Kamal" },
    title: { ar: "مطور معماري", en: "Software architect" },
    status: "busy",
    currentTask: { ar: "بناء محرر المقر", en: "Building the HQ editor" },
  },
  {
    id: "m4",
    departmentId: "d-tech",
    name: { ar: "سارة يوسف", en: "Sara Youssef" },
    title: { ar: "مصممة واجهات", en: "UI designer" },
    status: "meeting",
    currentTask: { ar: "تصميم لوحة التحكم", en: "Dashboard design" },
  },
  {
    id: "m5",
    departmentId: "d-sales",
    name: { ar: "عمر حسن", en: "Omar Hassan" },
    title: { ar: "مسؤول المبيعات", en: "Sales lead" },
    status: "available",
  },
  {
    id: "m6",
    departmentId: "d-admin",
    name: { ar: "ليلى إبراهيم", en: "Laila Ibrahim" },
    title: { ar: "الموارد البشرية", en: "HR" },
    status: "away",
  },
  {
    id: "m7",
    departmentId: "d-admin",
    name: { ar: "يوسف علي", en: "Youssef Ali" },
    title: { ar: "محاسب", en: "Accountant" },
    status: "offline",
  },
];

export const rooms: Room[] = [
  { id: "r-meeting", type: "meeting", x: 0, y: 0, w: 540, h: 300 },
  { id: "r-ceo", type: "ceo", code: "A101", x: 540, y: 0, w: 460, h: 300 },
  { id: "r-open", type: "open", x: 0, y: 300, w: 1000, h: 350 },
];

export const furniture: FurnitureItem[] = [
  { id: "f-table", kind: "meetingTable", roomId: "r-meeting", x: 70, y: 150, w: 360, h: 80 },
  { id: "f-ceo", kind: "desk", roomId: "r-ceo", x: 700, y: 140, w: 150, h: 90, memberId: "m1" },
  // Projects (rightmost zone)
  { id: "f-d1", kind: "desk", roomId: "r-open", x: 770, y: 412, w: 195, h: 70, memberId: "m2" },
  { id: "f-d2", kind: "desk", roomId: "r-open", x: 770, y: 527, w: 195, h: 70 },
  // Technology & design
  { id: "f-d3", kind: "desk", roomId: "r-open", x: 525, y: 412, w: 195, h: 70, memberId: "m3" },
  { id: "f-d4", kind: "desk", roomId: "r-open", x: 525, y: 527, w: 195, h: 70, memberId: "m4" },
  // Sales
  { id: "f-d5", kind: "desk", roomId: "r-open", x: 280, y: 412, w: 195, h: 70, memberId: "m5" },
  { id: "f-d6", kind: "desk", roomId: "r-open", x: 280, y: 527, w: 195, h: 70 },
  // Administration (HR + finance)
  { id: "f-d7", kind: "desk", roomId: "r-open", x: 35, y: 412, w: 195, h: 70, memberId: "m6" },
  { id: "f-d8", kind: "desk", roomId: "r-open", x: 35, y: 527, w: 195, h: 70, memberId: "m7" },
];

export const departments: Department[] = [
  { id: "d-exec", name: { ar: "الإدارة التنفيذية", en: "Executive office" }, color: "blue" },
  { id: "d-projects", name: { ar: "المشاريع", en: "Projects" }, color: "blue" },
  { id: "d-tech", name: { ar: "التقنية والتصميم", en: "Tech & design" }, color: "violet" },
  { id: "d-sales", name: { ar: "المبيعات", en: "Sales" }, color: "amber" },
  { id: "d-admin", name: { ar: "الشؤون الإدارية", en: "Administration" }, color: "emerald" },
];

/** The open workspace split into department sections (physical order, right → left). */
export const zones: Zone[] = [
  { id: "z-projects", roomId: "r-open", departmentId: "d-projects", x: 750, y: 365, w: 235, h: 270 },
  { id: "z-tech", roomId: "r-open", departmentId: "d-tech", x: 505, y: 365, w: 235, h: 270 },
  { id: "z-sales", roomId: "r-open", departmentId: "d-sales", x: 260, y: 365, w: 235, h: 270 },
  { id: "z-admin", roomId: "r-open", departmentId: "d-admin", x: 15, y: 365, w: 235, h: 270 },
];

export const activity: ActivityItem[] = [
  { id: "a1", time: "10:42", text: { ar: "أحمد كمال أنجز مهمة «هيكل البيانات»", en: "Ahmed Kamal completed “Data model”" } },
  { id: "a2", time: "10:44", text: { ar: "نور العتيبي حدّثت مشروع العميل X", en: "Nour Al-Otaibi updated Client X project" } },
  { id: "a3", time: "10:46", text: { ar: "خالد منصور اعتمد طلب إجازة", en: "Khaled Mansour approved a leave request" } },
  { id: "a4", time: "10:50", text: { ar: "يوسف علي رفع التقرير المالي", en: "Youssef Ali uploaded the finance report" } },
];

/** "Name — Job title · Department": tells apart employees with similar names in pickers. */
export function memberLabel(member: Member, locale: "ar" | "en"): string {
  const department = departments.find((d) => d.id === member.departmentId)?.name[locale];
  return `${member.name[locale]} — ${member.title[locale]}${department ? ` · ${department}` : ""}`;
}

/** "Job title · Department" (the part after the name). */
export function memberRole(member: Member, locale: "ar" | "en"): string {
  const department = departments.find((d) => d.id === member.departmentId)?.name[locale];
  return department ? `${member.title[locale]} · ${department}` : member.title[locale];
}
