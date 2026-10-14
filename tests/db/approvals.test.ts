/** Approvals (meeting room → «الاعتماد») and files on notes. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as approvals from "../../src/modules/approvals/service";
import * as hq from "../../src/modules/hq/service";
import * as operations from "../../src/modules/operations/service";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@appr.test");
const asker = user("asker@appr.test");
const boss = user("boss@appr.test");
const bystander = user("by@appr.test");
let companyId = "";
const ids: Record<string, string> = {};
const file = (folder = "approvals") => ({ path: `${companyId}/${folder}/abc-photo.jpg`, name: "photo.jpg", size: 1200, type: "image/jpeg" });

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('appr', 'APPR1', ${JSON.stringify(L("Co"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  for (const [who, name] of [
    [asker, "Asker"],
    [boss, "Boss"],
    [bystander, "Bystander"],
  ] as const) {
    ids[name] = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: who.email!, name: L(name) }))).id;
    await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  }
});

test("asking a colleague: with files, not yourself, files only from this company's approvals folder", async () => {
  const req = await t.as(asker, (ctx) =>
    approvals.requestApproval(ctx, { companyId, approverId: ids.Boss, kind: "position", title: "Refund the client", details: "  They were charged twice  ", attachments: [file()] }),
  );
  assert.deepEqual([req.status, req.kind, req.details, req.attachments.length], ["pending", "position", "They were charged twice", 1]);
  await failsWith("invalid", t.as(asker, (ctx) => approvals.requestApproval(ctx, { companyId, approverId: ids.Asker, kind: "action", title: "Me" })));
  await failsWith("invalid", t.as(asker, (ctx) => approvals.requestApproval(ctx, { companyId, approverId: ids.Boss, kind: "action", title: "X", attachments: [file("contracts")] })));
  ids.req = req.id;
});

test("only the two people (and the owner) see it; only the approver decides, once; only the asker cancels", async () => {
  assert.equal((await t.as(bystander, (ctx) => approvals.getApprovalsData(ctx, companyId))).approvals.length, 0);
  assert.equal((await t.as(owner, (ctx) => approvals.getApprovalsData(ctx, companyId))).approvals.length, 1);
  await failsWith("forbidden", t.as(asker, (ctx) => approvals.decideApproval(ctx, { approvalId: ids.req, decision: "approved" })));
  await failsWith("not_found", t.as(bystander, (ctx) => approvals.decideApproval(ctx, { approvalId: ids.req, decision: "approved" })));
  const done = await t.as(boss, (ctx) => approvals.decideApproval(ctx, { approvalId: ids.req, decision: "approved", note: "Go ahead" }));
  assert.deepEqual([done.status, done.decisionNote], ["approved", "Go ahead"]);
  assert.ok(done.decidedAt);
  await failsWith("invalid", t.as(boss, (ctx) => approvals.decideApproval(ctx, { approvalId: ids.req, decision: "rejected" })));
  await failsWith("invalid", t.as(asker, (ctx) => approvals.cancelApproval(ctx, { approvalId: ids.req })));

  const second = await t.as(asker, (ctx) => approvals.requestApproval(ctx, { companyId, approverId: ids.Boss, kind: "action", title: "Buy a camera" }));
  await failsWith("forbidden", t.as(boss, (ctx) => approvals.cancelApproval(ctx, { approvalId: second.id })));
  assert.equal((await t.as(asker, (ctx) => approvals.cancelApproval(ctx, { approvalId: second.id }))).status, "cancelled");
});

test("RLS: no approving your own request, no peeking, no foreign files, also with raw SQL", async () => {
  const req = await t.as(asker, (ctx) => approvals.requestApproval(ctx, { companyId, approverId: ids.Boss, kind: "action", title: "Overtime" }));
  await t.sqlAs(asker.sub, "UPDATE approval_requests SET status = 'approved' WHERE id = $1", [req.id]).catch(() => null);
  const [row] = (await t.pg.query<{ status: string }>("SELECT status FROM approval_requests WHERE id = $1", [req.id])).rows;
  assert.equal(row.status, "pending", "the asker cannot approve it");
  assert.equal((await t.sqlAs(bystander.sub, "SELECT id FROM approval_requests")).length, 0);
  await assert.rejects(
    t.sqlAs(asker.sub, "INSERT INTO approval_requests (company_id, requester_id, approver_id, title, attachments) VALUES ($1, $2, $3, 'X', $4::jsonb)", [
      companyId,
      ids.Asker,
      ids.Boss,
      JSON.stringify([{ path: "other-company/approvals/x.pdf", name: "x.pdf", size: 1, type: "application/pdf" }]),
    ]),
  );
  await assert.rejects(t.sqlAs(bystander.sub, "INSERT INTO approval_requests (company_id, requester_id, approver_id, title) VALUES ($1, $2, $3, 'X')", [companyId, ids.Asker, ids.Boss]));
});

test("notes keep their files; files must be in the company's notes folder", async () => {
  const note = await t.as(owner, (ctx) => operations.createNote(ctx, { companyId, text: "Site photos", audience: { type: "company" }, attachments: [file("notes")] }));
  assert.equal(note.attachments?.[0].name, "photo.jpg");
  await failsWith("invalid", t.as(owner, (ctx) => operations.createNote(ctx, { companyId, text: "X", audience: { type: "company" }, attachments: [file("approvals")] })));
});
