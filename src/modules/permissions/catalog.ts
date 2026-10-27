/**
 * Every permission an owner can grant inside their HQ. The owner always has all of them, and
 * managing permissions themselves is owner-only (never grantable).
 * `scoped`: the grant can be limited to some departments; the check then uses the department of the
 * member the action is about (target member, task assignee, note author, order creator).
 * `*.view` opens or closes a whole room and is never scoped.
 */

type Localized = { ar: string; en: string };

export type PermissionArea = "hr" | "operations" | "automation" | "sales" | "marketing" | "agents" | "analytics" | "company";

export type PermissionDef = { key: string; area: PermissionArea; label: Localized; scoped?: boolean };

export const PERMISSIONS = [
  { key: "hr.view", area: "hr", label: { ar: "فتح الموارد البشرية", en: "Open HR" } },
  { key: "members.invite", area: "hr", scoped: true, label: { ar: "إضافة موظفين", en: "Add employees" } },
  { key: "members.edit", area: "hr", scoped: true, label: { ar: "تعديل بيانات الموظفين", en: "Edit employees" } },
  { key: "members.remove", area: "hr", scoped: true, label: { ar: "إزالة موظفين", en: "Remove employees" } },
  { key: "departments.manage", area: "hr", label: { ar: "إدارة الأقسام", en: "Manage departments" } },
  { key: "leaves.manage", area: "hr", scoped: true, label: { ar: "اعتماد الإجازات وتعديل الأرصدة", en: "Approve leave and edit balances" } },
  { key: "hours.manage", area: "hr", scoped: true, label: { ar: "متابعة ساعات العمل وتعديلها", en: "Follow and edit working hours" } },
  { key: "recruitment.manage", area: "hr", label: { ar: "إدارة التوظيف والمرشحين", en: "Manage recruitment and candidates" } },

  { key: "operations.view", area: "operations", label: { ar: "فتح غرفة العمليات", en: "Open the Operations room" } },
  { key: "operations.create", area: "operations", label: { ar: "إضافة عمليات", en: "Add operations" } },
  { key: "notes.write", area: "operations", label: { ar: "كتابة ملاحظات", en: "Write notes" } },
  { key: "notes.manage", area: "operations", scoped: true, label: { ar: "تثبيت وحذف ملاحظات الآخرين", en: "Pin and delete others' notes" } },
  { key: "tasks.create", area: "operations", label: { ar: "إضافة مهام", en: "Add tasks" } },
  { key: "tasks.manage", area: "operations", scoped: true, label: { ar: "إدارة مهام الآخرين", en: "Manage others' tasks" } },

  { key: "automation.view", area: "automation", label: { ar: "فتح غرفة الأتمتة", en: "Open the Automation room" } },
  { key: "workflows.manage", area: "automation", label: { ar: "إنشاء وتعديل مسارات الموافقة", en: "Create and edit approval workflows" } },
  { key: "runs.start", area: "automation", label: { ar: "بدء مسار موافقة", en: "Start approval runs" } },
  { key: "flows.manage", area: "automation", label: { ar: "إدارة الـ flows الأوتوماتيكية", en: "Manage automated flows" } },

  { key: "sales.view", area: "sales", label: { ar: "فتح المبيعات", en: "Open Sales" } },
  { key: "orders.create", area: "sales", label: { ar: "إنشاء أوامر بيع وشراء", en: "Create sale and purchase orders" } },
  { key: "orders.approve", area: "sales", scoped: true, label: { ar: "اعتماد وتغيير حالة الطلبات", en: "Approve and change order status" } },
  { key: "suppliers.manage", area: "sales", label: { ar: "إدارة الموردين", en: "Manage suppliers" } },

  { key: "marketing.view", area: "marketing", label: { ar: "فتح التسويق", en: "Open Marketing" } },
  { key: "clients.view", area: "marketing", label: { ar: "فتح بوابة العملاء", en: "Open the client portal" } },
  { key: "clients.manage", area: "marketing", label: { ar: "إدارة العملاء وأكواد الدعوة", en: "Manage clients and invite codes" } },
  { key: "briefs.manage", area: "marketing", label: { ar: "الرد على طلبات العملاء", en: "Handle client briefs" } },
  { key: "ideas.manage", area: "marketing", label: { ar: "إدارة الأفكار", en: "Manage ideas" } },
  { key: "campaigns.manage", area: "marketing", label: { ar: "إدارة الحملات والحسابات", en: "Manage campaigns and accounts" } },
  { key: "profitability.view", area: "marketing", label: { ar: "عرض ربحية العملاء", en: "View client profitability" } },

  { key: "agents.view", area: "agents", label: { ar: "فتح الجراب", en: "Open Al Jarab" } },
  { key: "agents.use", area: "agents", label: { ar: "تكليف الوكلاء بمهام", en: "Give agents tasks" } },
  { key: "agents.manage", area: "agents", label: { ar: "إضافة وإيقاف الوكلاء", en: "Add and pause agents" } },

  { key: "analytics.view", area: "analytics", label: { ar: "فتح غرفة التحليلات", en: "Open the Analytics room" } },
  { key: "analytics.departments", area: "analytics", scoped: true, label: { ar: "أرقام الأقسام المجمّعة", en: "Department totals" } },
  { key: "analytics.members", area: "analytics", scoped: true, label: { ar: "تفاصيل كل موظف في التحليلات", en: "Per-person details in analytics" } },

  { key: "company.settings", area: "company", label: { ar: "إعدادات الشركة والمكتب", en: "Company and office settings" } },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];
export const SCOPED_KEYS = new Set<string>(PERMISSIONS.filter((p) => "scoped" in p && p.scoped).map((p) => p.key));

export const AREAS: { area: PermissionArea; label: Localized }[] = [
  { area: "hr", label: { ar: "الموارد البشرية", en: "HR" } },
  { area: "operations", label: { ar: "العمليات", en: "Operations" } },
  { area: "automation", label: { ar: "الأتمتة", en: "Automation" } },
  { area: "sales", label: { ar: "المبيعات", en: "Sales" } },
  { area: "marketing", label: { ar: "التسويق", en: "Marketing" } },
  { area: "agents", label: { ar: "الجراب", en: "Al Jarab" } },
  { area: "analytics", label: { ar: "التحليلات", en: "Analytics" } },
  { area: "company", label: { ar: "الشركة", en: "Company" } },
];

/** Room → the permission that opens it (sidebar items and page guards). */
export const ROOM_VIEW: Record<string, PermissionKey> = {
  hr: "hr.view",
  operations: "operations.view",
  meetings: "operations.view",
  automation: "automation.view",
  sales: "sales.view",
  marketing: "marketing.view",
  agents: "agents.view",
  analytics: "analytics.view",
  clients: "clients.view",
};

/** Default "Employee" role: open every room, add things and use agents; no managing others. */
export const EMPLOYEE_DEFAULTS: PermissionKey[] = [
  "hr.view",
  "operations.view",
  "operations.create",
  "notes.write",
  "tasks.create",
  "automation.view",
  "runs.start",
  "sales.view",
  "orders.create",
  "marketing.view",
  "clients.view",
  "ideas.manage",
  "agents.view",
  "agents.use",
];

