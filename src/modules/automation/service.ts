import { and, asc, count, desc, eq, gte, isNotNull, sql, sum } from "drizzle-orm";
import { automationFlows, events, members, workflowRuns, workflows, type Localized, type WorkflowAttachment } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { requirePermission } from "@/server/permissions";
import { assertWithinPlan } from "@/server/plans";
import { emitEvent } from "@/modules/events/service";
import { applyRunAction, workflowTemplates, type Workflow, type WorkflowRun } from "./workflows";
import { templates as flowTemplates, type AutomationFlow } from "./mock";

type WorkflowRow = typeof workflows.$inferSelect;
type RunRow = typeof workflowRuns.$inferSelect;

/** Attachments carry a storage path; the UI asks for a signed URL (src/server/storage.ts) to open one. */
export function toWorkflow(r: WorkflowRow): Workflow & { attachments: (WorkflowAttachment & { url: string })[] } {
  return {
    id: r.id,
    name: r.name,
    steps: r.steps,
    attachments: r.attachments.map((a) => ({ ...a, url: a.path })),
  };
}

export function toRun(r: RunRow): WorkflowRun & {
  code: string;
  category: string;
  nature: RunRow["nature"];
  ownerId: string | null;
  createdAt: string;
} {
  return {
    id: r.id,
    workflowId: r.workflowId ?? "",
    subject: r.subject,
    currentStep: r.currentStep,
    status: r.status,
    history: r.history,
    code: r.code,
    category: r.category,
    nature: r.nature,
    ownerId: r.ownerId,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Company of a row (updates and deletes check the permission against it). */
async function companyOfRow(ctx: Ctx, table: typeof workflows | typeof automationFlows, id: string) {
  const [row] = await ctx.tx.select({ companyId: table.companyId }).from(table).where(eq(table.id, id));
  return found(row).companyId;
}

// ---------- Workflows ----------

export async function listWorkflows(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(workflows).where(eq(workflows.companyId, companyId)).orderBy(asc(workflows.createdAt));
  return rows.map(toWorkflow);
}

type StepInput = { title: Localized; assigneeId: string };

export async function createWorkflow(
  ctx: Ctx,
  input: { companyId: string; name: Localized; steps: StepInput[]; attachments?: WorkflowAttachment[] },
) {
  await requirePermission(ctx, input.companyId, "workflows.manage");
  await assertWithinPlan(ctx, input.companyId, "workflows");
  const [row] = await ctx.tx
    .insert(workflows)
    .values({
      companyId: input.companyId,
      name: input.name,
      steps: input.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
      attachments: input.attachments ?? [],
    })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "workflow.created", payload: { workflowId: row.id } });
  return toWorkflow(row);
}

/** Copies a ready-made template; `assigneeIds` gives the member for each template step, in order. */
export async function createWorkflowFromTemplate(ctx: Ctx, input: { companyId: string; templateId: string; assigneeIds: string[] }) {
  const template = workflowTemplates.find((t) => t.id === input.templateId);
  if (!template || input.assigneeIds.length !== template.steps.length) throw new AppError("invalid");
  return createWorkflow(ctx, {
    companyId: input.companyId,
    name: template.name,
    steps: template.steps.map((s, i) => ({ title: s.title, assigneeId: input.assigneeIds[i] })),
  });
}

export async function updateWorkflow(
  ctx: Ctx,
  input: { workflowId: string; name?: Localized; steps?: (StepInput & { id?: string })[]; attachments?: WorkflowAttachment[] },
) {
  await requirePermission(ctx, await companyOfRow(ctx, workflows, input.workflowId), "workflows.manage");
  const [row] = await ctx.tx
    .update(workflows)
    .set({
      name: input.name,
      steps: input.steps?.map((s) => ({ ...s, id: s.id ?? crypto.randomUUID() })),
      attachments: input.attachments,
    })
    .where(eq(workflows.id, input.workflowId))
    .returning();
  return toWorkflow(found(row));
}

