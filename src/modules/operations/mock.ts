/**
 * Demo data for the Operations & Automation page, until the workflow engine exists.
 * Text is stored per language because it is company data, not UI copy.
 */

type Localized = { ar: string; en: string };

export type OpsCategory = "contracts" | "purchasing" | "finance" | "maintenance" | "operations" | "sales";

export const categoryCounts: Record<OpsCategory, number> = {
  contracts: 8,
  purchasing: 6,
  finance: 9,
  maintenance: 5,
  operations: 3,
  sales: 6,
};

export const kpis = {
  activeWorkflows: { value: 37, trend: "+8.4%", progress: 0.72 },
  pendingApprovals: { value: 7, oldest: { hours: 4, minutes: 12 } },
  automationRate: { value: 94.8, perWeek: 1420 },
  cycleTime: { hours: 2.4, previousHours: 48, saved: 95 },
};

export type RowNature = "human" | "automated" | "autoCompleted";
export type RowStatus = "pending" | "processing" | "done" | "review";

export type WorkflowRow = {
  id: string;
  code: string;
  category: OpsCategory;
  title: Localized;
  categoryLabel: Localized;
  owner: { name: Localized; role: Localized; bot?: boolean };
  step: { title: Localized; by: Localized; tone: "danger" | "info" | "muted" };
  nature: RowNature;
  deciders: string[] | Localized;
  status: RowStatus;
};

export const workflowRows: WorkflowRow[] = [
  {
    id: "w1",
    code: "OP-1042",
    category: "contracts",
    title: { ar: "عقد تشطيب بهو المقر الرئيسي", en: "Main HQ lobby finishing contract" },
    categoryLabel: { ar: "العقود", en: "Contracts" },
    owner: { name: { ar: "سعود النمر", en: "Saud Al-Nemr" }, role: { ar: "مهندس مشاريع", en: "Project engineer" } },
    step: { title: { ar: "مراجعة البنود الجزائية", en: "Penalty clauses review" }, by: { ar: "المستشار القانوني", en: "Legal advisor" }, tone: "danger" },
    nature: "human",
    deciders: ["م", "ح", "ق"],
    status: "pending",
  },
  {
    id: "w3",
    code: "OP-1039",
    category: "maintenance",
    title: { ar: "صيانة دورية للمصاعد وتوافق الكهرباء", en: "Elevator & electrical maintenance" },
    categoryLabel: { ar: "الصيانة", en: "Maintenance" },
    owner: { name: { ar: "فهد السبيعي", en: "Fahd Al-Subaie" }, role: { ar: "مسؤول السلامة", en: "Safety officer" } },
    step: { title: { ar: "إغلاق التقرير الفني", en: "Close technical report" }, by: { ar: "تم الأرشفة تلقائياً", en: "Archived automatically" }, tone: "muted" },
    nature: "autoCompleted",
    deciders: { ar: "مدير المرافق", en: "Facilities manager" },
    status: "done",
  },
  {
    id: "w4",
    code: "OP-1040",
    category: "finance",
    title: { ar: "صرف دفعة مستخلص المقاول الإنشائي", en: "Contractor progress payment" },
    categoryLabel: { ar: "الإدارة المالية", en: "Finance" },
    owner: { name: { ar: "ناصر الجبرين", en: "Nasser Al-Jabreen" }, role: { ar: "مراقب مالي", en: "Financial controller" } },
    step: { title: { ar: "مطابقة شهادة الإنجاز الميدانية", en: "Field completion certificate check" }, by: { ar: "قسم المساحة والمطابقة", en: "Survey & compliance" }, tone: "muted" },
    nature: "human",
    deciders: ["ع", "م"],
    status: "review",
  },
  {
    id: "w5",
    code: "OP-1045",
    category: "purchasing",
    title: { ar: "توريد أجهزة حاسب للفريق الجديد", en: "Laptops for the new team" },
    categoryLabel: { ar: "المشتريات", en: "Purchasing" },
    owner: { name: { ar: "مها القحطاني", en: "Maha Al-Qahtani" }, role: { ar: "مسؤولة مشتريات", en: "Purchasing officer" } },
    step: { title: { ar: "مقارنة عروض الموردين", en: "Compare supplier quotes" }, by: { ar: "لجنة المشتريات", en: "Purchasing committee" }, tone: "muted" },
    nature: "human",
    deciders: ["م", "خ"],
    status: "review",
  },
  {
    id: "w6",
    code: "OP-1046",
    category: "operations",
    title: { ar: "تشغيل نظام الحضور في الفرع الجديد", en: "Attendance system go-live at the new branch" },
    categoryLabel: { ar: "التشغيل", en: "Operations" },
    owner: { name: { ar: "بوت النظام Ops-Core", en: "Ops-Core system bot" }, role: { ar: "خدمة سحابية", en: "Cloud service" }, bot: true },
    step: { title: { ar: "تفعيل الأجهزة وربطها بالشبكة", en: "Activate devices and connect them" }, by: { ar: "تكامل API تلقائي", en: "Automatic API integration" }, tone: "info" },
    nature: "automated",
    deciders: { ar: "بدون تدخل بشري", en: "No human input" },
    status: "processing",
  },
  {
    id: "w7",
    code: "OP-1047",
    category: "sales",
    title: { ar: "عرض سعر لعميل التجزئة الجديد", en: "Quote for the new retail client" },
    categoryLabel: { ar: "المبيعات", en: "Sales" },
    owner: { name: { ar: "عمر حسن", en: "Omar Hassan" }, role: { ar: "مسؤول المبيعات", en: "Sales lead" } },
    step: { title: { ar: "اعتماد الخصم الخاص", en: "Approve the special discount" }, by: { ar: "مدير المبيعات", en: "Sales manager" }, tone: "danger" },
    nature: "human",
    deciders: ["خ"],
    status: "pending",
  },
];
