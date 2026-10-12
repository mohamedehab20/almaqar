// npm run db:simulate -- <out.sql>
// A simulated working day: real services, each call as a real user with RLS (PGlite with all migrations).
// Prints every step, then writes an SQL script that copies the resulting "simulation" company into another
// database (run it with the Supabase MCP execute_sql tool or the SQL editor).
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { createTestDb } from "../tests/db/setup";
import * as hq from "../src/modules/hq/service";
import * as marketing from "../src/modules/marketing/service";
import * as automation from "../src/modules/automation/service";
import * as operations from "../src/modules/operations/service";
import * as sales from "../src/modules/sales/service";
import * as events from "../src/modules/events/service";
import * as agents from "../src/modules/agents/service";
import * as academy from "../src/modules/academy/service";

const out = process.argv[2];
const t = await createTestDb();
const person = (n: number, email: string) => ({ sub: `5a5a5a5a-0000-4000-8000-${String(n).padStart(12, "0")}`, email });
const owner = person(1, "owner@simulation.almaqr.test");
const sara = person(2, "sara@simulation.almaqr.test"); // purchasing employee
const karim = person(3, "karim@simulation.almaqr.test"); // operations manager
const client = person(4, "client@bakery.test"); // client portal user
const step = (s: string) => console.log("✓", s);

// 08:00 — the owner signs up and the company is created
const companyId = await t.as(owner, async ({ tx }) => {
  const r = await tx.execute(sql`select public.create_company('simulation', 'SIM001', ${JSON.stringify({ ar: "شركة المحاكاة", en: "Simulation Co." })}::jsonb, ${JSON.stringify({ ar: "أحمد المالك", en: "Ahmed Owner" })}::jsonb) as id`);
  return (r as unknown as { rows: { id: string }[] }).rows[0].id;
});
await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
step("company 'simulation' created by its owner (code SIM001)");

const purchasing = await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: { ar: "المشتريات", en: "Purchasing" }, color: "amber" }));
const ops = await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: { ar: "العمليات", en: "Operations" }, color: "blue" }));
await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: sara.email, name: { ar: "سارة يوسف", en: "Sara Youssef" }, title: { ar: "أخصائية مشتريات", en: "Purchasing specialist" }, departmentId: purchasing.id }));
await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: karim.email, name: { ar: "كريم عادل", en: "Karim Adel" }, title: { ar: "مدير العمليات", en: "Operations manager" }, departmentId: ops.id, role: "admin" }));
step("2 departments, 2 employees invited");

