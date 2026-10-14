import { desc, eq } from "drizzle-orm";
import { approvalRequests, type StoredFile } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { emitEvent } from "@/modules/events/service";
import { assertMemberInCompany, listMembers } from "@/modules/hq/service";

export type ApprovalKind = "action" | "position";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

/** A stored file plus, when the page was built on the server, a short-lived link to open it. */
export type ApprovalFile = StoredFile & { url?: string };

export type Approval = {
  id: string;
  requesterId: string;
  approverId: string;
  kind: ApprovalKind;
  title: string;
  details: string | null;
  dueOn: string | null;
  attachments: ApprovalFile[];
  status: ApprovalStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export const MAX_APPROVAL_FILES = 6;

type Row = typeof approvalRequests.$inferSelect;
const toApproval = (r: Row): Approval => ({
  id: r.id,
  requesterId: r.requesterId,
  approverId: r.approverId,
  kind: r.kind,
  title: r.title,
  details: r.details,
  dueOn: r.dueOn,
  attachments: r.attachments,
  status: r.status,
  decisionNote: r.decisionNote,
  decidedAt: r.decidedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

const clean = (s: string | null | undefined) => s?.trim() || null;

/** The requests the caller sent or received (all of them for the owner), and the colleagues they can ask. */
export async function getApprovalsData(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  const [rows, team] = await Promise.all([
    ctx.tx.select().from(approvalRequests).where(eq(approvalRequests.companyId, companyId)).orderBy(desc(approvalRequests.createdAt)),
    listMembers(ctx, companyId),
  ]);
  return {
    meId: me.id,
    approvals: rows.map(toApproval),
    members: team.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}

export type ApprovalsData = Awaited<ReturnType<typeof getApprovalsData>>;

/** Ask a colleague to approve an action or a position. Files are uploaded first (folder "approvals"). */
export async function requestApproval(
  ctx: Ctx,
  input: { companyId: string; approverId: string; kind: ApprovalKind; title: string; details?: string | null; dueOn?: string | null; attachments?: StoredFile[] },
) {
  const me = await requireMember(ctx, input.companyId);
  if (input.approverId === me.id) throw new AppError("invalid");
  await assertMemberInCompany(ctx, input.companyId, input.approverId);
  const files = input.attachments ?? [];
  if (files.length > MAX_APPROVAL_FILES || files.some((f) => !f.path.startsWith(`${input.companyId}/approvals/`))) throw new AppError("invalid");
  const [row] = await ctx.tx
    .insert(approvalRequests)
    .values({
      companyId: input.companyId,
      requesterId: me.id,
      approverId: input.approverId,
      kind: input.kind,
      title: input.title.trim(),
      details: clean(input.details),
      dueOn: input.dueOn || null,
      attachments: files,
    })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "approval.requested", payload: { approvalId: row.id, approverId: row.approverId, kind: row.kind } });
  return toApproval(row);
}

/** Only the person asked decides, and only once. */
export async function decideApproval(ctx: Ctx, input: { approvalId: string; decision: "approved" | "rejected"; note?: string | null }) {
  const [current] = await ctx.tx.select().from(approvalRequests).where(eq(approvalRequests.id, input.approvalId));
  const request = found(current);
  const me = await requireMember(ctx, request.companyId);
  if (request.approverId !== me.id) throw new AppError("forbidden");
  if (request.status !== "pending") throw new AppError("invalid");
  const [row] = await ctx.tx
    .update(approvalRequests)
    .set({ status: input.decision, decisionNote: clean(input.note), decidedAt: new Date() })
    .where(eq(approvalRequests.id, request.id))
    .returning();
  await emitEvent(ctx, request.companyId, { type: `approval.${input.decision}`, payload: { approvalId: row.id, requesterId: row.requesterId } });
  return toApproval(row);
}

/** The requester withdraws a request that is still waiting. */
export async function cancelApproval(ctx: Ctx, input: { approvalId: string }) {
  const [current] = await ctx.tx.select().from(approvalRequests).where(eq(approvalRequests.id, input.approvalId));
  const request = found(current);
  const me = await requireMember(ctx, request.companyId);
  if (request.requesterId !== me.id) throw new AppError("forbidden");
  if (request.status !== "pending") throw new AppError("invalid");
  const [row] = await ctx.tx.update(approvalRequests).set({ status: "cancelled" }).where(eq(approvalRequests.id, request.id)).returning();
  return toApproval(row);
}
