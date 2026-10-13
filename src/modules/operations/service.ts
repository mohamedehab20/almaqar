import { and, desc, eq, gte } from "drizzle-orm";
import { members, notes, tasks, workflowRuns, type NoteAudience } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { departmentOf, requirePermission } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import { noteConcernsDepartment, type Note } from "./notes";
import type { Task, TaskPriority, TaskStatus } from "./tasks";

type NoteRow = typeof notes.$inferSelect;

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    text: r.text,
    authorId: r.authorId ?? "",
    createdAt: r.createdAt.toISOString(),
    operationId: r.operationId ?? undefined,
    audience: r.audience,
    pinned: r.pinned,
  };
}

/** Pinned first, then newest. With `departmentId`, only notes that concern that department. */
export async function listNotes(ctx: Ctx, companyId: string, departmentId?: string) {
  const rows = await ctx.tx
    .select()
    .from(notes)
    .where(eq(notes.companyId, companyId))
    .orderBy(desc(notes.pinned), desc(notes.createdAt));
  const list = rows.map(toNote);
  if (!departmentId) return list;

  const people = await ctx.tx
    .select({ id: members.id, departmentId: members.departmentId })
    .from(members)
    .where(eq(members.companyId, companyId));
  const departmentOf = (memberId: string) => people.find((p) => p.id === memberId)?.departmentId ?? undefined;
  return list.filter((note) => noteConcernsDepartment(note, departmentId, departmentOf));
}

export async function createNote(ctx: Ctx, input: { companyId: string; text: string; audience: NoteAudience; operationId?: string | null; pinned?: boolean }) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "notes.write");
  const [row] = await ctx.tx
    .insert(notes)
    .values({ ...input, authorId: me.id })
    .returning();
  // The UI notifies the audience from this event (realtime on `events` / `notes`).
  await emitEvent(ctx, input.companyId, { type: "note.created", payload: { noteId: row.id, audience: input.audience } });
  return toNote(row);
}

/** Your own notes need notes.write; someone else's need notes.manage for the author's department. */
async function requireNoteAccess(ctx: Ctx, note: NoteRow) {
  const me = await requireMember(ctx, note.companyId);
  if (note.authorId === me.id) await requirePermission(ctx, note.companyId, "notes.write");
  else await requirePermission(ctx, note.companyId, "notes.manage", await departmentOf(ctx, note.authorId));
}

export async function setNotePinned(ctx: Ctx, input: { noteId: string; pinned: boolean }) {
  const [current] = await ctx.tx.select().from(notes).where(eq(notes.id, input.noteId));
  await requireNoteAccess(ctx, found(current));
  const [row] = await ctx.tx.update(notes).set({ pinned: input.pinned }).where(eq(notes.id, input.noteId)).returning();
  return toNote(found(row));
}

/** The author, or whoever has notes.manage for the author's department, may delete a note. */
export async function deleteNote(ctx: Ctx, input: { noteId: string }) {
  const [row] = await ctx.tx.select().from(notes).where(eq(notes.id, input.noteId));
  const note = found(row);
  await requireNoteAccess(ctx, note);
  await ctx.tx.delete(notes).where(and(eq(notes.id, note.id), eq(notes.companyId, note.companyId)));
}

// ---------- KPIs (Operations room header) ----------

const HOUR = 3_600_000;

/**
 * Figures for the KPI cards and category tabs, computed from the operations (workflow runs) of the
 * last `days` days. Replaces `kpis` and `categoryCounts` in mock.ts.
 */
export async function getOperationsStats(ctx: Ctx, companyId: string, days = 30) {
  await requireMember(ctx, companyId);
  const since = new Date(Date.now() - days * 24 * HOUR);
  const runs = await ctx.tx
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.companyId, companyId), gte(workflowRuns.createdAt, since)));

  const active = runs.filter((r) => r.status === "in_progress" || r.status === "changes_requested");
  const pending = active.filter((r) => r.workflowId !== null);
  const oldestPending = pending.reduce<Date | null>((min, r) => (!min || r.createdAt < min ? r.createdAt : min), null);
  const completed = runs.filter((r) => r.status === "completed");
  const cycleHours = completed.map((r) => {
    const last = r.history.at(-1)?.at;
    return last ? (new Date(last).getTime() - r.createdAt.getTime()) / HOUR : 0;
  });

  const byCategory: Record<string, number> = {};
  for (const r of runs) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

  return {
    periodDays: days,
    total: runs.length,
    activeOperations: active.length,
    pendingApprovals: pending.length,
    oldestPendingHours: oldestPending ? Math.round(((Date.now() - oldestPending.getTime()) / HOUR) * 10) / 10 : null,
    /** Share of operations that ran without a person (automated or auto-completed), 0–100 */
    automationRate: runs.length ? Math.round((runs.filter((r) => r.nature !== "human").length / runs.length) * 1000) / 10 : 0,
    avgCycleHours: cycleHours.length ? Math.round((cycleHours.reduce((a, b) => a + b, 0) / cycleHours.length) * 10) / 10 : null,
    byCategory,
  };
}