export async function deleteWorkflow(ctx: Ctx, input: { workflowId: string }) {
  await requirePermission(ctx, await companyOfRow(ctx, workflows, input.workflowId), "workflows.manage");
  const deleted = await ctx.tx.delete(workflows).where(eq(workflows.id, input.workflowId)).returning({ id: workflows.id });
  found(deleted[0]);
}

// ---------- Runs (operations) ----------

/** Every operation of the company, newest first (Operations room). */
export async function listOperations(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(workflowRuns).where(eq(workflowRuns.companyId, companyId)).orderBy(desc(workflowRuns.createdAt));
  return rows.map(toRun);
}

/** Runs of approval workflows only (Automation room). */
export async function listRuns(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.companyId, companyId), isNotNull(workflowRuns.workflowId)))
    .orderBy(desc(workflowRuns.createdAt));
  return rows.map(toRun);
}

/**
 * Starts an operation. With a workflow it enters its approval steps (the starter completes step 0,
 * like the frontend demo) and needs runs.start; without one it is a standalone task (operations.create).
 * Counts toward the plan's monthly operations. `internal`: started by another service that already
 * checked its own permission (an order's approval run).
 */
export async function startOperation(
  ctx: Ctx,
  input: { companyId: string; subject: Localized; category?: string; nature?: RunRow["nature"]; workflowId?: string | null },
  options: { countsTowardPlan?: boolean; internal?: boolean } = {},
) {
  const me = await requireMember(ctx, input.companyId);
  if (!options.internal) await requirePermission(ctx, input.companyId, input.workflowId ? "runs.start" : "operations.create");
  if (options.countsTowardPlan !== false) await assertWithinPlan(ctx, input.companyId, "operationsPerMonth");
  const now = new Date().toISOString();
  const history: RunRow["history"] = [{ action: "started", stepIndex: 0, byId: me.id, at: now }];

  let currentStep = 0;
  let status: RunRow["status"] = "in_progress";
  if (input.workflowId) {
    const [workflow] = await ctx.tx.select().from(workflows).where(eq(workflows.id, input.workflowId));
    const steps = found(workflow).steps;
    if (steps.length === 0) throw new AppError("invalid");
    history.push({ action: "approved", stepIndex: 0, byId: me.id, at: now });
    if (steps.length === 1) status = "completed";
    else currentStep = 1;
  }

  const [row] = await ctx.tx
    .insert(workflowRuns)
    .values({
      companyId: input.companyId,
      code: "", // assigned by the database (OP-####)
      workflowId: input.workflowId ?? null,
      category: input.category ?? "operations",
      nature: input.nature ?? "human",
      ownerId: me.id,
      subject: input.subject,
      currentStep,
      status,
      history,
    })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "operation.started", payload: { runId: row.id, code: row.code } });
  return toRun(row);
}

/** Approve / reject / request changes. Only the member assigned to the current step may act. */
export async function actOnRun(ctx: Ctx, input: { runId: string; action: "approve" | "reject" | "request_changes"; note?: string }) {
  const [row] = await ctx.tx.select().from(workflowRuns).where(eq(workflowRuns.id, input.runId));
  const run = found(row);
  if (!run.workflowId || run.status === "completed" || run.status === "closed") throw new AppError("invalid");
  const me = await requireMember(ctx, run.companyId);
  const [workflowRow] = await ctx.tx.select().from(workflows).where(eq(workflows.id, run.workflowId));
  const workflow = toWorkflow(found(workflowRow));

  // While changes are requested the run waits on step 0 (the requester); otherwise on the step's assignee.
  const assignee = workflow.steps[run.currentStep]?.assigneeId;
  const requester = run.history.find((h) => h.action === "started")?.byId;
  const allowed = run.status === "changes_requested" ? me.id === requester || me.id === assignee : me.id === assignee;
  if (!allowed) throw new AppError("forbidden");

  const next = applyRunAction(toRun(run), workflow, input.action, me.id, input.note);
  const [updated] = await ctx.tx
    .update(workflowRuns)
    .set({ currentStep: next.currentStep, status: next.status, history: next.history })
    .where(eq(workflowRuns.id, run.id))
    .returning();
  // An order waiting on this run follows its outcome (imported lazily: sales imports this module)
  const { syncOrderWithRun } = await import("@/modules/sales/service");
  await syncOrderWithRun(ctx, { id: run.id, status: next.status });
  await emitEvent(ctx, run.companyId, {
    type: `operation.${next.status === "completed" ? "completed" : input.action}`,
    payload: { runId: run.id, code: run.code, step: run.currentStep },
  });
  return toRun(found(updated));
}

