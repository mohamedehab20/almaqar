/**
 * Demo data for the Automation page: automated flows (trigger → condition → action) and templates.
 */

type Localized = { ar: string; en: string };

export type AutomationFlow = {
  id: string;
  name: Localized;
  trigger: Localized;
  condition?: Localized;
  action: Localized;
  runs: number;
  lastRun: Localized;
  enabled: boolean;
};

export const automationStats = {
  automationRate: 94.8,
  perWeek: 1420,
  hoursSaved: 312,
};

export const flows: AutomationFlow[] = [
  {
    id: "f1",
    name: { ar: "تصعيد الموافقات المتأخرة", en: "Escalate late approvals" },
    trigger: { ar: "طلب موافقة عدّى عليه ٢٤ ساعة", en: "An approval waits 24 hours" },
    condition: { ar: "الأولوية عالية", en: "Priority is high" },
    action: { ar: "تذكير بالجوال والبريد + تصعيد لمدير الإدارة", en: "SMS + email reminder and escalate to the department head" },
    runs: 128,
    lastRun: { ar: "من ساعة", en: "1 hour ago" },
    enabled: true,
  },
  {
    id: "f2",
    name: { ar: "اعتماد العقود الكبيرة", en: "Large contract approval" },
    trigger: { ar: "إنشاء عقد جديد", en: "A new contract is created" },
    condition: { ar: "القيمة أكبر من 50,000 ر.س", en: "Value above SAR 50,000" },
    action: { ar: "تحويل تلقائي لموافقة المالك", en: "Route to the owner for approval" },
    runs: 42,
    lastRun: { ar: "النهارده ٩:٤٠ ص", en: "Today 9:40 AM" },
    enabled: true,
  },
  {
    id: "f3",
    name: { ar: "تحديث رصيد الإجازات", en: "Update leave balance" },
    trigger: { ar: "اعتماد طلب إجازة", en: "A leave request is approved" },
    action: { ar: "خصم من الرصيد وتحديث جدول المناوبات", en: "Deduct the balance and update the shift schedule" },
    runs: 87,
    lastRun: { ar: "أمس", en: "Yesterday" },
    enabled: true,
  },
  {
    id: "f4",
    name: { ar: "مزامنة الحضور الذكية", en: "Smart attendance sync" },
    trigger: { ar: "كل يوم ١١:٥٩ م", en: "Every day at 11:59 PM" },
    action: { ar: "سحب سجلات البصمة وتحديث الحضور", en: "Pull fingerprint logs and update attendance" },
    runs: 310,
    lastRun: { ar: "أمس ١١:٥٩ م", en: "Yesterday 11:59 PM" },
    enabled: true,
  },
  {
    id: "f5",
    name: { ar: "ملخص الإدارة اليومي", en: "Daily management brief" },
    trigger: { ar: "كل يوم ٨:٠٠ ص", en: "Every day at 8:00 AM" },
    action: { ar: "إرسال ملخص يومي بالذكاء الاصطناعي للمالك", en: "Send an AI daily brief to the owner" },
    runs: 64,
    lastRun: { ar: "من أسبوع", en: "A week ago" },
    enabled: false,
  },
];

export type Template = { id: string; name: Localized; description: Localized; trigger: Localized; action: Localized };

export const templates: Template[] = [
  {
    id: "t1",
    name: { ar: "تهيئة موظف جديد", en: "New employee onboarding" },
    description: { ar: "حساب، مكتب في المقر، ومهام أول أسبوع", en: "Account, a desk in the HQ and first-week tasks" },
    trigger: { ar: "إضافة موظف جديد", en: "A new employee is added" },
    action: { ar: "إنشاء الحساب وتعيين مكتب ومهام أول أسبوع", en: "Create the account, assign a desk and first-week tasks" },
  },
  {
    id: "t2",
    name: { ar: "متابعة الفواتير", en: "Invoice follow-up" },
    description: { ar: "تذكير العميل قبل وبعد ميعاد الاستحقاق", en: "Remind the client before and after the due date" },
    trigger: { ar: "فاتورة قرّب ميعاد استحقاقها", en: "An invoice is close to its due date" },
    action: { ar: "إرسال تذكير للعميل ونسخة للمحاسب", en: "Remind the client and copy the accountant" },
  },
  {
    id: "t3",
    name: { ar: "تصعيد المهام المتأخرة", en: "Overdue task escalation" },
    description: { ar: "إشعار المدير لما مهمة تتأخر", en: "Notify the manager when a task is late" },
    trigger: { ar: "مهمة عدّت موعد تسليمها", en: "A task passes its due date" },
    action: { ar: "إشعار المدير وملخص بالأسباب", en: "Notify the manager with a summary of causes" },
  },
  {
    id: "t4",
    name: { ar: "متابعة العملاء المحتملين", en: "Lead follow-up" },
    description: { ar: "متابعة تلقائية لعميل جديد من المبيعات", en: "Automatic follow-up for new sales leads" },
    trigger: { ar: "تسجيل عميل محتمل جديد", en: "A new lead is registered" },
    action: { ar: "رسالة ترحيب ومهمة متابعة بعد يومين", en: "Welcome message and a follow-up task in 2 days" },
  },
];
