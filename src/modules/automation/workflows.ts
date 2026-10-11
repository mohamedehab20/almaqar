/**
 * Approval workflows: a workflow is an ordered chain of steps, each owned by one employee.
 * A run (one request going through a workflow) moves like this:
 *   approve         → next step (next employee); after the last step the run is completed
 *   reject          → back to the previous step (previous employee); at the first step it is closed
 *   request changes → back to the first step (the requester) to edit and resubmit
 *
 * Demo data until the backend exists. Employees come from the HQ member list.
 */

type Localized = { ar: string; en: string };

export type WorkflowStep = { id: string; title: Localized; assigneeId: string };

/** A file attached to a workflow (policy, form template, reference photo…). */
export type WorkflowAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Local preview URL until files are uploaded to storage */
  url: string;
};

export type Workflow = { id: string; name: Localized; steps: WorkflowStep[]; attachments?: WorkflowAttachment[] };

export type RunStatus = "in_progress" | "changes_requested" | "completed" | "closed";

export type RunAction = "started" | "approved" | "rejected" | "changes_requested" | "resubmitted";

export type RunHistoryEntry = { action: RunAction; stepIndex: number; byId: string; at: string; note?: string };

export type WorkflowRun = {
  id: string;
  workflowId: string;
  subject: Localized;
  currentStep: number;
  status: RunStatus;
  history: RunHistoryEntry[];
};

const step = (id: string, ar: string, en: string, assigneeId: string): WorkflowStep => ({ id, title: { ar, en }, assigneeId });

export const workflows: Workflow[] = [
  {
    id: "wf-purchase",
    name: { ar: "مسار الشراء", en: "Purchase flow" },
    steps: [
      step("p1", "طلب الشراء والمواصفات", "Purchase request & specs", "m2"),
      step("p2", "مراجعة الميزانية", "Budget review", "m7"),
      step("p3", "اعتماد المالك", "Owner approval", "m1"),
      step("p4", "إصدار أمر الشراء للمورد", "Issue PO to supplier", "m2"),
      step("p5", "استلام البضاعة", "Goods receipt", "m6"),
      step("p6", "الدفع والأرشفة", "Payment & archive", "m7"),
    ],
  },
  {
    id: "wf-sale",
    name: { ar: "مسار البيع", en: "Sales flow" },
    steps: [
      step("s1", "عرض السعر", "Quotation", "m5"),
      step("s2", "موافقة العميل", "Client acceptance", "m5"),
      step("s3", "اعتماد الإدارة", "Management approval", "m1"),
      step("s4", "التنفيذ والتسليم", "Delivery", "m2"),
      step("s5", "إصدار الفاتورة", "Invoicing", "m7"),
      step("s6", "التحصيل", "Collection", "m7"),
    ],
  },
  {
    id: "wf-leave",
    name: { ar: "مسار طلب إجازة", en: "Leave request flow" },
    steps: [
      step("l1", "تقديم الطلب", "Submit request", "m4"),
      step("l2", "موافقة المدير المباشر", "Line manager approval", "m2"),
      step("l3", "اعتماد الموارد البشرية", "HR approval", "m6"),
    ],
  },
];

export const runs: WorkflowRun[] = [
  {
    id: "run-1",
    workflowId: "wf-purchase",
    subject: { ar: "PO-2041 — أثاث المكتب الجديد", en: "PO-2041 — New office furniture" },
    currentStep: 2,
    status: "in_progress",
    history: [
      { action: "started", stepIndex: 0, byId: "m2", at: "2026-10-08T09:10:00" },
      { action: "approved", stepIndex: 0, byId: "m2", at: "2026-10-08T09:12:00" },
      { action: "approved", stepIndex: 1, byId: "m7", at: "2026-10-08T13:40:00" },
    ],
  },
  {
    id: "run-2",
    workflowId: "wf-sale",
    subject: { ar: "SO-1022 — مخبز الصباح", en: "SO-1022 — Morning Bakery" },
    currentStep: 2,
    status: "in_progress",
    history: [
      { action: "started", stepIndex: 0, byId: "m5", at: "2026-10-09T10:00:00" },
      { action: "approved", stepIndex: 0, byId: "m5", at: "2026-10-09T10:05:00" },
      { action: "approved", stepIndex: 1, byId: "m5", at: "2026-10-09T16:20:00" },
    ],
  },
  {
    id: "run-3",
    workflowId: "wf-leave",
    subject: { ar: "إجازة سارة يوسف — ٣ أيام", en: "Sara Youssef leave — 3 days" },
    currentStep: 1,
    status: "in_progress",
    history: [
      { action: "started", stepIndex: 0, byId: "m4", at: "2026-10-10T08:30:00" },
      { action: "approved", stepIndex: 0, byId: "m4", at: "2026-10-10T08:31:00" },
    ],
  },
];

/** Apply an action by `byId` to a run. Returns a new run; the input is not changed. */
export function applyRunAction(
  run: WorkflowRun,
  workflow: Workflow,
  action: "approve" | "reject" | "request_changes",
  byId: string,
  note?: string,
): WorkflowRun {
  const last = workflow.steps.length - 1;
  const now = new Date().toISOString();
  const entry = (a: RunAction, stepIndex = run.currentStep): RunHistoryEntry => ({ action: a, stepIndex, byId, at: now, note });

  if (action === "approve") {
    const resubmit = run.status === "changes_requested";
    if (run.currentStep >= last) {
      return { ...run, status: "completed", history: [...run.history, entry("approved")] };
    }
    return {
      ...run,
      currentStep: run.currentStep + 1,
      status: "in_progress",
      history: [...run.history, entry(resubmit ? "resubmitted" : "approved")],
    };
  }

  if (action === "reject") {
    if (run.currentStep === 0) return { ...run, status: "closed", history: [...run.history, entry("rejected")] };
    return { ...run, currentStep: run.currentStep - 1, status: "in_progress", history: [...run.history, entry("rejected")] };
  }

  // request_changes: back to the requester (first step) to edit and resubmit
  return { ...run, currentStep: 0, status: "changes_requested", history: [...run.history, entry("changes_requested")] };
}
