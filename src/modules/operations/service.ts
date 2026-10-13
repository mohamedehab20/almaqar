import { and, desc, eq, gte } from "drizzle-orm";
import { members, notes, workflowRuns, type NoteAudience } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { emitEvent } from "@/modules/events/service";
import { noteConcernsDepartment, type Note } from "./notes";

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
  const [row] = await ctx.tx
    .insert(notes)
    .values({ ...input, authorId: me.id })
    .returning();
  // The UI notifies the audience from this event (realtime on `events` / `notes`).
  await emitEvent(ctx, input.companyId, { type: "note.created", payload: { noteId: row.id, audience: input.audience } });
  return toNote(row);
}

export async function setNotePinned(ctx: Ctx, input: { noteId: string; pinned: boolean }) {
  const [row] = await ctx.tx.update(notes).set({ pinned: input.pinned }).where(eq(notes.id, input.noteId)).returning();
  return toNote(found(row));
}

/** The author or an owner/admin may delete a note. */
export async function deleteNote(ctx: Ctx, input: { noteId: string }) {
  const [row] = await ctx.tx.select().from(notes).where(eq(notes.id, input.noteId));
  const note = found(row);
  const me = await requireMember(ctx, note.companyId);
  if (note.authorId !== me.id && me.role === "employee") throw new AppError("forbidden");
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
