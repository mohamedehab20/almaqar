/** Sample approvals for the public demo (the owner, Khaled, is "me"): waiting for me, sent by me, and decided. */
import { currentUserId, members } from "@/modules/hq/mock";
import type { Approval, ApprovalsData } from "./service";

const DAY = 86_400_000;

/** A small picture to stand in for a photo attachment */
const picture = (label: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${color}"/><text x="160" y="110" font-family="sans-serif" font-size="22" fill="white" text-anchor="middle">${label}</text></svg>`,
  )}`;

export function demoApprovalsData(now = new Date().toISOString(), locale: "ar" | "en" = "ar"): ApprovalsData {
  const ar = locale === "ar";
  const ago = (days: number) => new Date(Date.parse(now) - days * DAY).toISOString();
  const inDays = (days: number) => new Date(Date.parse(now) + days * DAY).toISOString().slice(0, 10);
  const base = { details: null, dueOn: null, attachments: [], decisionNote: null, decidedAt: null } satisfies Partial<Approval>;
  const approvals: Approval[] = [
    {
      ...base,
      id: "ap1",
      requesterId: "m2",
      approverId: currentUserId,
      kind: "action",
      title: ar ? "اعتماد شراء كاميرا جديدة للتصوير" : "Approve buying a new camera",
      details: ar ? "الكاميرا الحالية بتفصل في التصوير الطويل. العرض المرفق من المورد صالح لحد آخر الأسبوع." : "The current camera cuts out on long shoots. The supplier's attached quote is valid until the end of the week.",
      dueOn: inDays(3),
      attachments: [
        { path: "demo/quote.svg", name: ar ? "عرض-السعر.jpg" : "quote.jpg", size: 182_000, type: "image/svg+xml", url: picture(ar ? "عرض سعر" : "Quote", "#1e3a5f") },
        { path: "demo/specs.pdf", name: ar ? "مواصفات-الكاميرا.pdf" : "camera-specs.pdf", size: 640_000, type: "application/pdf" },
      ],
      status: "pending",
      createdAt: ago(0.2),
    },
    {
      ...base,
      id: "ap2",
      requesterId: "m6",
      approverId: currentUserId,
      kind: "position",
      title: ar ? "موقفنا من طلب العميل استرداد جزء من المبلغ" : "Our position on the client's partial refund request",
      details: ar ? "أقترح نرجّع 20% بدل ما نخسر العقد. صور المحادثة مرفقة." : "I suggest refunding 20% rather than losing the contract. Screenshots of the chat attached.",
      attachments: [{ path: "demo/chat.svg", name: ar ? "محادثة-العميل.png" : "client-chat.png", size: 96_000, type: "image/svg+xml", url: picture(ar ? "محادثة" : "Chat", "#0f5257") }],
      status: "pending",
      createdAt: ago(1),
    },
    {
      ...base,
      id: "ap3",
      requesterId: currentUserId,
      approverId: "m3",
      kind: "action",
      title: ar ? "اعتماد التصميم النهائي لهوية مطاعم السرايا" : "Sign off the final Al Saraya identity design",
      status: "pending",
      dueOn: inDays(1),
      createdAt: ago(2),
    },
    {
      ...base,
      id: "ap4",
      requesterId: "m4",
      approverId: currentUserId,
      kind: "action",
      title: ar ? "ساعات إضافية يوم الجمعة لتسليم الحملة" : "Friday overtime to deliver the campaign",
      status: "approved",
      decisionNote: ar ? "موافق، وسجّلها في ساعات العمل" : "Approved, log it in working hours",
      decidedAt: ago(3),
      createdAt: ago(4),
    },
    {
      ...base,
      id: "ap5",
      requesterId: currentUserId,
      approverId: "m5",
      kind: "position",
      title: ar ? "تخفيض سعر الباقة لعميل جديد" : "A lower package price for a new client",
      status: "rejected",
      decisionNote: ar ? "نثبت السعر ونزوّد عدد البوستات بدل كده" : "Keep the price and add posts instead",
      decidedAt: ago(6),
      createdAt: ago(7),
    },
  ];
  return { meId: currentUserId, approvals, members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })) };
}
