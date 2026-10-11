/** AI agents available in the "Jarab" (the company's agents bag) — demo data until the backend exists. */

type Localized = { ar: string; en: string };

/** general: takes any task. specialist: built for one kind of task. */
export type AgentKind = "general" | "specialist";
export type AgentStatus = "active" | "busy" | "paused";

export type Agent = {
  id: string;
  kind: AgentKind;
  name: Localized;
  /** Short tagline under the name */
  role: Localized;
  description: Localized;
  skills: Localized[];
  /** Department the specialist serves (empty for general agents) */
  area?: Localized;
  status: AgentStatus;
  tasksDone: number;
  /** Tasks waiting or running right now */
  queue: number;
};

export const agents: Agent[] = [
  {
    id: "a-assistant",
    kind: "general",
    name: { ar: "مساعد المقر", en: "Maqr Assistant" },
    role: { ar: "وكيل لأي مهمة", en: "Agent for any task" },
    description: {
      ar: "اكتب له المطلوب بكلامك: يكتب، يلخّص، يدوّر على معلومة، أو يجهّز مسودة رد.",
      en: "Tell it what you need in your own words: it writes, summarizes, researches or drafts replies.",
    },
    skills: [
      { ar: "كتابة", en: "Writing" },
      { ar: "تلخيص", en: "Summaries" },
      { ar: "بحث", en: "Research" },
      { ar: "ترجمة", en: "Translation" },
    ],
    status: "active",
    tasksDone: 342,
    queue: 2,
  },
  {
    id: "a-coordinator",
    kind: "general",
    name: { ar: "المنسّق", en: "Coordinator" },
    role: { ar: "يوزّع الشغل ويتابعه", en: "Assigns and follows up work" },
    description: {
      ar: "يقسّم المهمة الكبيرة لخطوات، يوزّعها على الموظفين أو الوكلاء المتخصصين، ويفكّر الكل بالمواعيد.",
      en: "Breaks a big task into steps, hands them to employees or specialist agents, and reminds everyone of deadlines.",
    },
    skills: [
      { ar: "تخطيط", en: "Planning" },
      { ar: "متابعة", en: "Follow-up" },
      { ar: "تذكير", en: "Reminders" },
    ],
    status: "busy",
    tasksDone: 128,
    queue: 5,
  },
  {
    id: "a-contracts",
    kind: "specialist",
    name: { ar: "محلل العقود", en: "Contract Analyst" },
    role: { ar: "مراجعة العقود", en: "Contract review" },
    description: {
      ar: "يراجع العقد، يطلّع البنود المهمة والمخاطر، ويقارنه بسياسات الشركة قبل التوقيع.",
      en: "Reviews contracts, pulls out key clauses and risks, and checks them against company policy before signing.",
    },
    skills: [
      { ar: "البنود", en: "Clauses" },
      { ar: "المخاطر", en: "Risks" },
      { ar: "المقارنة", en: "Comparison" },
    ],
    area: { ar: "غرفة العمليات", en: "Operations room" },
    status: "active",
    tasksDone: 57,
    queue: 1,
  },
  {
    id: "a-quotes",
    kind: "specialist",
    name: { ar: "وكيل عروض الأسعار", en: "Quotation Agent" },
    role: { ar: "عروض أسعار وأوامر", en: "Quotes and orders" },
    description: {
      ar: "يجهّز عروض الأسعار وأوامر البيع والشراء من بيانات العميل أو المورد ويبعتها للموافقة.",
      en: "Prepares quotations and sale/purchase orders from client or supplier data and sends them for approval.",
    },
    skills: [
      { ar: "تسعير", en: "Pricing" },
      { ar: "أوامر بيع", en: "Sale orders" },
      { ar: "أوامر شراء", en: "Purchase orders" },
    ],
    area: { ar: "المبيعات", en: "Sales" },
    status: "active",
    tasksDone: 89,
    queue: 0,
  },
  {
    id: "a-content",
    kind: "specialist",
    name: { ar: "كاتب المحتوى", en: "Content Writer" },
    role: { ar: "محتوى الحملات", en: "Campaign content" },
    description: {
      ar: "يكتب الهوك والكابشن ونصوص الإعلانات من البريف، ويطلّع أكتر من نسخة للاختبار.",
      en: "Writes hooks, captions and ad copy from a brief, with several versions to test.",
    },
    skills: [
      { ar: "هوك", en: "Hooks" },
      { ar: "كابشن", en: "Captions" },
      { ar: "نسخ A/B", en: "A/B versions" },
    ],
    area: { ar: "التسويق", en: "Marketing" },
    status: "busy",
    tasksDone: 214,
    queue: 3,
  },
  {
    id: "a-recruiter",
    kind: "specialist",
    name: { ar: "فرز السير الذاتية", en: "CV Screener" },
    role: { ar: "التوظيف", en: "Recruiting" },
    description: {
      ar: "يفرز السير الذاتية حسب متطلبات الوظيفة، يرتّب المرشحين، ويقترح مواعيد المقابلات.",
      en: "Screens CVs against the job requirements, ranks candidates and suggests interview slots.",
    },
    skills: [
      { ar: "فرز", en: "Screening" },
      { ar: "ترتيب", en: "Ranking" },
      { ar: "مقابلات", en: "Interviews" },
    ],
    area: { ar: "الموارد البشرية", en: "Human resources" },
    status: "paused",
    tasksDone: 41,
    queue: 0,
  },
  {
    id: "a-accountant",
    kind: "specialist",
    name: { ar: "المحاسب", en: "Accountant" },
    role: { ar: "الفواتير والمصروفات", en: "Invoices and expenses" },
    description: {
      ar: "يطابق الفواتير مع أوامر الشراء، يصنّف المصروفات، ويجهّز تقرير شهري.",
      en: "Matches invoices to purchase orders, categorizes expenses and prepares a monthly report.",
    },
    skills: [
      { ar: "مطابقة", en: "Matching" },
      { ar: "تصنيف", en: "Categorizing" },
      { ar: "تقارير", en: "Reports" },
    ],
    area: { ar: "الحسابات", en: "Accounts" },
    status: "active",
    tasksDone: 76,
    queue: 1,
  },
  {
    id: "a-support",
    kind: "specialist",
    name: { ar: "خدمة العملاء", en: "Client Support" },
    role: { ar: "الرد على العملاء", en: "Client replies" },
    description: {
      ar: "يرد على أسئلة العملاء في بوابة العميل، ويحوّل الطلبات المهمة للموظف المسؤول.",
      en: "Answers client questions in the client portal and escalates important requests to the right employee.",
    },
    skills: [
      { ar: "ردود", en: "Replies" },
      { ar: "تحويل", en: "Escalation" },
      { ar: "متابعة", en: "Follow-up" },
    ],
    area: { ar: "بوابة العميل", en: "Client portal" },
    status: "active",
    tasksDone: 163,
    queue: 0,
  },
];
