# 08 — Backend completion tasks

What is left of the approved backend plan, split into small tasks for **two engineers** working in parallel:
- **Engineer A** owns the database and infrastructure.
- **Engineer B** owns application logic and tests.

Update the status column when a task lands, and record the change in [04-milestones.md](04-milestones.md) in the same commit.

Status: ✅ done · 🔄 in progress · ⏳ waiting on something · ⬜ not started

## Phase 1 — Database live on Supabase (no password needed)

| # | Task | Owner | Depends on | Status | Done when |
|---|---|---|---|---|---|
| A1 | Apply migrations 0000–0003 to the Supabase project (`rosifnxvdpwkvpqzguzj`) through the Supabase MCP, and record them in Drizzle's `drizzle.__drizzle_migrations` so `npm run db:migrate` skips them later | A | — | ✅ | 18 tables, policies, functions, bucket and publication exist on the project |
| A2 | Run the Supabase security and performance advisors; fix the findings in a new migration | A | A1 | ✅ | Advisors show no errors; any remaining warnings are explained here |
| A3 | Smoke test on the real database: RLS scenarios run inside a transaction that is rolled back (nothing is left behind), plus checks on storage policies and the realtime publication | A | A1 | ✅ | Every scenario passes on Supabase, same as on PGlite |
| B1 | Orders → approval workflow: an order can point at an approval workflow. Making it `pending` starts the run, and finishing the run approves the order (or cancels it if the run is closed). | B | — | ✅ | Covered in `tests/db/services.test.ts`; new migration applied |
| B2 | Unit tests for the action layer: Zod input schemas and the mapping of Postgres and auth errors to error codes | B | — | ✅ | `npm run test:db` includes them and passes |

## Phase 2 — Running on Supabase (needs `DATABASE_URL` in `.env.local`)