// 08:30 — employees sign in for the first time: invites are linked, presence set
for (const who of [sara, karim]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
const saraM = (await t.as(sara, (ctx) => hq.setMyStatus(ctx, { companyId, status: "available" })));
const karimM = (await t.as(karim, (ctx) => hq.setMyStatus(ctx, { companyId, status: "meeting", currentTask: { ar: "اجتماع الصباح", en: "Morning stand-up" } })));
step("Sara and Karim signed in; invites claimed; presence updated");

// 09:00 — purchase approval workflow
const wf = await t.as(owner, (ctx) => automation.createWorkflow(ctx, {
  companyId,
  name: { ar: "اعتماد المشتريات", en: "Purchase approval" },
  steps: [
    { title: { ar: "طلب الشراء", en: "Purchase request" }, assigneeId: saraM.id },
    { title: { ar: "موافقة مدير العمليات", en: "Operations manager approval" }, assigneeId: karimM.id },
  ],
}));
step("workflow 'Purchase approval' (Sara → Karim)");

// 09:30 — Sara orders laptops; the order waits for Karim
const supplier = await t.as(sara, (ctx) => sales.createSupplier(ctx, { companyId, name: { ar: "تقنية المستقبل", en: "Future Tech" }, category: { ar: "أجهزة", en: "Hardware" } }));
const po = await t.as(sara, (ctx) => sales.createOrder(ctx, { companyId, type: "purchase", partyId: supplier.id, items: [{ name: "Laptop", qty: 3, unitPrice: 32000 }], workflowId: wf.id }));
step(`purchase order ${po.number} pending, approval run started`);

// 11:00 — Karim approves → the order is approved automatically
await t.as(karim, (ctx) => automation.actOnRun(ctx, { runId: po.runId!, action: "approve", note: "Approved within budget" }));
step(`Karim approved → ${po.number} is ${(await t.as(owner, (ctx) => sales.listOrders(ctx, companyId))).find((o) => o.id === po.id)?.status}`);

// 12:00 — a client is onboarded and sends a brief from the portal
const bakery = await t.as(owner, (ctx) => marketing.createClient(ctx, { companyId, name: { ar: "مخبز الصباح", en: "Morning Bakery" }, managerId: karimM.id, monthlyBudget: 18000, status: "active" }));
await t.as(client, ({ tx }) => tx.execute(sql`select public.redeem_client_invite(${bakery.inviteCode})`));
const brief = await t.as(client, (ctx) => marketing.sendBrief(ctx, { clientId: bakery.id, type: "paidAds", objective: { ar: "زيادة الطلبات في رمضان", en: "More orders in Ramadan" }, audience: { ar: "العائلات", en: "Families" }, details: { ar: "عرض الإفطار", en: "Iftar offer" }, budget: 15000, deadline: "2026-11-01" }));
step(`client 'Morning Bakery' joined the portal (code ${bakery.inviteCode}) and sent a brief`);

// 13:00 — the team asks for clarification, the client replies, the idea goes to the bank
await t.as(karim, (ctx) => marketing.setBriefStatus(ctx, { briefId: brief.id, status: "clarification" }));
await t.as(client, (ctx) => marketing.replyToBrief(ctx, { briefId: brief.id, reply: "Budget is firm, start next week" }));
await t.as(karim, (ctx) => marketing.setBriefStatus(ctx, { briefId: brief.id, status: "received" }));
await t.as(karim, (ctx) => marketing.createIdea(ctx, { companyId, title: { ar: "ريل عدّاد الإفطار", en: "Iftar countdown reel" }, briefId: brief.id }));
step("brief: clarification → client reply → received → idea in the bank");

// 14:00 — notes, an agent task, a lesson
await t.as(karim, (ctx) => operations.createNote(ctx, { companyId, text: "جرد المخزن يوم الخميس", audience: { type: "company" }, pinned: true }));
const agent = await t.as(owner, (ctx) => agents.createAgent(ctx, { companyId, kind: "general", name: { ar: "رفيق", en: "Rafeeq" }, role: { ar: "مساعد عام", en: "General assistant" } }));
await t.as(sara, (ctx) => agents.queueTask(ctx, { agentId: agent.id, task: "لخّص طلبات الشراء الأسبوع ده" }));
await t.as(sara, (ctx) => academy.setLessonDone(ctx, { lessonId: "owner-1-1", done: true }));
step("pinned note, agent task queued, lesson completed");

// 16:00 — a standalone operation
const op = await t.as(sara, (ctx) => automation.startOperation(ctx, { companyId, subject: { ar: "صيانة التكييف", en: "AC maintenance" }, category: "maintenance", nature: "human" }));
step(`operation ${op.code} started`);

// End of day — what the owner sees
const log = await t.as(owner, (ctx) => events.listEvents(ctx, companyId));
console.log(`\nactivity log (${log.length} events): ${log.map((e) => e.type).reverse().join(" → ")}`);

// ---- export to SQL ----
const tables = [
  "companies", "departments", "members", "clients", "client_users", "briefs", "marketing_ideas", "suppliers",
  "workflows", "workflow_runs", "orders", "notes", "agents", "events",
];
const parts: string[] = ["BEGIN;"];
for (const table of tables) {
  const where =
    table === "companies" ? "id = $1"
    : table === "client_users" ? "client_id IN (SELECT id FROM clients WHERE company_id = $1)"
    : table === "events" ? "company_id = $1 AND type <> 'brief.received'" // recreated by the trigger on import
    : "company_id = $1";
  const order = ["orders", "workflow_runs", "briefs", "notes", "events"].includes(table) ? " ORDER BY created_at, ctid" : "";
  const { rows } = await t.pg.query<{ j: unknown }>(`SELECT coalesce(json_agg(to_json(exported_row)), '[]') AS j FROM (SELECT * FROM ${table} WHERE ${where}${order}) exported_row`, [companyId]);
  parts.push(`INSERT INTO public.${table} SELECT * FROM json_populate_recordset(NULL::public.${table}, '${JSON.stringify(rows[0].j).replace(/'/g, "''")}'::json);`);
}
const { rows: progress } = await t.pg.query<{ j: unknown }>(`SELECT coalesce(json_agg(to_json(p)), '[]') AS j FROM lesson_progress p WHERE user_id = ANY($1)`, [[owner.sub, sara.sub, karim.sub, client.sub]]);
parts.push(`INSERT INTO public.lesson_progress SELECT * FROM json_populate_recordset(NULL::public.lesson_progress, '${JSON.stringify(progress[0].j).replace(/'/g, "''")}'::json);`);
parts.push("COMMIT;");
writeFileSync(out, parts.join("\n"));
console.log(`\nexported company ${companyId} → ${out}`);
