import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { clients, meetings, members, notes, tasks, workflowRuns, type NoteAudience } from "@/db/schema";
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

/** A client set on a task must belong to the same company (client work counts toward its profitability). */
async function assertClientOf(ctx: Ctx, companyId: string, clientId: string) {
  const [c] = await ctx.tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));
  if (!c) throw new AppError("invalid");
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
  input: {
    companyId: string;
    title: string;
    assigneeId?: string | null;
    dueDate?: string | null;
    priority?: TaskPriority;
    operationId?: string | null;
    /** Client work: the client, the kind of work (profitability TASK_TYPES) and an optional timer */
    clientId?: string | null;
    taskType?: string | null;
    trackedMinutes?: number | null;
  },
) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "tasks.create");
  const assigneeId = input.assigneeId ?? me.id;
  await assertMemberOf(ctx, input.companyId, assigneeId);
  if (input.clientId) await assertClientOf(ctx, input.companyId, input.clientId);
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
  input: {
    taskId: string;
    title?: string;
    assigneeId?: string | null;
    dueDate?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    clientId?: string | null;
    taskType?: string | null;
    trackedMinutes?: number | null;
  },
) {
  const [current] = await ctx.tx.select().from(tasks).where(eq(tasks.id, input.taskId));
  const task = found(current);
  await requireTaskAccess(ctx, task, input.assigneeId);
  if (input.assigneeId) await assertMemberOf(ctx, task.companyId, input.assigneeId);
  if (input.clientId) await assertClientOf(ctx, task.companyId, input.clientId);
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

// ---------- Schedule (Operations room → «الجدولة») ----------

type ScheduleRow = typeof meetings.$inferSelect;
export type ScheduleKind = ScheduleRow["kind"];
export type ScheduleStatus = ScheduleRow["status"];

type ScheduleFields = {
  kind?: ScheduleKind;
  title?: string;
  /** ISO date-time with offset */
  startsAt?: string;
  durationMinutes?: number;
  location?: string | null;
  attendeeIds?: string[];
  clientId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactRole?: string | null;
  purpose?: string | null;
  transport?: string | null;
  notes?: string | null;
};

function toScheduleItem(r: ScheduleRow) {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    durationMinutes: r.durationMinutes,
    location: r.location,
    organizerId: r.organizerId,
    attendeeIds: r.attendeeIds,
    clientId: r.clientId,
    contact: r.contactName ? { name: r.contactName, phone: r.contactPhone, role: r.contactRole } : null,
    purpose: r.purpose,
    transport: r.transport,
    notes: r.notes,
  };
}

/** Attendees must be members of the company, and a client must be one of its clients. */
async function assertScheduleRefs(ctx: Ctx, companyId: string, input: ScheduleFields) {
  const ids = [...new Set(input.attendeeIds ?? [])];
  if (ids.length) {
    const rows = await ctx.tx.select({ id: members.id }).from(members).where(and(eq(members.companyId, companyId), inArray(members.id, ids)));
    if (rows.length !== ids.length) throw new AppError("invalid");
  }
  if (input.clientId) await assertClientOf(ctx, companyId, input.clientId);
}

/** Everything scheduled between `from` and `to` (ISO), earliest first. Optionally only one member's (organizer or attendee). */
export async function listSchedule(ctx: Ctx, companyId: string, range: { from: string; to: string; memberId?: string }) {
  await requireMember(ctx, companyId);
  const rows = await ctx.tx
    .select()
    .from(meetings)
    .where(and(eq(meetings.companyId, companyId), gte(meetings.startsAt, new Date(range.from)), lt(meetings.startsAt, new Date(range.to))))
    .orderBy(asc(meetings.startsAt));
  const list = rows.map(toScheduleItem);
  return range.memberId ? list.filter((i) => i.organizerId === range.memberId || i.attendeeIds.includes(range.memberId!)) : list;
}

/** Any member adds to the company schedule; they become its organizer. */
export async function createScheduleItem(ctx: Ctx, input: { companyId: string; kind: ScheduleKind; title: string; startsAt: string; durationMinutes: number } & ScheduleFields) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "operations.view");
  await assertScheduleRefs(ctx, input.companyId, input);
  const { companyId, startsAt, attendeeIds, ...rest } = input;
  const [row] = await ctx.tx
    .insert(meetings)
    .values({ ...rest, companyId, startsAt: new Date(startsAt), attendeeIds: [...new Set(attendeeIds ?? [])].filter((id) => id !== me.id), organizerId: me.id })
    .returning();
  await emitEvent(ctx, companyId, { type: "schedule.created", payload: { itemId: row.id, kind: row.kind, startsAt: row.startsAt.toISOString() } });
  return toScheduleItem(row);
}

/** The organizer changes their own items; anyone else needs tasks.manage for the organizer's department. */
async function requireScheduleAccess(ctx: Ctx, item: ScheduleRow) {
  const me = await requireMember(ctx, item.companyId);
  if (item.organizerId !== me.id) await requirePermission(ctx, item.companyId, "tasks.manage", await departmentOf(ctx, item.organizerId));
}

export async function updateScheduleItem(ctx: Ctx, input: { itemId: string; status?: ScheduleStatus } & ScheduleFields) {
  const [current] = await ctx.tx.select().from(meetings).where(eq(meetings.id, input.itemId));
  const item = found(current);
  await requireScheduleAccess(ctx, item);
  await assertScheduleRefs(ctx, item.companyId, input);
  const { itemId, startsAt, ...rest } = input;
  const [row] = await ctx.tx
    .update(meetings)
    .set({ ...rest, ...(startsAt !== undefined && { startsAt: new Date(startsAt) }) })
    .where(eq(meetings.id, itemId))
    .returning();
  if (input.status && input.status !== item.status) {
    await emitEvent(ctx, item.companyId, { type: `schedule.${input.status}`, payload: { itemId } });
  }
  return toScheduleItem(found(row));
}

export async function deleteScheduleItem(ctx: Ctx, input: { itemId: string }) {
  const [current] = await ctx.tx.select().from(meetings).where(eq(meetings.id, input.itemId));
  const item = found(current);
  await requireScheduleAccess(ctx, item);
  await ctx.tx.delete(meetings).where(eq(meetings.id, item.id));
}
