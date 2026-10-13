/**
 * Loads the frontend demo data (src/modules/<feature>/mock.ts) into a "demo" company, so the backend
 * can be tried with the same content the screens show today. Runs as the database owner (no RLS).
 * Mock ids ("m1", "c1", ...) become new uuids; the mapping is kept so references stay intact.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/server/context";
import * as s from "./schema";
import * as hq from "@/modules/hq/mock";
import { accounts as mockAccounts, campaigns as mockCampaigns, channels as mockChannels, clients as mockClients } from "@/modules/marketing/sections-mock";
import { briefs as mockBriefs } from "@/modules/marketing/briefs-mock";
import { ideas as mockIdeas } from "@/modules/marketing/mock";
import { suppliers as mockSuppliers, orders as mockOrders } from "@/modules/sales/mock";
import { workflows as mockWorkflows, runs as mockRuns } from "@/modules/automation/workflows";
import { notes as mockNotes } from "@/modules/operations/notes";
import { agents as mockAgents } from "@/modules/agents/mock";

export type SeedOptions = {
  /** Email of the person who should own the demo company; they are linked when they sign in with it. */
  ownerEmail?: string;
  /** Delete an existing demo company first */
  reset?: boolean;
};

export async function seedDemo(database: Db, options: SeedOptions = {}) {
  return database.transaction(async (tx) => {
    const [existing] = await tx.select({ id: s.companies.id }).from(s.companies).where(eq(s.companies.slug, hq.DEMO_COMPANY_SLUG));
    if (existing) {
      if (!options.reset) throw new Error(`Company "${hq.DEMO_COMPANY_SLUG}" already exists. Run with --reset to replace it.`);
      await tx.delete(s.companies).where(eq(s.companies.id, existing.id));
    }

    const ids = new Map<string, string>();
    const map = (mockId: string | undefined) => (mockId ? ids.get(mockId) : undefined);
    const need = (mockId: string) => {
      const id = ids.get(mockId);
      if (!id) throw new Error(`Seed: unknown reference ${mockId}`);
      return id;
    };

    const [company] = await tx
      .insert(s.companies)
      .values({ slug: hq.demoCompany.slug, code: "DEMO01", plan: "pro", name: hq.demoCompany.name, floor: hq.demoCompany.floor })
      .returning();
    const companyId = company.id;

    for (const d of hq.departments) {
      const [row] = await tx.insert(s.departments).values({ companyId, name: d.name, color: d.color }).returning();
      ids.set(d.id, row.id);
    }
    for (const m of hq.members) {
      const isOwner = m.id === hq.currentUserId;
      const [row] = await tx
        .insert(s.members)
        .values({
          companyId,
          email: isOwner ? options.ownerEmail?.toLowerCase() : undefined,
          role: isOwner ? "owner" : "employee",
          name: m.name,
          title: m.title,
          departmentId: map(m.departmentId),
          status: m.status,
          currentTask: m.currentTask,
        })
        .returning();
      ids.set(m.id, row.id);
    }

    for (const r of hq.rooms) {
      const [row] = await tx.insert(s.rooms).values({ companyId, type: r.type, code: r.code, x: r.x, y: r.y, w: r.w, h: r.h }).returning();
      ids.set(r.id, row.id);
    }
    if (hq.furniture.length) {
      await tx.insert(s.furniture).values(
        hq.furniture.map((f) => ({ companyId, roomId: need(f.roomId), kind: f.kind, memberId: map(f.memberId), x: f.x, y: f.y, w: f.w, h: f.h })),
      );
    }
    if (hq.zones.length) {
      await tx
        .insert(s.zones)
        .values(hq.zones.map((z) => ({ companyId, roomId: need(z.roomId), departmentId: need(z.departmentId), x: z.x, y: z.y, w: z.w, h: z.h })));
    }

    const memberByName = (name: s.Localized) => hq.members.find((m) => m.name.ar === name.ar || m.name.en === name.en)?.id;
    for (const c of mockClients) {
      const [row] = await tx
        .insert(s.clients)
        .values({
          companyId,
          name: c.name,
          industry: c.industry,
          managerId: map(memberByName(c.manager)),
          monthlyBudget: c.monthlyBudget,
          status: c.status,
          inviteCode: `DEMO${c.id.toUpperCase()}`,
        })
        .returning();
      ids.set(c.id, row.id);
    }
    for (const b of mockBriefs) {
      const [row] = await tx
        .insert(s.briefs)
        .values({
          companyId,
          clientId: need(b.clientId),
          type: b.type,
          objective: b.objective,
          audience: b.audience,
          details: b.details,
          budget: b.budget,
          deadline: b.deadline || null,
          receivedOn: b.receivedOn,
          status: b.status,
          clientReply: b.clientReply,
        })
        .returning();
      ids.set(b.id, row.id);
    }
    if (mockAccounts.length) {
      await tx.insert(s.socialAccounts).values(
        mockAccounts.map((a) => ({
          companyId,
          clientId: need(a.clientId),
          platform: a.platform,
          handle: a.handle,
          followers: a.followers,
          status: a.status,
          lastPost: a.lastPost,
        })),
      );
    }
    // Per-channel metrics are spread from the demo channel stats, so computed channel stats look like the mock.
    for (const k of mockCampaigns) {
      const metrics: Record<string, s.ChannelMetrics> = {};
      for (const platform of k.channels) {
        const stat = mockChannels.find((c) => c.platform === platform);
        if (!stat || k.spent === 0) continue;
        const spend = Math.round(k.spent / k.channels.length);
        const results = Math.round(spend / stat.costPerResult);
        metrics[platform] = {
          reach: Math.round(stat.reach / stat.campaigns),
          results,
          conversions: Math.round((results * stat.conversion) / 100),
          spend,
        };
      }
      await tx.insert(s.campaigns).values({
        companyId,
        clientId: need(k.clientId),
        name: k.name,
        channels: k.channels,
        stage: k.stage,
        progress: k.progress,
        startDate: k.start || null,
        endDate: k.end || null,
        spent: k.spent,
        metrics,
      });
    }
    if (mockIdeas.length) {
      await tx.insert(s.marketingIdeas).values(
        mockIdeas.map((i) => ({
          companyId,
          stage: i.stage,
          title: i.title,
          format: i.format,
          hook: i.hook,
          message: i.message,
          versions: i.versions ?? [],
          ratings: i.ratings,
          delivery: i.delivery,
        })),
      );
    }

    for (const sup of mockSuppliers) {
      const [row] = await tx.insert(s.suppliers).values({ companyId, name: sup.name, category: sup.category }).returning();
      ids.set(sup.id, row.id);
    }
    // Numbers are reassigned by the database (SO-1001, ...) in the same order as the demo.
    for (const o of [...mockOrders].reverse()) {
      await tx.insert(s.orders).values({
        companyId,
        number: "",
        type: o.type,
        partyId: need(o.partyId),
        items: o.items,
        date: o.date,
        deliveryDate: o.deliveryDate || null,
        status: o.status,
      });
    }

    for (const w of mockWorkflows) {
      const [row] = await tx
        .insert(s.workflows)
        .values({
          companyId,
          name: w.name,
          steps: w.steps.map((step) => ({ ...step, id: crypto.randomUUID(), assigneeId: need(step.assigneeId) })),
          attachments: [],
        })
        .returning();
      ids.set(w.id, row.id);
    }
    for (const r of mockRuns) {
      await tx.insert(s.workflowRuns).values({
        companyId,
        code: "",
        workflowId: need(r.workflowId),
        ownerId: map(r.history[0]?.byId),
        subject: r.subject,
        currentStep: r.currentStep,
        status: r.status,
        history: r.history.map((h) => ({ ...h, byId: need(h.byId) })),
      });
    }

    for (const n of mockNotes) {
      await tx.insert(s.notes).values({
        companyId,
        authorId: map(n.authorId),
        text: n.text,
        operationId: n.operationId,
        pinned: n.pinned,
        createdAt: new Date(n.createdAt),
        audience:
          n.audience.type === "company"
            ? n.audience
            : { type: "custom", departmentIds: n.audience.departmentIds.map(need), memberIds: n.audience.memberIds.map(need) },
      });
    }

    if (mockAgents.length) {
      await tx.insert(s.agents).values(
        mockAgents.map((a) => ({
          companyId,
          kind: a.kind,
          name: a.name,
          role: a.role,
          description: a.description,
          skills: a.skills,
          area: a.area,
          status: a.status,
          tasksDone: a.tasksDone,
          queue: a.queue,
        })),
      );
    }

    return { companyId, slug: company.slug, code: company.code };
  });
}