// ---------- Tasks (Operations room → task management) ----------

type TaskRow = typeof tasks.$inferSelect;

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    assigneeId: r.assigneeId ?? "",
    createdById: r.createdById ?? "",
    dueDate: r.dueDate ?? undefined,
    priority: r.priority,
    status: r.status,
    operationId: r.operationId ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

/** The assignee must be a member of the same company. */
async function assertMemberOf(ctx: Ctx, companyId: string, memberId: string) {
  const [m] = await ctx.tx.select({ id: members.id }).from(members).where(and(eq(members.id, memberId), eq(members.companyId, companyId)));
  if (!m) throw new AppError("invalid");
}

/** Open tasks first by status order, then newest. With `assigneeId`, only that member's tasks. */
export async function listTasks(ctx: Ctx, companyId: string, assigneeId?: string) {
  const rows = await ctx.tx
    .select()
    .from(tasks)
    .where(assigneeId ? and(eq(tasks.companyId, companyId), eq(tasks.assigneeId, assigneeId)) : eq(tasks.companyId, companyId))
    .orderBy(desc(tasks.createdAt));
  return rows.map(toTask);
}

export async function createTask(
  ctx: Ctx,
  input: { companyId: string; title: string; assigneeId?: string | null; dueDate?: string | null; priority?: TaskPriority; operationId?: string | null },
) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "tasks.create");
  const assigneeId = input.assigneeId ?? me.id;
  await assertMemberOf(ctx, input.companyId, assigneeId);
  const [row] = await ctx.tx
    .insert(tasks)
    .values({ ...input, assigneeId, createdById: me.id })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "task.created", payload: { taskId: row.id, assigneeId } });
  return toTask(row);
}

/**
 * The creator and the assignee may work on their own task. Anyone else needs tasks.manage for the
 * assignee's department (and for the new assignee's department when reassigning).
 */
async function requireTaskAccess(ctx: Ctx, task: TaskRow, newAssigneeId?: string | null) {
  const me = await requireMember(ctx, task.companyId);
  const own = task.createdById === me.id || task.assigneeId === me.id;
  if (!own) await requirePermission(ctx, task.companyId, "tasks.manage", await departmentOf(ctx, task.assigneeId));
  if (newAssigneeId && newAssigneeId !== task.assigneeId && newAssigneeId !== me.id && !own) {
    await requirePermission(ctx, task.companyId, "tasks.manage", await departmentOf(ctx, newAssigneeId));
  }
}

export async function updateTask(
  ctx: Ctx,
  input: { taskId: string; title?: string; assigneeId?: string | null; dueDate?: string | null; priority?: TaskPriority; status?: TaskStatus },
) {
  const [current] = await ctx.tx.select().from(tasks).where(eq(tasks.id, input.taskId));
  const task = found(current);
  await requireTaskAccess(ctx, task, input.assigneeId);
  if (input.assigneeId) await assertMemberOf(ctx, task.companyId, input.assigneeId);
  const { taskId, ...patch } = input;
  const completedAt = input.status === undefined ? undefined : input.status === "done" ? new Date() : null;
  const [row] = await ctx.tx
    .update(tasks)
    .set({ ...patch, completedAt })
    .where(eq(tasks.id, taskId))
    .returning();
  if (input.status === "done" && task.status !== "done") {
    await emitEvent(ctx, task.companyId, { type: "task.completed", payload: { taskId } });
  }
  return toTask(found(row));
}

/** The creator, the assignee, or whoever has tasks.manage for the assignee's department may delete a task. */
export async function deleteTask(ctx: Ctx, input: { taskId: string }) {
  const [row] = await ctx.tx.select().from(tasks).where(eq(tasks.id, input.taskId));
  const task = found(row);
  await requireTaskAccess(ctx, task);
  await ctx.tx.delete(tasks).where(eq(tasks.id, task.id));
}
