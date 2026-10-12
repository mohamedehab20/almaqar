import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { workflowRuns, workflows, type Localized, type WorkflowAttachment } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { assertWithinPlan } from "@/server/plans";
import { emitEvent } from "@/modules/events/service";
import { applyRunAction, workflowTemplates, type Workflow, type WorkflowRun } from "./workflows";

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
  await requireMember(ctx, input.companyId);
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
 * like the frontend demo); without one it is a standalone task. Counts toward the plan's monthly operations.
 */
export async function startOperation(
  ctx: Ctx,
  input: { companyId: string; subject: Localized; category?: string; nature?: RunRow["nature"]; workflowId?: string | null },
) {
  const me = await requireMember(ctx, input.companyId);
  await assertWithinPlan(ctx, input.companyId, "operationsPerMonth");
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
  await emitEvent(ctx, run.companyId, {
    type: `operation.${next.status === "completed" ? "completed" : input.action}`,
    payload: { runId: run.id, code: run.code, step: run.currentStep },
  });
  return toRun(found(updated));
}