// ---------- Automated flows ----------

type FlowRow = typeof automationFlows.$inferSelect;

const DAY = 86_400_000;

/** "من ٣ ساعات" / "3 hours ago": the short relative time the flow cards show. */
function relativeTime(at: Date | null, now = Date.now()): Localized {
  if (!at) return { ar: "لسه ما اشتغلش", en: "Not run yet" };
  const minutes = Math.max(0, Math.round((now - at.getTime()) / 60_000));
  if (minutes < 1) return { ar: "الآن", en: "Just now" };
  if (minutes < 60) return { ar: `من ${minutes} دقيقة`, en: `${minutes} min ago` };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { ar: `من ${hours} ساعة`, en: `${hours} h ago` };
  if (now - at.getTime() < 2 * DAY) return { ar: "أمس", en: "Yesterday" };
  const days = Math.round((now - at.getTime()) / DAY);
  return { ar: `من ${days} يوم`, en: `${days} days ago` };
}

export function toFlow(r: FlowRow): AutomationFlow & { triggerEvent: string | null; templateId: string | null; lastRunAt: string | null } {
  return {
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    condition: r.condition ?? undefined,
    action: r.action,
    runs: r.runs,
    lastRun: relativeTime(r.lastRunAt),
    enabled: r.enabled,
    triggerEvent: r.triggerEvent,
    templateId: r.templateId,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
  };
}

export async function listFlows(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(automationFlows).where(eq(automationFlows.companyId, companyId)).orderBy(desc(automationFlows.createdAt));
  return rows.map(toFlow);
}

export async function createFlow(
  ctx: Ctx,
  input: { companyId: string; name: Localized; trigger: Localized; condition?: Localized | null; action: Localized; triggerEvent?: string | null; enabled?: boolean },
) {
  await requirePermission(ctx, input.companyId, "flows.manage");
  const [row] = await ctx.tx.insert(automationFlows).values(input).returning();
  await emitEvent(ctx, input.companyId, { type: "automation.flow_created", payload: { flowId: row.id } });
  return toFlow(row);
}

/** Template trigger → event the engine listens to, where one exists today. */
const TEMPLATE_EVENTS: Record<string, string> = { t1: "member.invited" };

export async function createFlowFromTemplate(ctx: Ctx, input: { companyId: string; templateId: string }) {
  const template = flowTemplates.find((t) => t.id === input.templateId);
  if (!template) throw new AppError("not_found");
  const flow = await createFlow(ctx, {
    companyId: input.companyId,
    name: template.name,
    trigger: template.trigger,
    action: template.action,
    triggerEvent: TEMPLATE_EVENTS[template.id] ?? null,
  });
  const [row] = await ctx.tx.update(automationFlows).set({ templateId: template.id }).where(eq(automationFlows.id, flow.id)).returning();
  return toFlow(row);
}

export async function updateFlow(
  ctx: Ctx,
  input: { flowId: string; name?: Localized; trigger?: Localized; condition?: Localized | null; action?: Localized; triggerEvent?: string | null; enabled?: boolean },
) {
  const { flowId, ...patch } = input;
  await requirePermission(ctx, await companyOfRow(ctx, automationFlows, flowId), "flows.manage");
  const [row] = await ctx.tx.update(automationFlows).set(patch).where(eq(automationFlows.id, flowId)).returning();
  return toFlow(found(row));
}

