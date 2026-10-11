/** Al Maqr Academy ("the compass"): learning tracks and courses — demo content until the backend exists. */

type Localized = { ar: string; en: string };

export type Track = "owner" | "employee" | "client";
export type Level = "beginner" | "intermediate" | "advanced";

export type Lesson = { id: string; title: Localized; minutes: number };

export type Course = {
  id: string;
  track: Track;
  level: Level;
  title: Localized;
  description: Localized;
  lessons: Lesson[];
};

export type Guide = { id: string; title: Localized; description: Localized; href: string };

const lesson = (id: string, ar: string, en: string, minutes: number): Lesson => ({ id, title: { ar, en }, minutes });

export const courses: Course[] = [
  {
    id: "c-setup",
    track: "owner",
    level: "beginner",
    title: { ar: "أسّس مقرّك في ٣٠ دقيقة", en: "Set up your HQ in 30 minutes" },
    description: {
      ar: "من إنشاء الحساب لحد ما فريقك كله يدخل القاعة الرئيسية.",
      en: "From creating the account to your whole team entering the main hall.",
    },
    lessons: [
      lesson("setup-1", "إنشاء الحساب وبيانات الشركة", "Create the account and company profile", 6),
      lesson("setup-2", "إضافة الأقسام وتقسيم مساحة العمل", "Add departments and divide the workspace", 8),
      lesson("setup-3", "دعوة الموظفين وتحديد الصلاحيات", "Invite employees and set permissions", 9),
      lesson("setup-4", "تخصيص القاعة الرئيسية", "Customize the main hall", 7),
    ],
  },
  {
    id: "c-automation",
    track: "owner",
    level: "intermediate",
    title: { ar: "الأتمتة ومسارات العمل", en: "Automation and workflows" },
    description: {
      ar: "صمّم مسارات موافقات تنقل الشغل من موظف للتاني لوحدها.",
      en: "Design approval flows that move work from one employee to the next on their own.",
    },
    lessons: [
      lesson("auto-1", "يعني إيه مسار عمل؟", "What is a workflow?", 5),
      lesson("auto-2", "تصميم مسار بالموافقة والرفض وطلب التعديل", "Designing a flow with approve, reject and request changes", 12),
      lesson("auto-3", "القوالب الجاهزة: مسار عمليات المبيعات", "Ready templates: the sales operations flow", 8),
      lesson("auto-4", "المرفقات ومتابعة كل خطوة", "Attachments and tracking every step", 7),
    ],
  },
  {
    id: "c-agents",
    track: "owner",
    level: "advanced",
    title: { ar: "الجراب: شغّل وكلاء الذكاء الاصطناعي", en: "Al Jarab: putting AI agents to work" },
    description: {
      ar: "امتى تستخدم وكيل لأي مهمة وامتى تروح للمتخصص، وإزاي تكتب مهمة واضحة.",
      en: "When to use a general agent versus a specialist, and how to write a clear task.",
    },
    lessons: [
      lesson("agents-1", "الوكيل العام والوكيل المتخصص", "General versus specialist agents", 6),
      lesson("agents-2", "إزاي تكتب مهمة الوكيل يفهمها", "Writing a task the agent understands", 10),
      lesson("agents-3", "متابعة الطابور وإيقاف الوكلاء", "Watching the queue and pausing agents", 5),
    ],
  },
  {
    id: "c-day",
    track: "employee",
    level: "beginner",
    title: { ar: "يومك في المقر", en: "Your day at Al Maqr" },
    description: {
      ar: "ادخل مكتبك، غيّر حالتك، واعرف تلاقي زمايلك وأقسامك فين.",
      en: "Enter your office, set your status, and find your colleagues and departments.",
    },
    lessons: [
      lesson("day-1", "دخول الموظف ومكتبك الافتراضي", "Employee login and your virtual office", 4),
      lesson("day-2", "حالتك: متاح، اجتماع، استراحة", "Your status: available, meeting, break", 3),
      lesson("day-3", "التنقل بين القاعة والأقسام", "Moving between the hall and departments", 5),
    ],
  },
  {
    id: "c-ops",
    track: "employee",
    level: "intermediate",
    title: { ar: "غرفة العمليات خطوة بخطوة", en: "The operations room step by step" },
    description: {
      ar: "أضف عملية، وافق أو اطلب تعديل، وابعت ملاحظة لقسم أو لزميل.",
      en: "Add an operation, approve or request changes, and send a note to a department or colleague.",
    },
    lessons: [
      lesson("ops-1", "إضافة عملية جديدة", "Adding a new operation", 5),
      lesson("ops-2", "الموافقة والرفض وطلب التعديل", "Approve, reject and request changes", 7),
      lesson("ops-3", "الملاحظات: لكل الشركة أو لأقسام وموظفين", "Notes: to the whole company or to departments and employees", 6),
      lesson("ops-4", "قراءة التحليل", "Reading the analysis", 6),
    ],
  },
  {
    id: "c-sales",
    track: "employee",
    level: "intermediate",
    title: { ar: "أوامر البيع والشراء", en: "Sale and purchase orders" },
    description: {
      ar: "اعمل أمر بيع لعميل أو أمر شراء من مورد وتابعه لحد التنفيذ.",
      en: "Create a sale order for a client or a purchase order from a supplier and follow it to fulfilment.",
    },
    lessons: [
      lesson("sales-1", "أمر بيع جديد", "A new sale order", 6),
      lesson("sales-2", "أمر شراء من مورد", "A purchase order from a supplier", 6),
      lesson("sales-3", "حالات الأمر من المسودة للتنفيذ", "Order states from draft to fulfilled", 4),
    ],
  },
  {
    id: "c-portal",
    track: "client",
    level: "beginner",
    title: { ar: "بوابة العميل", en: "The client portal" },
    description: {
      ar: "ادخل بكود الدعوة، سلّم البريف، وتابع حملاتك وردّ عليها.",
      en: "Sign in with your invite code, hand in your brief, and follow and reply to your campaigns.",
    },
    lessons: [
      lesson("portal-1", "الدخول بكود الدعوة ورقم الموبايل", "Signing in with an invite code and phone", 3),
      lesson("portal-2", "إزاي تكتب بريف واضح", "How to write a clear brief", 8),
      lesson("portal-3", "متابعة الحملات والرد على الفريق", "Following campaigns and replying to the team", 5),
    ],
  },
];

/** Short hands-on guides that open the matching room in the demo company. */
export const guides: Guide[] = [
  {
    id: "g-workflow",
    title: { ar: "صمّم أول مسار عمل", en: "Design your first workflow" },
    description: { ar: "في غرفة الأتمتة", en: "In the automation room" },
    href: "/c/demo/automation",
  },
  {
    id: "g-note",
    title: { ar: "ابعت ملاحظة لقسم", en: "Send a note to a department" },
    description: { ar: "في غرفة العمليات", en: "In the operations room" },
    href: "/c/demo/operations",
  },
  {
    id: "g-agent",
    title: { ar: "كلّف وكيل بمهمة", en: "Give an agent a task" },
    description: { ar: "في الجراب", en: "In Al Jarab" },
    href: "/c/demo/agents",
  },
];

export const courseMinutes = (course: Course) => course.lessons.reduce((sum, l) => sum + l.minutes, 0);
