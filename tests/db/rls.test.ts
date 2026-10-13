/** Row Level Security and database rules, checked with raw SQL as different users. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createTestDb, L, user } from "./setup";

const j = (v: unknown) => JSON.stringify(v);
let t: Awaited<ReturnType<typeof createTestDb>>;
const A = user(); // owner of acme
const B = user(); // owner of beta
const E = user(); // employee of acme
const U = user(); // client portal user
let c1: string, c2: string, cl1: string, cl2: string;

before(async () => {
  t = await createTestDb();
  c1 = (await t.sqlAs(A.sub, "SELECT public.create_company('acme','acme1',$1,$2) AS id", [j(L("Acme")), j(L("Ahmed"))]))[0].id as string;
  c2 = (await t.sqlAs(B.sub, "SELECT public.create_company('beta','BETA1',$1,$2) AS id", [j(L("Beta")), j(L("Bassem"))]))[0].id as string;
  await t.sqlAs(A.sub, "INSERT INTO members (company_id,user_id,name) VALUES ($1,$2,$3)", [c1, E.sub, j(L("Eman"))]);
  cl1 = (await t.sqlAs(A.sub, "INSERT INTO clients (company_id,name) VALUES ($1,$2) RETURNING id", [c1, j(L("Bakery"))]))[0].id as string;
  cl2 = (await t.sqlAs(A.sub, "INSERT INTO clients (company_id,name,invite_code) VALUES ($1,$2,'BAKERY7') RETURNING id", [c1, j(L("Clinic"))]))[0].id as string;
});

test("companies are isolated", async () => {
  await assert.rejects(t.sqlAs(null, "SELECT public.create_company('x','X',$1,$2)", [j(L("x")), j(L("x"))]), "anon cannot create");
  assert.deepEqual(await t.sqlAs(A.sub, "SELECT slug, code FROM companies"), [{ slug: "acme", code: "ACME1" }]);
  await assert.rejects(t.sqlAs(A.sub, "INSERT INTO departments (company_id,name) VALUES ($1,$2)", [c2, j(L("d"))]));
  assert.equal((await t.sqlAs(A.sub, "UPDATE companies SET plan='pro' WHERE id=$1 RETURNING id", [c2])).length, 0);
  assert.equal((await t.sqlAs(B.sub, "SELECT id FROM members WHERE company_id=$1", [c1])).length, 0);
});

test("members: admins manage, employees only their own presence", async () => {
  assert.equal((await t.sqlAs(E.sub, "UPDATE members SET status='busy' WHERE user_id=$1 RETURNING status", [E.sub]))[0].status, "busy");
  await assert.rejects(t.sqlAs(E.sub, "UPDATE members SET role='admin' WHERE user_id=$1", [E.sub]), /owners and admins/);
  await assert.rejects(t.sqlAs(E.sub, "INSERT INTO members (company_id,name) VALUES ($1,$2)", [c1, j(L("x"))]));
  assert.equal((await t.sqlAs(E.sub, "UPDATE members SET status='away' WHERE user_id=$1 RETURNING id", [A.sub])).length, 0);
});

test("document numbers are assigned by the database and never change", async () => {
  const party = "00000000-0000-0000-0000-000000000099";
  const insert = (who: string, company: string, type: string) =>
    t.sqlAs(who, "INSERT INTO orders (company_id,type,party_id,number) VALUES ($1,$2,$3,'ignored') RETURNING number", [company, type, party]);
  const numbers = [];
  for (const type of ["sale", "sale", "purchase"]) numbers.push((await insert(E.sub, c1, type))[0].number);
  numbers.push((await insert(B.sub, c2, "sale"))[0].number);
  assert.deepEqual(numbers, ["SO-1001", "SO-1002", "PO-1001", "SO-1001"]);
  assert.equal((await t.sqlAs(A.sub, "UPDATE orders SET number='HACK' WHERE number='SO-1001' RETURNING number"))[0].number, "SO-1001");

  const op = () => t.sqlAs(E.sub, "INSERT INTO workflow_runs (company_id,subject,code) VALUES ($1,$2,'x') RETURNING code", [c1, j(L("op"))]);
  assert.deepEqual([(await op())[0].code, (await op())[0].code], ["OP-1001", "OP-1002"]);
});

test("client portal users see only their client", async () => {
  await assert.rejects(t.sqlAs(E.sub, "INSERT INTO client_users (client_id,user_id) VALUES ($1,$2)", [cl1, U.sub]), "employees cannot link");
  await t.sqlAs(A.sub, "INSERT INTO client_users (client_id,user_id) VALUES ($1,$2)", [cl1, U.sub]);
  assert.deepEqual(await t.sqlAs(U.sub, "SELECT id FROM clients"), [{ id: cl1 }]);

  const brief = "INSERT INTO briefs (company_id,client_id,type,objective,audience,details) VALUES ($1,$2,'paidAds',$3,$3,$3) RETURNING id";
  assert.equal((await t.sqlAs(U.sub, brief, [c1, cl1, j(L("o"))])).length, 1);
  await assert.rejects(t.sqlAs(U.sub, brief, [c1, cl2, j(L("o"))]), "other client");
  await assert.rejects(t.sqlAs(U.sub, brief, [c2, cl1, j(L("o"))]), "other company");
  assert.equal((await t.sqlAs(U.sub, "SELECT id FROM departments")).length, 0);
  assert.equal((await t.sqlAs(E.sub, "SELECT id FROM briefs")).length, 1);
  assert.equal((await t.sqlAs(A.sub, "SELECT id FROM events WHERE type='brief.received'")).length, 1, "brief event logged by trigger");
});

test("events are append-only; progress is per user", async () => {
  await t.sqlAs(A.sub, "INSERT INTO events (company_id,type,source) VALUES ($1,'order.created','user')", [c1]);
  assert.equal((await t.sqlAs(A.sub, "UPDATE events SET severity='critical' RETURNING id")).length, 0);
  assert.equal((await t.sqlAs(A.sub, "DELETE FROM events RETURNING id")).length, 0);
  await t.sqlAs(E.sub, "INSERT INTO lesson_progress (user_id,lesson_id) VALUES ($1,'l1')", [E.sub]);
  assert.equal((await t.sqlAs(A.sub, "SELECT * FROM lesson_progress")).length, 0);
  await assert.rejects(t.sqlAs(E.sub, "INSERT INTO lesson_progress (user_id,lesson_id) VALUES ($1,'l1')", [A.sub]));
});

test("auth functions: company code, invites, client invite codes", async () => {
  assert.equal((await t.sqlAs(E.sub, "SELECT public.company_slug_for_code(' acme1 ') AS s"))[0].s, "acme");
  assert.equal((await t.sqlAs(E.sub, "SELECT public.company_slug_for_code('BETA1') AS s"))[0].s, null);

  const N = user("New@Example.com");
  await t.sqlAs(A.sub, "INSERT INTO members (company_id,email,name) VALUES ($1,'new@example.com',$2)", [c1, j(L("Newbie"))]);
  assert.equal((await t.sqlAs(N.sub, "SELECT public.claim_invites() AS n", [], N.email))[0].n, 1);
  assert.deepEqual(await t.sqlAs(N.sub, "SELECT slug FROM companies", [], N.email), [{ slug: "acme" }]);
  assert.equal((await t.sqlAs(N.sub, "SELECT public.claim_invites() AS n", [], N.email))[0].n, 0);

  assert.deepEqual(await t.sqlAs(null, "SELECT public.invite_exists('bakery7') AS ok, public.invite_exists('nope') AS bad"), [{ ok: true, bad: false }]);
  await assert.rejects(t.sqlAs(null, "SELECT public.redeem_client_invite('BAKERY7')"));
  const V = user();
  await t.sqlAs(V.sub, "SELECT public.redeem_client_invite(' bakery7 ')");
  assert.deepEqual(await t.sqlAs(V.sub, "SELECT id FROM clients"), [{ id: cl2 }]);
});

test("advisor rules: no SECURITY DEFINER in public, fixed search_path, briefs stay inside the client's company", async () => {
  const definers = await t.pg.query<{ proname: string }>(
    "SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef",
  );
  assert.deepEqual(definers.rows, [], "public functions are SECURITY INVOKER wrappers");
  const mutable = await t.pg.query<{ proname: string }>(
    "SELECT proname FROM pg_proc WHERE pronamespace IN ('public'::regnamespace, 'private'::regnamespace) AND prokind = 'f' AND NOT coalesce(proconfig::text LIKE '%search_path%', false)",
  );
  assert.deepEqual(mutable.rows, [], "every function pins search_path");

  // B's company has its own client; A (member of acme) cannot file a brief for it under acme
  const betaClient = (await t.sqlAs(B.sub, "INSERT INTO clients (company_id,name) VALUES ($1,$2) RETURNING id", [c2, j(L("Beta client"))]))[0].id;
  const brief = "INSERT INTO briefs (company_id,client_id,type,objective,audience,details) VALUES ($1,$2,'paidAds',$3,$3,$3) RETURNING id";
  await assert.rejects(t.sqlAs(A.sub, brief, [c1, betaClient, j(L("x"))]));
  assert.equal((await t.sqlAs(B.sub, brief, [c2, betaClient, j(L("x"))])).length, 1);
});

test("self-service profile: own name/title yes; department, email, others' names no", async () => {
  const renamed = await t.sqlAs(E.sub, "UPDATE members SET name = $1, title = $2 WHERE user_id = $3 RETURNING name->>'en' AS n", [j(L("Eman Ali")), j(L("Designer")), E.sub]);
  assert.equal(renamed[0].n, "Eman Ali");
  const dept = (await t.sqlAs(A.sub, "INSERT INTO departments (company_id,name) VALUES ($1,$2) RETURNING id", [c1, j(L("Design"))]))[0].id;
  await assert.rejects(t.sqlAs(E.sub, "UPDATE members SET department_id = $1 WHERE user_id = $2", [dept, E.sub]), /owners and admins/);
  await assert.rejects(t.sqlAs(E.sub, "UPDATE members SET email = 'me@x.test' WHERE user_id = $1", [E.sub]), /owners and admins/);
  assert.equal((await t.sqlAs(E.sub, "UPDATE members SET name = $1 WHERE user_id = $2 RETURNING id", [j(L("Hacked")), A.sub])).length, 0, "RLS hides other rows from employees");
  assert.equal((await t.sqlAs(A.sub, "UPDATE members SET department_id = $1 WHERE user_id = $2 RETURNING id", [dept, E.sub])).length, 1, "owners still assign departments");
});

test("Clerk user ids (text, not uuid) work everywhere: company, invites, portal, own rows", async () => {
  const owner = "user_2pQ8kZ3vXyOwnerClerkId";
  const staff = "user_2pQ8kZ3vXyStaffClerkId";
  const sql1 = (uid: string, q: string, p: unknown[] = [], email = "") => t.sqlAs(uid, q, p, email);
  const cid = (await sql1(owner, "SELECT public.create_company('clerk-co','CLERK1',$1,$2) AS id", [j(L("Clerk Co")), j(L("Boss"))], "boss@clerk.test"))[0].id;
  assert.deepEqual(await sql1(owner, "SELECT role, user_id, email FROM members WHERE company_id = $1", [cid]), [{ role: "owner", user_id: owner, email: "boss@clerk.test" }]);

  await sql1(owner, "INSERT INTO members (company_id,email,name) VALUES ($1,'staff@clerk.test',$2)", [cid, j(L("Staff"))]);
  assert.equal((await sql1(staff, "SELECT public.claim_invites() AS n", [], "Staff@Clerk.test"))[0].n, 1);
  assert.equal((await sql1(staff, "SELECT public.company_slug_for_code('clerk1') AS s"))[0].s, "clerk-co");
  await assert.rejects(sql1(staff, "UPDATE members SET role='admin' WHERE user_id = $1", [staff]), /owners and admins/);
  await sql1(staff, "INSERT INTO lesson_progress (user_id, lesson_id) VALUES ($1, 'l9')", [staff]);
  await assert.rejects(sql1(staff, "INSERT INTO lesson_progress (user_id, lesson_id) VALUES ($1, 'l9')", [owner]));
  assert.equal((await sql1("user_2outsider", "SELECT id FROM companies WHERE id = $1", [cid])).length, 0);
});