export async function deleteFlow(ctx: Ctx, input: { flowId: string }) {
  await requirePermission(ctx, await companyOfRow(ctx, automationFlows, input.flowId), "flows.manage");
  const deleted = await ctx.tx.delete(automationFlows).where(eq(automationFlows.id, input.flowId)).returning({ id: automationFlows.id });
  found(deleted[0]);
}

/**
 * Called by the automation engine each time a flow runs: counts the run, stamps the time and logs
 * `automation.flow_ran` (source automation). A disabled flow does not run.
 */
export async function recordFlowRun(ctx: Ctx, input: { flowId: string; result?: string }) {
  const [current] = await ctx.tx.select().from(automationFlows).where(eq(automationFlows.id, input.flowId));
  if (!found(current).enabled) throw new AppError("invalid");
  const [row] = await ctx.tx
    .update(automationFlows)
    .set({ runs: current.runs + 1, lastRunAt: new Date() })
    .where(eq(automationFlows.id, input.flowId))
    .returning();
  await emitEvent(ctx, row.companyId, { type: "automation.flow_ran", source: "automation", payload: { flowId: row.id, result: input.result } });
  return toFlow(row);
}

/** Minutes a person would have spent on one run by hand; an estimate used for "hours saved". */
export const MINUTES_SAVED_PER_RUN = 5;

/**
 * Header figures of the Automation room (replaces `automationStats` in mock.ts):
 * automationRate = share of the last 30 days' operations that ran without a person (0–100);
 * perWeek = automation events in the last 7 days; hoursSaved = all flow runs × MINUTES_SAVED_PER_RUN.
 */
export async function getAutomationStats(ctx: Ctx, companyId: string) {
  await requireMember(ctx, companyId);
  const now = Date.now();
  const [ops] = await ctx.tx
    .select({ total: count(), automated: sum(sql`case when ${workflowRuns.nature} <> 'human' then 1 else 0 end`) })
    .from(workflowRuns)
    .where(and(eq(workflowRuns.companyId, companyId), gte(workflowRuns.createdAt, new Date(now - 30 * DAY))));
  const [week] = await ctx.tx
    .select({ n: count() })
    .from(events)
    .where(and(eq(events.companyId, companyId), eq(events.source, "automation"), gte(events.createdAt, new Date(now - 7 * DAY))));
  const [runs] = await ctx.tx.select({ n: sum(automationFlows.runs) }).from(automationFlows).where(eq(automationFlows.companyId, companyId));
  const total = Number(ops?.total ?? 0);
  return {
    automationRate: total ? Math.round((Number(ops.automated ?? 0) / total) * 1000) / 10 : 0,
    perWeek: Number(week?.n ?? 0),
    hoursSaved: Math.round((Number(runs?.n ?? 0) * MINUTES_SAVED_PER_RUN) / 60),
  };
}

// ---------- The room ----------

export type AutomationData = {
  meId: string;
  people: { id: string; name: Localized; title: Localized | null }[];
  workflows: Workflow[];
  runs: WorkflowRun[];
  flows: AutomationFlow[];
  stats: { automationRate: number; perWeek: number; hoursSaved: number };
};

/** The Automation room of a real company: approval workflows and their runs, automated flows, header figures. */
export async function getAutomationData(ctx: Ctx, companyId: string): Promise<AutomationData> {
  const me = await requireMember(ctx, companyId);
  const [people, workflowList, runs, flows, stats] = await Promise.all([
    ctx.tx.select({ id: members.id, name: members.name, title: members.title }).from(members).where(eq(members.companyId, companyId)).orderBy(asc(members.createdAt)),
    listWorkflows(ctx, companyId),
    listRuns(ctx, companyId),
    listFlows(ctx, companyId),
    getAutomationStats(ctx, companyId),
  ]);
  return { meId: me.id, people: people.map((p) => ({ ...p, title: p.title ?? null })), workflows: workflowList, runs, flows, stats };
}
