/**
 * Company schedule in the Operations room: internal meetings, appointments, trips outside the office
 * (client visits, suppliers, government offices) and interviews. Demo data until the screens are wired
 * to the backend (operations/service.ts: listSchedule, createScheduleItem, …).
 */

export type ScheduleKind = "meeting" | "appointment" | "trip" | "interview";
export type ScheduleStatus = "scheduled" | "done" | "cancelled";
export type Transport = "companyCar" | "ownCar" | "taxi" | "online" | "none";

export type ScheduleItem = {
  id: string;
  kind: ScheduleKind;
  title: string;
  /** Local date and time "yyyy-mm-ddThh:mm" */
  startsAt: string;
  durationMinutes: number;
  /** A room in the office, an address outside, or a meeting link */
  location: string;
  organizerId: string;
  attendeeIds: string[];
  /** Client it is about (Marketing → Clients), if any */
  clientId?: string;
  /** The person outside the company: who we meet, or the candidate */
  contact?: { name: string; phone?: string; role?: string };
  purpose?: string;
  /** Trips: how the team gets there */
  transport?: Transport;
  notes?: string;
  status: ScheduleStatus;
};

export const scheduleKinds: ScheduleKind[] = ["meeting", "appointment", "trip", "interview"];
export const transports: Transport[] = ["companyCar", "ownCar", "taxi", "online", "none"];

/** "yyyy-mm-ddThh:mm" → minutes since epoch-ish, for overlap checks (local time, same calendar). */
const minutes = (at: string) => Date.parse(`${at}:00Z`) / 60_000;
export const endOf = (item: ScheduleItem) => minutes(item.startsAt) + item.durationMinutes;

/** Items where a member is booked twice at the same time (cancelled items do not count). */
export function conflicts(items: ScheduleItem[]) {
  const clash = new Set<string>();
  const live = items.filter((i) => i.status !== "cancelled");
  for (let a = 0; a < live.length; a++) {
    for (let b = a + 1; b < live.length; b++) {
      const x = live[a];
      const y = live[b];
      const people = new Set([x.organizerId, ...x.attendeeIds]);
      const shared = [y.organizerId, ...y.attendeeIds].some((id) => people.has(id));
      if (shared && minutes(x.startsAt) < endOf(y) && minutes(y.startsAt) < endOf(x)) {
        clash.add(x.id);
        clash.add(y.id);
      }
    }
  }
  return clash;
}

/** Demo items around today, so the week view always has something to show. */
export function demoSchedule(today = new Date()): ScheduleItem[] {
  const day = (offset: number, time: string) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
  };
  return [
    {
      id: "s1",
      kind: "meeting",
      title: "اجتماع الإدارة الأسبوعي",
      startsAt: day(0, "10:00"),
      durationMinutes: 60,
      location: "غرفة الاجتماعات",
      organizerId: "m1",
      attendeeIds: ["m2", "m3", "m5"],
      purpose: "متابعة أرقام الأسبوع وخطة المبيعات",
      status: "scheduled",
    },
    {
      id: "s2",
      kind: "trip",
      title: "زيارة عيادات نور — تصوير الفيديو التعريفي",
      startsAt: day(0, "13:00"),
      durationMinutes: 180,
      location: "عيادات نور، ٢٥ شارع التسعين، التجمع الخامس، القاهرة الجديدة",
      organizerId: "m3",
      attendeeIds: ["m4"],
      clientId: "c2",
      contact: { name: "د. هالة فؤاد", phone: "01001234567", role: "المدير الطبي" },
      purpose: "تصوير لقطات العيادة والطاقم لفيديو الـ٦٠ ثانية بعد ملاحظات العميل",
      transport: "companyCar",
      notes: "خد الكاميرا والإضاءة. التصوير قبل مواعيد الكشف.",
      status: "scheduled",
    },
    {
      id: "s3",
      kind: "interview",
      title: "مقابلة — مصمم جرافيك",
      startsAt: day(1, "11:00"),
      durationMinutes: 45,
      location: "مكتب المدير التنفيذي",
      organizerId: "m1",
      attendeeIds: ["m2"],
      contact: { name: "يوسف إبراهيم", phone: "01112223344", role: "مرشح لوظيفة مصمم جرافيك" },
      purpose: "مراجعة البورتفوليو واختبار عملي قصير",
      status: "scheduled",
    },
    {
      id: "s4",
      kind: "appointment",
      title: "موعد مع المورد — عرض أسعار الطباعة",
      startsAt: day(1, "14:30"),
      durationMinutes: 30,
      location: "مكالمة فيديو (Google Meet)",
      organizerId: "m2",
      attendeeIds: [],
      contact: { name: "شركة النيل للطباعة — أ. سامح", phone: "0225551234" },
      purpose: "تفاوض على أسعار طباعة البروشورات",
      transport: "online",
      status: "scheduled",
    },
    {
      id: "s5",
      kind: "trip",
      title: "مشوار السجل التجاري — تجديد البطاقة الضريبية",
      startsAt: day(2, "09:00"),
      durationMinutes: 150,
      location: "مصلحة الضرائب، مدينة نصر",
      organizerId: "m5",
      attendeeIds: [],
      purpose: "تجديد البطاقة الضريبية قبل نهاية الشهر",
      transport: "taxi",
      notes: "الأوراق المطلوبة: صورة السجل، البطاقة القديمة، توكيل.",
      status: "scheduled",
    },
    {
      id: "s6",
      kind: "meeting",
      title: "مراجعة حملة أكاديمية المسار مع العميل",
      startsAt: day(3, "12:00"),
      durationMinutes: 60,
      location: "غرفة الاجتماعات",
      organizerId: "m3",
      attendeeIds: ["m1"],
      clientId: "c3",
      contact: { name: "أ. منى رشاد", phone: "01223334455", role: "مديرة التسويق — أكاديمية المسار" },
      purpose: "عرض الريلز الثلاثة والاتفاق على عدد التعديلات",
      status: "scheduled",
    },
    {
      id: "s7",
      kind: "trip",
      title: "زيارة مخبز الصباح — الفرع الجديد",
      startsAt: day(-1, "16:00"),
      durationMinutes: 90,
      location: "مخبز الصباح، ميدان روكسي، مصر الجديدة",
      organizerId: "m4",
      attendeeIds: [],
      clientId: "c1",
      contact: { name: "أ. طارق", phone: "01099887766", role: "صاحب المخبز" },
      purpose: "تصوير افتتاح الفرع الجديد",
      transport: "ownCar",
      status: "done",
    },
  ];
}