| # | Task | Owner | Depends on | Status | Done when |
|---|---|---|---|---|---|
| A4 | Demo data on Supabase (`demo` company, owner = product owner's email) | A | — | ✅ | `demo` company is visible in the dashboard |
| A6 | Simulated working day through the real services, saved to Supabase as company `simulation` | A | A4 | ✅ | Every step's data is on Supabase and checked |
| A5 | Check `withUser` over the transaction pooler (port 6543): role switch and RLS inside a pooled transaction | A | `DATABASE_URL` | ⏳ | A real query as a test user returns only that user's rows |
| B3 | Manual end-to-end auth check against Supabase: sign-up with email confirmation, company-code login, visitor email OTP | B | A4 | ⏳ | Each flow reaches its page; results recorded here |
| B4 | Vercel: add env vars (`NEXT_PUBLIC_*` now; `DATABASE_URL` and `SUPABASE_SECRET_KEY` as Sensitive after A5). Set Supabase Auth Site URL and redirect URLs to the Vercel domain. | B | A5, Vercel login | ⏳ | Production can sign in |

## Phase 3 — Backend for the screens that still have no data source

| # | Task | Owner | Depends on | Status | Done when |
|---|---|---|---|---|---|
| C1 | Activity feed (main hall) and operations KPIs, computed from `events` and `workflow_runs`. No new tables. | B | — | ✅ | Queries return the shapes the screens use; covered by tests |
| C2 | Marketing sections: tables for social accounts and campaigns (with per-channel metrics); budgets and channel stats computed from them | A | — | ✅ | Migration applied to Supabase, RLS, service + actions, tests, advisors clean |
| C3 | Automated flows (trigger → condition → action): table, CRUD, enable/disable, templates, run counter for the future engine | A | — | ✅ | Same as C2 |
| C4 | Account self-service: password reset (email link), change password, edit own name/title/phone | B | — | ⬜ | Actions + DB guard allow self-edit of name/title only; tests |

## ## Notes per task

(Filled in as tasks land: what was done, anything surprising, follow-ups.)

### A1 — Migrations applied to Supabase (2026-10-12) ✅
- Applied `0000_init` through `0003_auth_functions` with the MCP `apply_migration` tool, so they also show in Supabase's migration history (`supabase_migrations.schema_migrations`).
- Recorded them in `drizzle.__drizzle_migrations` with the same hash and `created_at` (the journal's `when`) that `drizzle-kit migrate` would write. Drizzle only compares `created_at`, so `npm run db:migrate` will apply only newer migrations.
- Verified on the project:
  - 18 tables, RLS on all of them, 29 policies.
  - 5 RPC functions and 11 `private` helpers.
  - 6 triggers.
  - The `attachments` bucket (private, 10 MB) with its 2 storage policies.
  - 7 tables in `supabase_realtime`.
- Checked through the API with the publishable key, as anon:
  - `invite_exists` works.
  - `companies` returns no rows.
  - `create_company` is refused (42501).
- **From now on**, apply new migrations the same way, or with `npm run db:migrate` once `DATABASE_URL` is set. Never both for the same file.

### A2 — Supabase advisors clean (2026-10-12) ✅

| Advisor | Before | After |
|---|---|---|
| Security | 3 warnings | **0** |
| Performance | 2 warnings + 2 info | 1 info (see below) |

The before findings:
- **Security:**
  - Mutable `search_path` on `private.keep_number` and `private.try_uuid`.
  - `SECURITY DEFINER` functions callable through the API: `invite_exists` by anon, and 5 functions by signed-in users.
- **Performance:**
  - 25 foreign keys without an index.
  - Two permissive policies for the same action on `briefs`, `clients` and `client_users`.

Fixes:
- **`0004_fk_indexes`:** 25 indexes, declared in `src/db/schema.ts` and generated by drizzle-kit.
- **`0005_advisor_fixes`:**
  - `search_path` is now pinned on the two helpers.
  - The 5 RPC functions moved to `private`. `public` keeps `SECURITY INVOKER` wrappers with the same signatures, so the app is unchanged.
  - Every function in `private` is revoked from PUBLIC and granted one by one.
  - Policies on `briefs`, `clients` and `client_users` are merged into one per action.
  - Briefs are tightened: a brief's company must be its client's company for members too, not only for portal users.

Checked:
- `npm run test:db` passes 14/14. A new test fails if a `SECURITY DEFINER` function appears in `public`, if a function lacks a pinned `search_path`, or if a brief points at another company's client.
- Through the API: anon can call `invite_exists`, and `create_company` / `claim_invites` are still refused (42501).

Remaining **INFO, unused_index (27):** expected on an empty database with no traffic. Re-check after real usage, and drop an index only if it is still unused then.

### A3 — Smoke test on the real database (2026-10-12) ✅
`tests/db/smoke-supabase.sql` runs on the Supabase project itself. Run it with the MCP `execute_sql` tool or the SQL editor.

It acts as fake users the same way PostgREST and `withUser()` do (role plus JWT claims), and always ends with an exception, so everything it created is rolled back.

Result: `SMOKE OK` on all 9 checks:
1. Two companies created through the public RPC.
2. A company owner sees only their own company.
3. Writing into another company is blocked.
4. An employee can change their own presence but cannot promote themself.
5. Numbering starts at SO-1001 and OP-1001.
6. A client portal user sees only their client, can send a brief, and the brief logs a `brief.received` event.
7. Events cannot be edited.
8. Storage: a file can go in your own company's folder but not in another company's.
9. Anon sees nothing and cannot create a company.

Afterwards the database still had 0 companies, 0 members and 0 files.

Realtime publication: checked in A1 (7 tables).

Note: invite codes are compared in uppercase. The app always generates them in uppercase (`newInviteCode`, seed `DEMO…`), so any code typed in by hand must be stored in uppercase too.

### B1 — Orders follow an approval workflow (2026-10-12) ✅
- **Schema** (`0006_order_approval`, applied to Supabase): `orders.workflow_id` (the approval workflow, optional) and `orders.run_id` (the run started for the order), both indexed.
- **Rules** (`src/modules/sales/service.ts`):
  - **Starting the run:** `createOrder({ ..., workflowId })` with status `pending` starts the approval run straight away. A `draft` waits until `setOrderStatus(pending)`.
  - **Plan count:** the run does not count toward the plan a second time (the order already counted).
  - **Which workflow:** the workflow must belong to the same company, otherwise the result is `not_found`.
  - **Manual approval:** `setOrderStatus(approved)` is refused (`invalid`) while the run is not completed. The workflow decides.
  - **Following the run:** `actOnRun` calls `syncOrderWithRun`. A completed run sets the order to `approved`, and a closed run (rejected at the first step) sets it to `cancelled`. Each change logs `order.approved` or `order.cancelled` with source `automation`.
- **Tests:** a new test in `tests/db/services.test.ts` covers start-on-create, the manual-approve block, approval by the manager, draft → pending → rejected twice → cancelled, the events, and the cross-company workflow check. `npm run test:db`: 15/15.
- **On Supabase:** advisors are still clean on security, and the smoke test still passes.

### B2 — Action layer tests (2026-10-12) ✅
`tests/server/actions.test.ts` has 7 tests and needs no database:
- **`action()`:**
  - Valid input reaches the handler, and the result comes back as `{ ok: true, data }`.
  - Invalid input returns `invalid` without calling the handler.
  - Input is trimmed before the handler sees it.
  - Thrown `AppError`s come back as their code, and the message stays on the server.
- **`toErrorCode()`:**
  - `42501` → forbidden, also when Drizzle wraps the error in `cause`.
  - `23505` → conflict.
  - `23503` / `P0002` → not_found.
  - `22P02` / `23514` / `ZodError` → invalid.
  - Anything else → `server_error` (logged). Auth error words such as `user_already_exists` are not mistaken for SQLSTATE codes.
- **Validation helpers:** `id`; `localized` (one language is enough, blank in both is rejected, max length); `optionalLocalized`; `isoDate` (format, and impossible dates such as 2026-02-30).

`npm run test:db` now runs every file matching `tests/**/*.test.ts`: 22/22 pass.

Not covered: the Zod schemas written inline in each `actions.ts`. Those files import `server-only`, which cannot load outside Next.js. The services behind them are covered by `tests/db/services.test.ts`.

### A4 — Demo data on Supabase (2026-10-12) ✅
There is no `DATABASE_URL` yet, so `npm run db:seed` could not run. Instead:
1. `npm run db:seed-sql -- <owner email> <out.sql>` (`scripts/seed-to-sql.mts`) runs the real `seedDemo()` on PGlite with all migrations.
2. It exports the company as one SQL script, using `json_populate_recordset` so the ids stay the same.
3. The script was run through the MCP `execute_sql` tool.

On Supabase: company `demo`, code `DEMO01`, plan `pro`.
- Owner: **mohamed.ehab8999@gmail.com**, an invite that is linked on first sign-in.
- 7 members, 5 departments, 3 rooms, 5 clients, 3 briefs.
- 6 orders, numbered PO-1001…1003 and SO-1001…1003 by the database trigger.
- 3 runs, 3 notes, 8 agents, 11 ideas.
- 3 `brief.received` events, logged by the trigger.

### A6 — Simulated working day (2026-10-12) ✅
`npm run db:simulate -- <out.sql>` (`scripts/simulate-day.mts`) runs a day through the real services, each call as a real user with RLS, on PGlite. It then exports the company `simulation` (code `SIM001`) for Supabase.

The day:
1. The owner creates the company and invites Sara (purchasing) and Karim (operations, admin), who then claim their invites.
2. A purchase approval workflow is set up (Sara → Karim).
3. Sara creates **PO-1001**, which starts approval run **OP-1001**. Karim approves, so the order becomes `approved`.
4. The Morning Bakery client joins with its invite code and sends a brief. The team asks for clarification, the client replies, and the team marks it received.
5. An idea is created from the brief.
6. A pinned note is posted, a task is queued for an agent, and a lesson is completed.
7. A standalone maintenance operation starts as **OP-1002**.

Checked on Supabase:
- members and roles
- the order and its run (with Karim's note)
- both operations
- the brief and the client's reply
- the portal link
- the idea, note and agent
- 14 events
- the counters at PO=1001 and OP=1002, so the next numbers continue correctly

**Bug found and fixed:** `setBriefStatus(received)` logged `brief.received`, the same type the database logs when a client *sends* a brief. Team status changes now log `brief.acknowledged`, `brief.clarification_requested` and `brief.reopened`, and a service test checks it.

Note on the imported events: `brief.received` is recreated by the trigger at import time, so in `simulation` it appears last in the activity order.

**Cleanup** (the `simulation` company only): `DELETE FROM public.companies WHERE slug = 'simulation';` cascades to all of its rows. Its fake users have no auth accounts. Then run `DELETE FROM public.lesson_progress WHERE lesson_id = 'owner-1-1' AND user_id::text LIKE '5a5a5a5a-%';`.

### C1 — Activity feed and operations KPIs (2026-10-13) ✅
- **Events now record who did them:** a new column `events.actor_id` (`0007_event_actor`, indexed, applied to Supabase). `emitEvent()` fills it in with the caller's member row. It is `null` for system or automation events and for client portal users, who are not members.
- **`listActivity(companyId, limit)`** (`events/service.ts`; query in `hq/queries.ts`): newest first. Each item is `{ id, time (ISO), type, actorId, text: { ar, en } }`.
  - The text is a noun phrase followed by the actor: "اعتماد الطلب PO-1001 — كريم عادل" / "Order approved: PO-1001 — Karim Adel".
  - Noun phrases keep the Arabic correct whatever the actor's gender. Verbs such as "أنشأ" would read wrong for a woman.
- **`getOperationsStats(companyId, days = 30)`** (`operations/service.ts` and `queries.ts`) replaces `kpis` and `categoryCounts` in mock.ts. It returns:
  - `total`, `activeOperations`, `pendingApprovals`
  - `oldestPendingHours`
  - `automationRate` (share of operations that are not `human`)
  - `avgCycleHours` (from creation to the last history entry)
  - `byCategory`
- **Tests:** a new service test covers the text format, the null actor for portal briefs, newest-first order, other companies seeing nothing, and the KPI figures. `npm run test:db`: 23/23.
- **On Supabase:** advisors are clean on security and have no performance warnings.

### C2 — Marketing sections (2026-10-13) ✅
- **Tables** (`0008_marketing_sections` + `0009_marketing_sections_rls`, applied to Supabase):
  - `social_accounts`: client, platform, handle, followers, status, last post. Unique per client + platform + handle.
  - `campaigns`: client, optional brief, name, channels (`social_platform[]`), stage, progress 0–1 (checked by a constraint), dates, spent, and per-platform `metrics` (`{ reach, results, conversions, spend }`).
  - New enums: `social_platform`, `account_status`, `campaign_stage`.
  - The foreign keys are indexed.
- **RLS:**
  - Members manage their company's rows. The client must belong to the same company.
  - A client portal user can **read** their own client's accounts and campaigns, but cannot change them.
  - `campaigns` is added to realtime.
- **Computed, no tables:**
  - `getClientBudgets`: allocated is the client's `monthly_budget`; spent is the spend of campaigns that run during the month.
  - `getChannelStats`: per platform, the campaign count and reach, cost per result, conversion % and spend share, from the campaign metrics.
- **Service and actions** (`marketing/service.ts`, `actions.ts`, `queries.ts`):
  - Accounts: create, update and delete.
  - Campaigns: create (from a brief takes its client), update (`done` sets progress to 1; dates are checked) and delete.
  - Events: `campaign.created` and `campaign.<stage>`.
  - Portal queries: `listClientCampaigns` and `listClientAccounts`.
- **Seed:** `seedDemo` adds the 6 demo accounts and 5 campaigns. Their per-channel metrics are spread from the demo channel stats, so computed figures match the screens. The live `demo` company got the same rows, with clients matched by name.
- **Tests:** a new service test (`npm run test:db` 24/24) covers:
  - duplicate account → `conflict`
  - bad dates → `invalid`
  - exact budget and channel-stat figures
  - the portal user reading only their client and unable to change it (`not_found` / `forbidden`)
  - done → progress 1, and the events
- **Test helper:** `tests/db/services.test.ts` now maps errors with `toErrorCode`, exactly like `action()`. Database errors such as a unique violation are checked as their app code.
- **On Supabase:** RLS is on, there are 8 policies, the security advisor is clean, and there are no performance warnings.

### C3 — Automated flows (2026-10-13) ✅
- **Table `automation_flows`** (`0010_automation_flows` + `0011_automation_flows_rls`, applied to Supabase):
  - Bilingual name, trigger, optional condition and action.
  - `trigger_event`: the machine-readable event the engine listens to, e.g. `member.invited`.
  - `template_id`, `enabled`, `runs`, `last_run_at`.
  - RLS: any member manages their company's flows, the same rule as workflows. The `company_id` index is in place.
- **Service** (`automation/service.ts`, `actions.ts`, `queries.ts`):
  - `listFlows`: returns the `AutomationFlow` shape, with `lastRun` as short relative text such as "من ٣ ساعة" or "لسه ما اشتغلش", plus `lastRunAt` in ISO.
  - Actions: `createFlow`, `createFlowFromTemplate` (templates stay in `automation/mock.ts`; `t1` maps to `member.invited`), `updateFlow` (also enable/disable) and `deleteFlow`.
  - **`recordFlowRun`** (service only, not an action): for the future automation engine. It counts the run, stamps the time and logs `automation.flow_ran` with source `automation`. A disabled flow is refused (`invalid`).
  - **`getAutomationStats`** replaces `automationStats`:
    - `automationRate`: share of the last 30 days' operations that are not `human`.
    - `perWeek`: automation events in the last 7 days.
    - `hoursSaved`: all runs × `MINUTES_SAVED_PER_RUN` (5). **This is an estimate**; change the constant when real timing exists.
- **Seed:** the 5 demo flows go in through `seedDemo`. The live `demo` company has them too: 5 flows, 4 enabled, 631 runs.
- **Tests:** a new service test (`npm run test:db` 25/25) covers create, from template (including an unknown template), run counting, a disabled flow refusing to run, other companies seeing and changing nothing, and the stats.
- **On Supabase:** the security advisor is clean and there are no performance warnings.
- **Still to build:** the engine itself, a worker that listens to events and runs actions. It belongs to the future Python / automation service.

