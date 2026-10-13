import { and, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { clients, freelancerPayments, invoices, meetings, profitabilitySettings, tasks } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { requirePermission } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import {
  computeProfitability,
  DEFAULT_REVISION_MINUTES,
  DEFAULT_STANDARD_MINUTES,
  monthRange,
  TASK_TYPES,
  type Month,
  type ProfitSettings,
} from "./calc";

const EMPTY = { ar: "", en: "" };
const today = () => new Date().toISOString().slice(0, 10);

/** Owner only (cost settings are the agency's own numbers). */
async function requireOwner(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  if (me.role !== "owner") throw new AppError("forbidden");
}

async function companyOfClient(ctx: Ctx, clientId: string) {
  const [row] = await ctx.tx.select({ companyId: clients.companyId }).from(clients).where(eq(clients.id, clientId));
  return found(row).companyId;
}

// ---------- Settings ----------

/** The company's settings, or the defaults (with zero costs, so the report says "insufficient data" until set). */
export async function getProfitabilitySettings(ctx: Ctx, companyId: string): Promise<ProfitSettings & { saved: boolean }> {
  await requirePermission(ctx, companyId, "profitability.view");
  const [row] = await ctx.tx.select().from(profitabilitySettings).where(eq(profitabilitySettings.companyId, companyId));
  if (!row) {
    return { standardMinutes: { ...DEFAULT_STANDARD_MINUTES }, revisionMinutes: DEFAULT_REVISION_MINUTES, monthlySalaries: 0, monthlyRent: 0, monthlyTools: 0, monthlyHours: 0, saved: false };
  }
  return {
    standardMinutes: { ...DEFAULT_STANDARD_MINUTES, ...row.standardMinutes },
    revisionMinutes: row.revisionMinutes,
    monthlySalaries: row.monthlySalaries,
    monthlyRent: row.monthlyRent,
    monthlyTools: row.monthlyTools,
    monthlyHours: row.monthlyHours,
    saved: true,
  };
}

export async function saveProfitabilitySettings(ctx: Ctx, input: { companyId: string } & ProfitSettings) {
  await requireOwner(ctx, input.companyId);
  const standardMinutes = Object.fromEntries(
    Object.entries(input.standardMinutes).filter(([type, minutes]) => (TASK_TYPES as readonly string[]).includes(type) && minutes >= 0),
  );
  const values = {
    companyId: input.companyId,
    standardMinutes,
    revisionMinutes: input.revisionMinutes,
    monthlySalaries: input.monthlySalaries,
    monthlyRent: input.monthlyRent,
    monthlyTools: input.monthlyTools,
    monthlyHours: input.monthlyHours,
    updatedAt: new Date(),
  };
  await ctx.tx.insert(profitabilitySettings).values(values).onConflictDoUpdate({ target: profitabilitySettings.companyId, set: values });
  await emitEvent(ctx, input.companyId, { type: "profitability.settings_updated", payload: {} });
}

// ---------- Inputs (minimal: package, meetings, invoices, freelancers) ----------

/** The package in the client's contract: deliverables per month and revisions allowed per deliverable. */
export async function setClientPackage(ctx: Ctx, input: { clientId: string; deliverables: number | null; revisionsPerPost: number | null }) {
  await requirePermission(ctx, await companyOfClient(ctx, input.clientId), "clients.manage");
  const [row] = await ctx.tx
    .update(clients)
    .set({ packageDeliverables: input.deliverables, packageRevisionsPerPost: input.revisionsPerPost })
    .where(eq(clients.id, input.clientId))
    .returning();
  return { id: found(row).id, packageDeliverables: row.packageDeliverables, packageRevisionsPerPost: row.packageRevisionsPerPost };
}

/** A meeting in the calendar, optionally linked to a client (its time counts toward that client). */
export async function createMeeting(ctx: Ctx, input: { companyId: string; clientId?: string | null; title: string; startsAt: string; durationMinutes: number }) {
  await requireMember(ctx, input.companyId);
  if (input.clientId && (await companyOfClient(ctx, input.clientId)) !== input.companyId) throw new AppError("not_found");
  const [row] = await ctx.tx
    .insert(meetings)
    .values({ ...input, clientId: input.clientId ?? null, startsAt: new Date(input.startsAt) })
    .returning();
  return row;
}

export async function createInvoice(ctx: Ctx, input: { clientId: string; period: Month; amount: number; issuedOn: string; dueOn: string; paidOn?: string | null }) {
  const companyId = await companyOfClient(ctx, input.clientId);
  await requirePermission(ctx, companyId, "profitability.view");
  if (input.dueOn < input.issuedOn) throw new AppError("invalid");
  const [row] = await ctx.tx
    .insert(invoices)
    .values({ ...input, companyId, period: `${input.period}-01`, paidOn: input.paidOn ?? null })
    .returning();
  return row;
}

export async function markInvoicePaid(ctx: Ctx, input: { invoiceId: string; paidOn: string }) {
  const [current] = await ctx.tx.select({ companyId: invoices.companyId }).from(invoices).where(eq(invoices.id, input.invoiceId));
  await requirePermission(ctx, found(current).companyId, "profitability.view");
  const [row] = await ctx.tx.update(invoices).set({ paidOn: input.paidOn }).where(eq(invoices.id, input.invoiceId)).returning();
  return row;
}

export async function createFreelancerPayment(ctx: Ctx, input: { clientId: string; taskId?: string | null; freelancer: string; amount: number; paidOn: string }) {
  const companyId = await companyOfClient(ctx, input.clientId);
  await requirePermission(ctx, companyId, "profitability.view");
  if (input.taskId) {
    const [task] = await ctx.tx.select({ companyId: tasks.companyId }).from(tasks).where(eq(tasks.id, input.taskId));
    if (found(task).companyId !== companyId) throw new AppError("not_found");
  }
  const [row] = await ctx.tx
    .insert(freelancerPayments)
    .values({ ...input, companyId, taskId: input.taskId ?? null })
    .returning();
  return row;
}

// ---------- The report ----------

/** Profitability of every client for the `count` months ending at `endMonth` (default: this month). */
export async function getProfitabilityReport(ctx: Ctx, companyId: string, options: { endMonth?: Month; count?: number } = {}) {
  await requirePermission(ctx, companyId, "profitability.view");
  const months = monthRange(options.endMonth ?? today().slice(0, 7), options.count ?? 6);
  const from = `${months[0]}-01`;
  const lastMonth = months[months.length - 1];
  const [y, m] = lastMonth.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  // Payment delays look back six months before the first month shown
  const invoicesFrom = `${monthRange(months[0], 6)[0]}-01`;

  const [settings, clientRows, taskRows, meetingRows, invoiceRows, freelancerRows] = await Promise.all([
    getProfitabilitySettings(ctx, companyId),
    ctx.tx.select().from(clients).where(eq(clients.companyId, companyId)),
    ctx.tx
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.companyId, companyId),
          isNotNull(tasks.clientId),
          eq(tasks.status, "done"),
          gte(tasks.completedAt, new Date(`${from}T00:00:00Z`)),
          lte(tasks.completedAt, new Date(`${to}T23:59:59Z`)),
        ),
      ),
    ctx.tx
      .select()
      .from(meetings)
      .where(and(eq(meetings.companyId, companyId), isNotNull(meetings.clientId), ne(meetings.status, "cancelled"), gte(meetings.startsAt, new Date(`${from}T00:00:00Z`)), lte(meetings.startsAt, new Date(`${to}T23:59:59Z`)))),
    ctx.tx.select().from(invoices).where(and(eq(invoices.companyId, companyId), gte(invoices.period, invoicesFrom), lte(invoices.period, to))),
    ctx.tx.select().from(freelancerPayments).where(and(eq(freelancerPayments.companyId, companyId), gte(freelancerPayments.paidOn, from), lte(freelancerPayments.paidOn, to))),
  ]);

  return computeProfitability({
    today: today(),
    months,
    settings: settings.saved ? settings : null,
    clients: clientRows.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.industry ?? EMPTY,
      packageDeliverables: c.packageDeliverables,
      packageRevisionsPerPost: c.packageRevisionsPerPost,
    })),
    tasks: taskRows.map((t) => ({
      clientId: t.clientId!,
      taskType: t.taskType,
      trackedMinutes: t.trackedMinutes,
      revisions: t.revisions,
      completedOn: t.completedAt!.toISOString().slice(0, 10),
    })),
    meetings: meetingRows.map((r) => ({ clientId: r.clientId!, on: r.startsAt.toISOString().slice(0, 10), minutes: r.durationMinutes })),
    invoices: invoiceRows.map((i) => ({ clientId: i.clientId, period: i.period.slice(0, 7), amount: i.amount, dueOn: i.dueOn, paidOn: i.paidOn })),
    freelancers: freelancerRows.map((f) => ({ clientId: f.clientId, paidOn: f.paidOn, amount: f.amount })),
  });
}
