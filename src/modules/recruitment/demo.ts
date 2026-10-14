/** Sample recruitment for the public demo: five jobs and candidates at every stage, built around `now`. */
import { currentUserId, departments, members } from "@/modules/hq/mock";
import type { Candidate, Job, Source, Stage } from "./pipeline";
import type { RecruitmentData } from "./service";

const DAY = 86_400_000;

export function demoRecruitmentData(now = new Date().toISOString(), locale: "ar" | "en" = "ar"): RecruitmentData {
  const ago = (days: number) => new Date(Date.parse(now) - days * DAY).toISOString();
  /** An interview `days` from now at a round hour (UTC; 11:00 or 13:00 in Cairo) */
  const at = (days: number, utcHour: number) => {
    const d = new Date(Date.parse(now) + days * DAY);
    d.setUTCHours(utcHour, 0, 0, 0);
    return d.toISOString();
  };
  const ar = locale === "ar";
  const job = (id: string, title: [string, string], departmentId: string, over: Partial<Job>): Job => ({
    id,
    title: ar ? title[0] : title[1],
    departmentId,
    employmentType: "fullTime",
    workMode: "office",
    openings: 1,
    status: "open",
    description: null,
    requirements: null,
    salaryMin: null,
    salaryMax: null,
    hiringManagerId: null,
    createdAt: ago(30),
    ...over,
  });
  const jobs: Job[] = [
    job("j1", ["مصمم جرافيك أول", "Senior graphic designer"], "d-tech", {
      openings: 2,
      salaryMin: 18_000,
      salaryMax: 25_000,
      hiringManagerId: "m3",
      workMode: "hybrid",
      description: ar ? "تصميم هوية وحملات سوشيال ميديا لعملاء الوكالة." : "Brand identities and social campaigns for the agency's clients.",
      requirements: ar ? "خبرة 4 سنين على الأقل، وإتقان برامج Figma و Adobe، وبورتفوليو قوي." : "4+ years, Figma and Adobe, a strong portfolio.",
      createdAt: ago(24),
    }),
    job("j2", ["مسؤول مبيعات", "Sales executive"], "d-sales", { openings: 1, salaryMin: 12_000, salaryMax: 16_000, hiringManagerId: "m5", createdAt: ago(18) }),
    job("j3", ["مونتير فيديو", "Video editor"], "d-projects", { employmentType: "freelance", workMode: "remote", hiringManagerId: "m2", createdAt: ago(10) }),
    job("j4", ["محاسب", "Accountant"], "d-admin", { status: "paused", hiringManagerId: "m6", createdAt: ago(40) }),
    job("j5", ["متدرب سوشيال ميديا", "Social media intern"], "d-projects", { status: "closed", employmentType: "internship", createdAt: ago(60) }),
  ];

  type Row = [jobId: string, name: string, stage: Stage, source: Source, rating: number | null, daysInStage: number, extra?: Partial<Candidate>];
  const rows: Row[] = [
    ["j1", ar ? "مريم عادل" : "Mariam Adel", "applied", "linkedin", null, 1],
    ["j1", ar ? "كريم سامي" : "Karim Samy", "applied", "website", null, 2],
    ["j1", ar ? "هبة فتحي" : "Heba Fathy", "screening", "referral", 4, 3, { referredById: "m3" }],
    ["j1", ar ? "يوسف طارق" : "Youssef Tarek", "interview", "linkedin", 4, 2, { interviewAt: at(2, 8) }],
    ["j1", ar ? "سلمى ناصر" : "Salma Nasser", "offer", "wuzzuf", 5, 1],
    ["j1", ar ? "عمرو خالد" : "Amr Khaled", "rejected", "facebook", 2, 6, { rejectedReason: ar ? "البورتفوليو مش مناسب للمستوى" : "Portfolio below the level needed" }],
    ["j2", ar ? "أحمد رفعت" : "Ahmed Refaat", "screening", "wuzzuf", 3, 5],
    ["j2", ar ? "نادين حسام" : "Nadine Hossam", "interview", "linkedin", 4, 1, { interviewAt: at(1, 10) }],
    ["j2", ar ? "محمود جمال" : "Mahmoud Gamal", "applied", "referral", null, 0, { referredById: "m5" }],
    ["j3", ar ? "علي مصطفى" : "Ali Mostafa", "applied", "facebook", null, 3],
    ["j3", ar ? "رنا إبراهيم" : "Rana Ibrahim", "screening", "other", 3, 2],
    ["j4", ar ? "شريف منير" : "Sherif Mounir", "interview", "wuzzuf", 3, 9],
    ["j5", ar ? "جنى وليد" : "Jana Walid", "hired", "website", 5, 20],
    ["j5", ar ? "زياد هشام" : "Ziad Hesham", "rejected", "linkedin", 2, 25, { rejectedReason: ar ? "اختار عرض تاني" : "Took another offer" }],
  ];
  const candidates: Candidate[] = rows.map(([jobId, name, stage, source, rating, days, extra], i) => ({
    id: `demo-cand-${i + 1}`,
    jobId,
    name,
    email: `candidate${i + 1}@example.com`,
    phone: `+20 10${String(10_000_000 + i * 7_391_113).slice(0, 8)}`,
    source,
    stage,
    rating,
    notes: null,
    cvUrl: null,
    referredById: null,
    interviewAt: null,
    rejectedReason: null,
    hiredMemberId: null,
    stageChangedAt: ago(days),
    createdAt: ago(days + 4),
    ...extra,
  }));

  return {
    now,
    meId: currentUserId,
    canManage: true,
    jobs,
    candidates,
    departments,
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}
