/** Sample «بوابة العملاء» for the public demo: clients of marketing, sales, operations and a department, and visitors. */
import { departments, members } from "@/modules/hq/mock";
import { defaultAccess } from "./access";
import type { ClientInvoice, ClientMeeting, ClientPortalData, PortalClient } from "./service";

const DAY = 86_400_000;

export function demoClientPortalData(now = new Date().toISOString(), locale: "ar" | "en" = "ar"): ClientPortalData {
  const ar = locale === "ar";
  const at = (days: number, utcHour: number) => {
    const d = new Date(Date.parse(now) + days * DAY);
    d.setUTCHours(utcHour, 0, 0, 0);
    return d.toISOString();
  };
  const base = { industry: null, status: "active", managerId: null, contactName: null, contactPhone: null, contactEmail: null, notes: null, inviteCode: null, portalUsers: 0, kind: "client", room: null, departmentId: null } as const;
  const rows: (Partial<PortalClient> & { id: string; name: string })[] = [
    { id: "cp1", name: ar ? "مطاعم السرايا" : "Al Saraya Restaurants", industry: ar ? "مطاعم" : "Restaurants", room: "marketing", managerId: "m5", contactName: ar ? "أ. هشام" : "Mr. Hesham", contactPhone: "+20 100 123 4567", inviteCode: "SRY4K9P", portalUsers: 2 },
    { id: "cp2", name: ar ? "عيادات نور" : "Nour Clinics", industry: ar ? "صحة" : "Health", room: "marketing", managerId: "m2", status: "onboarding", inviteCode: "NUR7Q2M", portalUsers: 1 },
    { id: "cp3", name: ar ? "براند فيت" : "BrandFit", industry: ar ? "رياضة" : "Fitness", room: "marketing", managerId: "m5", status: "paused", inviteCode: "BFT3W8X" },
    { id: "cp4", name: ar ? "شركة الأفق للتوريدات" : "Horizon Supplies", industry: ar ? "توريدات" : "Supplies", room: "sales", managerId: "m5", contactName: ar ? "م. عادل" : "Eng. Adel", contactPhone: "+20 122 555 0101", inviteCode: "HRZ5T6Y", portalUsers: 1 },
    { id: "cp5", name: ar ? "مجموعة دلتا العقارية" : "Delta Real Estate", industry: ar ? "عقارات" : "Real estate", room: "sales", status: "onboarding", inviteCode: "DLT9R4B" },
    { id: "cp6", name: ar ? "مصنع الشروق" : "El Shorouk Factory", industry: ar ? "صناعة" : "Manufacturing", room: "operations", managerId: "m2", inviteCode: "SHR2N7C" },
    { id: "cp7", name: ar ? "تطبيق مشوار" : "Mishwar App", industry: ar ? "تقنية" : "Tech", departmentId: "d-tech", managerId: "m3", inviteCode: "MSH8H3D", portalUsers: 1 },
    { id: "cp8", name: ar ? "أ. سامح فؤاد" : "Mr. Sameh Fouad", kind: "visitor", contactName: ar ? "سامح فؤاد" : "Sameh Fouad", contactPhone: "+20 111 987 6543", notes: ar ? "مستثمر، جاي يتعرف على الشركة" : "Investor, coming to meet the team", inviteCode: "VST6J1E" },
    { id: "cp9", name: ar ? "وفد جامعة القاهرة" : "Cairo University delegation", kind: "visitor", contactName: ar ? "د. منى" : "Dr. Mona", notes: ar ? "زيارة لطلبة التدريب" : "Visit about internships", inviteCode: "VST4L5F" },
  ];
  const clients = rows.map(
    (r, i): PortalClient => ({
      ...base,
      // Sales clients see invoices and meetings only; the rest start from their kind's default
      portalAccess: r.room === "sales" ? ["invoices", "meetings"] : defaultAccess(r.kind ?? "client"),
      hasContract: r.kind !== "visitor" && i % 2 === 0,
      ...r,
      createdAt: new Date(Date.parse(now) - (i + 1) * 5 * DAY).toISOString(),
    }),
  );
  const day = (days: number) => new Date(Date.parse(now) + days * DAY).toISOString().slice(0, 10);
  const invoices: ClientInvoice[] = [
    { id: "inv1", clientId: "cp1", period: day(-30).slice(0, 7), amount: 18000, issuedOn: day(-30), dueOn: day(-16), paidOn: day(-18) },
    { id: "inv2", clientId: "cp1", period: day(0).slice(0, 7), amount: 18000, issuedOn: day(-2), dueOn: day(12), paidOn: null },
    { id: "inv3", clientId: "cp4", period: day(-30).slice(0, 7), amount: 42500, issuedOn: day(-25), dueOn: day(-5), paidOn: null },
  ];
  const meetings: ClientMeeting[] = [
    { id: "mt1", clientId: "cp8", title: ar ? "تعارف مع المستثمر" : "Meeting the investor", startsAt: at(1, 9), durationMinutes: 60, location: ar ? "غرفة الاجتماعات" : "Meeting room" },
    { id: "mt2", clientId: "cp9", title: ar ? "زيارة وفد الجامعة" : "University visit", startsAt: at(3, 8), durationMinutes: 90, location: ar ? "المكتب الرئيسي" : "Main office" },
    { id: "mt3", clientId: "cp4", title: ar ? "عرض أسعار التوريد" : "Supply quotation", startsAt: at(2, 11), durationMinutes: 45, location: null },
    { id: "mt4", clientId: "cp1", title: ar ? "مراجعة حملة الشهر" : "Monthly campaign review", startsAt: at(5, 10), durationMinutes: 30, location: "Google Meet" },
  ];
  return {
    now,
    canManage: true,
    canMoney: true,
    invoices,
    clients,
    meetings,
    departments,
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}
