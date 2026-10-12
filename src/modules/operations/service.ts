import { and, desc, eq } from "drizzle-orm";
import { members, notes, type NoteAudience } from "@/db/schema";
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
