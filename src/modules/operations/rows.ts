/**
 * A saved operation (workflow run) as a row of the Operations table, and the figures behind the Analysis
 * button. Pure, shared by the server (real company) and the demo.
 */
import type { OpsCategory, RowStatus, WorkflowRow } from "./mock";

type Localized = { ar: string; en: string };

export const OPS_CATEGORIES: OpsCategory[] = ["contracts", "purchasing", "finance", "maintenance", "operations", "sales"];

export const CATEGORY_LABELS: Record<OpsCategory, Localized> = {
  contracts: { ar: "العقود", en: "Contracts" },
  purchasing: { ar: "المشتريات", en: "Purchasing" },
  finance: { ar: "المالية", en: "Finance" },
  maintenance: { ar: "الصيانة", en: "Maintenance" },
  operations: { ar: "العمليات", en: "Operations" },
  sales: { ar: "المبيعات", en: "Sales" },
};

export type RunForRow = {
  id: string;
  code: string;
  category: string;
  nature: "human" | "automated" | "autoCompleted";
  status: "in_progress" | "changes_requested" | "completed" | "closed";
  subject: Localized;
  ownerId: string | null;
  currentStep: number;
  /** The run's workflow steps (null: a standalone operation without approvals) */
  steps: { title: Localized; assigneeId: string }[] | null;
};

export type Person = { id: string; name: Localized; title: Localized | null };

const SYSTEM: Localized = { ar: "النظام", en: "System" };

export function runToRow(run: RunForRow, people: Person[]): WorkflowRow {
  const person = (id: string | null) => people.find((p) => p.id === id);
  const owner = person(run.ownerId);
  const category = (OPS_CATEGORIES as string[]).includes(run.category) ? (run.category as OpsCategory) : "operations";
  const steps = run.steps ?? [];
  const current = steps[run.currentStep];
  const at = person(current?.assigneeId ?? null);

  let step: WorkflowRow["step"];
  if (run.status === "completed") step = { title: { ar: "اكتملت", en: "Completed" }, by: steps.length ? { ar: "كل الموافقات تمت", en: "All approvals given" } : { ar: "خلصت", en: "Finished" }, tone: "muted" };
  else if (run.status === "closed") step = { title: { ar: "اتقفلت", en: "Closed" }, by: { ar: "من غير ما تكمل", en: "Without finishing" }, tone: "muted" };
  else if (run.status === "changes_requested") step = { title: { ar: "مطلوب تعديل", en: "Changes requested" }, by: owner ? { ar: `عند ${owner.name.ar}`, en: `With ${owner.name.en}` } : SYSTEM, tone: "danger" };
  else if (current) step = { title: current.title, by: at ? { ar: `عند ${at.name.ar}`, en: `With ${at.name.en}` } : { ar: "مستني موافقة", en: "Waiting for approval" }, tone: "info" };
  else step = { title: { ar: "شغالة", en: "In progress" }, by: owner ? owner.name : SYSTEM, tone: "info" };

  const status: RowStatus =
    run.status === "completed" || run.status === "closed" ? "done" : run.status === "changes_requested" ? "review" : steps.length ? "pending" : "processing";

  return {
    id: run.id,
    code: run.code,
    category,
    title: run.subject,
    categoryLabel: CATEGORY_LABELS[category],
    owner: owner ? { name: owner.name, role: owner.title ?? { ar: "", en: "" } } : { name: SYSTEM, role: { ar: "", en: "" }, bot: true },
    step,
    nature: run.nature,
    deciders: steps.length ? steps.map((s) => (person(s.assigneeId)?.name.ar ?? "?").charAt(0)) : { ar: "بدون موافقات", en: "No approvals" },
    status,
  };
}

/** The Analysis cards. `trend`, `previousHours` and `saved` exist only in the demo (no history to compare yet). */
export type OpsKpis = {
  active: number;
  total: number;
  pending: number;
  oldest: { hours: number; minutes: number } | null;
  cycleHours: number | null;
  periodDays: number;
  trend?: string;
  previousHours?: number;
  saved?: number;
};
