/**
 * Client portal demo data: briefs that clients send to the company.
 * The client list itself lives in sections-mock.ts.
 */

type Localized = { ar: string; en: string };

export const campaignTypes = ["shortVideo", "paidAds", "monthlySocial", "productShoot", "productLaunch", "influencers"] as const;
export type CampaignType = (typeof campaignTypes)[number];

export type BriefStatus = "new" | "received" | "clarification";

export type Brief = {
  id: string;
  clientId: string;
  type: CampaignType;
  objective: Localized;
  audience: Localized;
  details: Localized;
  budget: number;
  deadline: string;
  receivedOn: string;
  attachment?: string;
  status: BriefStatus;
};

export const briefs: Brief[] = [
  {
    id: "br1",
    clientId: "c2",
    type: "paidAds",
    objective: { ar: "زيادة حجوزات الأسنان في فرع الشمال ٣٠٪", en: "Grow dental bookings at the north branch by 30%" },
    audience: { ar: "عائلات ٢٥–٤٥ سنة حوالين الفرع", en: "Families aged 25–45 near the branch" },
    details: { ar: "عايزين حملة على سناب وجوجل لمدة شهر مع عرض الكشف المجاني.", en: "A one-month Snapchat + Google campaign with the free check-up offer." },
    budget: 15000,
    deadline: "2026-10-25",
    receivedOn: "2026-10-09",
    attachment: "nour-brief.pdf",
    status: "new",
  },
  {
    id: "br2",
    clientId: "c4",
    type: "productShoot",
    objective: { ar: "صور لمجموعة الخريف الجديدة للمتجر والسوشيال", en: "Photos of the new autumn collection for the store and social" },
    audience: { ar: "مهتمين بالديكور المنزلي", en: "Home decor enthusiasts" },
    details: { ar: "٤٠ منتج، خلفية فاتحة، وصور lifestyle لـ ١٠ منتجات.", en: "40 products, light background, lifestyle shots for 10 of them." },
    budget: 9000,
    deadline: "2026-10-30",
    receivedOn: "2026-10-08",
    status: "new",
  },
  {
    id: "br3",
    clientId: "c3",
    type: "shortVideo",
    objective: { ar: "سلسلة ريلز لتعريف الطلاب بالمدربين", en: "A reel series introducing students to the trainers" },
    audience: { ar: "طلاب جامعة وخريجين جدد", en: "University students and fresh graduates" },
    details: { ar: "٦ ريلز، كل مدرب ريل، بنبرة خفيفة.", en: "6 reels, one per trainer, light tone." },
    budget: 12000,
    deadline: "2026-11-05",
    receivedOn: "2026-10-06",
    status: "received",
  },
];
