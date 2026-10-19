# 09 — Full test report

A complete check of the frontend, the backend and the live Supabase database. Newest run first. Re-run it after any change that touches more than one layer, and add a new section here.

## 2026-10-19 — Full end-to-end run on production (owner, employee, visitor)

Real browser (headless Edge over CDP) on https://almaqar-theta.vercel.app, three new Clerk accounts signed in through the real login form, every action through the UI, then checked in the live database. A temporary company was created by the owner's first sign-in and deleted at the end with the three accounts.

**Passed (about 110 checks)**
- **Owner:** sign-in creates the company and opens it. All 18 pages return 200 with no error screens or exceptions (rooms, HR pages, meetings tabs, permissions, analytics, English pages). Adding a department, adding the employee (name, email, title, department, default role), starting and stopping work (68 s session), adding a client (invite code shown), and asking the employee for an approval were all saved correctly.
- **Employee:** first sign-in links the invite (`members.user_id`) and opens the company. Pages open. Analytics and Permissions are closed (NoAccess) and hidden from the sidebar. Approving with a note, requesting a day of leave (1 working day), and start/stop work were all saved.
- **Owner again:** approves the leave (`decided_by_id` = owner). Analytics shows the department with the hours. The employee shows as linked.
- **Visitor:** the invite code is accepted, sign-in opens `/client-portal`, and `client_users` links them to the client. `/c/<slug>`, `/hr` and `/analytics` return 404 for them.
- **Database (RLS as each user):**
  - The employee sees only their own working sessions and only their company.
  - The visitor cannot read the company's members.
  - The analytics readers give the employee nothing.
  - Events: member.invited, client.created, approval.requested, approval.approved, leave.requested, leave.approved.

**Problems found**

| ID | Severity | Where | What happens | Cause |
|---|---|---|---|---|
| QA-001 | High | Main hall `/c/<slug>` | A real company with 2 people shows the 7 demo people (خالد منصور, نور العتيبي…) on the floor plan and in «الحضور» | `hq-view` still renders `hq/mock` members for signed-in companies |
| QA-002 | High | Visitor `/client-portal` | The visitor sees the demo client «مخبز الصباح», not their own client, although `client_users` links them correctly | `client-home.tsx` uses `DEMO_CLIENT_ID` (TODO(backend)) |
| QA-003 | High | Tasks (`meetings?tab=tasks`), Operations, Automation | Demo tasks, people and operations (OP-1042…) inside a real company; tasks added there are not saved | `tasks-section`, `operations-view`, `automation-view` not wired (TODO(backend)); analytics therefore gets no tasks from the UI |
| QA-004 | Medium | Approvals tab | React error #418 (hydration mismatch) when a request exists | `approvals-section.tsx:86` formats times without `timeZone`: the server renders in UTC, the browser in Cairo time. Same pattern in `client-portal-view.tsx:97` and `recruitment-view.tsx:103` |
| QA-005 | Low | Notes, schedule, marketing ideas, briefs | Still demo / local state in a real company (known TODO(backend) list in 06) | Not wired yet |

## 2026-10-19 — Analytics room

| Check | Result |
|---|---|
| `npm run test:db` | 84/84. 10 new in `tests/db/analytics.test.ts`: formulas against hand-worked values (delivery 6/7, on time 5/6, overdue 9 days, 13 working days in 1–19 Oct minus 2 leave days, small samples → insufficient), scope filtering, runs waiting on the step assignee or the owner, demo data; SEC-TC-01/04 (no view, other company → forbidden), SEC-TC-02/06 (scoped head sees Sales only and no people; the SQL readers return nothing outside the scope), SEC-TC-05 (a new grant shows on the next call), owner sees all, default roles. |
| `tsc`, `lint`, `build`, `check:routes` | Pass (`/c/demo/analytics` added). |
| Real browser (/c/demo/analytics) | Tiles, comparison table, a department opened with its people, bottlenecks. No page errors. |
| Migration 0036 on Supabase | Applied. Live checks: `permission_keys()` = catalog (35/35); all 3 Admin roles have analytics.*, no Employee role does; the 3 readers are SECURITY DEFINER with `search_path=''`, not executable by anon; no SECURITY DEFINER in public; RLS on every public table; a non-member gets nothing from the readers; RLS smoke test SMOKE OK. |
| Live service | `getAnalyticsData` as the kira glass owner: 1 department, little data → «بيانات غير كافية», 1 bottleneck. |
| Advisors | Not run: the Supabase MCP is signed out (`/mcp` → supabase → Authenticate). |

## 2026-10-15 — Approvals and files

| Check | Result |
|---|---|
| `npm run test:db` | 74/74. 4 new tests in `tests/db/approvals.test.ts`: request with files, not to yourself, files only from the company's approvals folder; visibility (the two people and the owner), only the approver decides and only once, only the requester withdraws; RLS with raw SQL (no self-approval, no peeking, no foreign file paths); notes keep their files and refuse foreign paths. |
| Migrations 0034–0035 on Supabase | Applied. |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index". |
| Real browser (/c/demo/meetings?tab=approvals) | The three views, the request form, attaching a real PNG (thumbnail on the sent request). No page errors. |
| Real storage upload | Not run: `SUPABASE_SECRET_KEY` is empty locally and not set on Vercel. |
| `tsc`, `lint`, `build`, `check:routes` | Pass. |

## 2026-10-15 — Client portal tile, HR always on

| Check | Result |
|---|---|
| `npm run test:db` | 70/70. 4 new tests in `tests/db/client-portal.test.ts` (demo owners and visitor meetings; one owner only, no foreign department, moving owner clears the other, visitor drops its owner; new marketing clients; meetings in the Schedule, codes hidden without `clients.manage`, employees refused also with raw SQL, delete keeps meetings). `departments.test.ts`: HR cannot be turned off and an old "off" row is ignored. |
| Migrations 0032–0033 on Supabase | Applied. The 6 existing clients now belong to Marketing. HR turned back on for the demo company. |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index". |
| Real browser (/c/demo/hr/client-portal, /c/demo/hr) | Cards, filters, add form with «تبع مين؟». No page errors. |
| `tsc`, `lint`, `build`, `check:routes` | Pass. |

## 2026-10-15 — Recruitment

| Check | Result |
|---|---|
| `npm run test:db` | 66/66. 4 new tests in `tests/db/recruitment.test.ts`: stage rules and demo data; jobs (recruiters only, salary order, paused jobs hidden from employees); referrals (forced to «ترشيح», open jobs only, own referrals only, raw SQL cannot skip stages); the full pipeline (no skipping, interview written to the Schedule and moved in place, hire into the team with title and department, job closes when filled, reject with reason, reopen, delete). |
| Migrations 0030–0031 on Supabase | Applied. `recruitment.manage` given to Admin roles. |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index". |
| Real browser (/c/demo/hr/recruitment) | Pipeline, candidate panel, hire, jobs tab. No page errors. |
| `tsc`, `lint`, `build`, `check:routes` | Pass. |

## 2026-10-15 — Departments page (rooms and company departments)

| Check | Result |
|---|---|
| `npm run test:db` | 62/62. 3 new tests in `tests/db/departments.test.ts`: demo data; rooms (off for the company, manager kept, coming-soon rooms cannot be turned on, outside manager refused, employees refused also with raw SQL); departments (create with manager, stop / restart, delete keeps the employee, raw SQL insert by an employee refused). |
| Migrations 0028–0029 on Supabase | Applied: 3 policies on `company_rooms`, 4 on `departments` (the old "members manage departments" removed). |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index". |
| Real browser (/c/demo/hr/departments) | Both sections, switches, managers and colours. No page errors. |
| `tsc`, `lint`, `build`, `check:routes` | Pass. |

## 2026-10-15 — Working hours

| Check | Result |
|---|---|
| `npm run test:db` | 59/59. 8 new tests in `tests/db/hours.test.ts`: time zones with daylight saving; the month summary (expected, worked, late, absent, leave, weekend work, today); demo habits; clock in / out (one running session); hand entries (manual flag, overlap, future, order); RLS with raw SQL; a department-scoped lead (sees and edits only their team, and its approved leave); the working day settings. |
| Migrations 0026–0027 on Supabase | Applied. RLS on both tables (7 policies), `hours.manage` given to all 4 Admin roles. |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index". |
| Real browser (headless Edge over DevTools, /c/demo/hr/work-hours) | All three tabs, an employee's days opened from the team table, clock in. No page errors. |
| `tsc`, `lint`, `build`, `check:routes` | Pass. |

## 2026-10-15 — Leave

| Check | Result |
|---|---|
| `npm run test:db` | 51/51. 9 new tests in `tests/db/leave.test.ts`: working days and New Year split; balance (approved, pending, custom allowance, unpaid); refusals (overlap, weekend-only, overdraft); demo data; requests end to end; RLS with raw SQL (no reading, adding or approving someone else's leave); department-scoped managers, no deciding your own; a lowered allowance blocks approval; cancel rules; the company policy. |
| Migrations 0024–0025 on Supabase | Applied. RLS on the 3 tables (10 policies), and `leaves.manage` given to all 4 Admin roles. |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index". |
| Real browser (headless Edge over DevTools, /c/demo/hr/leave) | All four tabs; approving a request (badge 3 → 2) and sending a new one (annual balance 16 → 15). No page errors. |
| `tsc`, `lint`, `build`, `check:routes` | Pass. |

## 2026-10-14 — Login page load (guest button shown alone)

Headless Edge with a fresh profile, cache disabled, and the page checked every 150 ms.

| Page (live site) | Before the fix | After |
|---|---|---|
| `/login` | skeleton, then form missing for more than 12 s | skeleton → form at 6.1 s; guest alone 0 ms |
| `/employee-login` | guest alone 3.15 s | form at 6.0 s; guest alone 0 ms |
| `/en/login` | guest alone 3.75 s, form at 12 s | form at 4.7 s; guest alone 0 ms |
| `/login` on a slow network (400 ms latency, 1.6 Mbps) | form not drawn within 25 s | form at 8.4 s; guest alone 0 ms |

## 2026-10-13 — Client profitability

| Check | Result |
|---|---|
| `npm run test:db` | 41/41. 6 new tests: every formula on a hand-checked case; zones and «insufficient data»; each advice cause and the 3-month rule; the 5 demo situations; owner/admin-only access (also raw SQL on `invoices`); a report built from real tasks, portal revisions, a meeting, an invoice and a freelancer payment. |
| Migrations 0019–0022 on Supabase | Applied. RLS is on for the 4 new tables, every Admin role has `profitability.view`, and no Employee role does. |
| Smoke test, advisors | SMOKE OK. Security: none. Performance: only INFO "unused index", after removing overlapping policies (including the two left from permissions). |
| Real browser (headless Edge over DevTools) | Marketing → «ربحية العملاء»: table, alerts, details for two clients, recommendation and "consider ending". Permissions → «إعدادات التسويق». No page errors. Fixed: percentages reversed inside Arabic text, and numbers sticking to the next column. |
| `build`, `lint`, `check:routes` | Pass. |

## 2026-10-13 — Permissions

| Check | Result |
|---|---|
| `npm run test:db` | 35/35. The 7 new tests in `tests/db/permissions.test.ts` cover: catalog = database keys; default roles; Admin keeps the old admin access; owner-only management (also through raw SQL); owner → deny → grant → role order; department scopes for members and tasks; deleting a role; a member with no role. |
| Migrations 0016–0017 on Supabase | Applied. All 4 companies have both roles (28 and 13 permissions), every non-owner member has a role, and RLS is on for the 3 new tables. |
| Smoke test on Supabase | SMOKE OK, with the new "permissions" step (default roles, owner has everything, a member without a role has nothing, an employee cannot create roles). |
| Advisors | Security: 0. Performance: only INFO "unused index" (new indexes). |
| `npm run build`, `npm run lint`, `npm run check:routes` | Pass, including `/c/demo/permissions` in ar and en. |

## 2026-10-13 — Retest after the product owner's first real sign-up (production, Clerk + Supabase)

**Result: passed.** The product owner signed up on https://almaqar-theta.vercel.app as mohamed.ehab8999@gmail.com.

| Check | Result |
|---|---|
| Company created by after-sign-in | ✅ `kira-glass-7c2n` (code `RFSQPU`, plan free); the owner is the Clerk user `user_3KdX1WSP…` |
| Invite claimed by email | ✅ the same user is now owner of `demo` (the seed had waited for this email) |
| Through the app's services with RLS, as this user | ✅ exactly 2 companies (both owner); `simulation` hidden; demo data readable (7 members, 6 orders, 5 campaigns); kira-glass has only this member |
| A signed-in stranger (another Clerk id) | ✅ sees 0 companies |
| Integrity | ✅ every company has exactly one owner; no duplicate memberships; user ids are Clerk ids (or the simulation's fixed test ids) |
| Clerk account | ✅ exists, email verified, `pending_company` cleared after the company was created |
| RLS smoke test on Supabase | ✅ `SMOKE OK` |
| Supabase advisors | ✅ no security or performance warnings |
| `npm run test:db` | ✅ 27/27 |
| Production runtime errors (Vercel logs, last 30 min) | ✅ 0 |

## 2026-10-13 — Full run

**Result: passed.** One gap remains: the direct app → database path, which needs `DATABASE_URL` (task A5 in [08-backend-tasks.md](08-backend-tasks.md)). There is also one mobile layout point to check by hand.

### 1. Backend (local)

| Check | How | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ clean |
| Types | `npx tsc --noEmit` | ✅ clean |
| Tests | `npm run test:db` | ✅ **22/22**: 7 RLS, 8 service flows (including the demo seed and orders with approval), 7 action layer |
| Production build | `npm run build`, with the Supabase keys in `.env.local` | ✅ compiled, every route built |

### 2. Database (live Supabase project `rosifnxvdpwkvpqzguzj`)

Run through the Supabase MCP.

| Check | Result |
|---|---|
| Migrations in the repo vs applied | ✅ 7/7 applied. Drizzle tracking is in sync (7 rows). |
| Tables | ✅ 18 tables in `public`, RLS on all of them |
| `SECURITY DEFINER` functions in `public` | ✅ none |
| Security advisor | ✅ clean |
| Performance advisor | ✅ no warnings. 19 INFO "unused index" (down from 27 now that there is data) |
| RLS smoke test (`tests/db/smoke-supabase.sql`, rolled back) | ✅ `SMOKE OK`, all 9 scenarios |
| Companies present | ✅ `demo` and `simulation` |
| Cross-company or dangling references (7 relations) | ✅ 0 |
| Every workflow step's assignee is a member of that company | ✅ 0 bad |
| Number counters equal the highest number used | ✅ demo SO/PO/OP = 1003, simulation PO = 1001, OP = 1002 |
| Order numbers unique per company | ✅ |
| Orders agree with their approval runs | ✅ |
| One owner per company | ✅. The demo owner is waiting for mohamed.ehab8999@gmail.com to sign up. |
| Events have payloads; names have both `ar` and `en` | ✅ 17 events |

**Public API as an anonymous visitor** (publishable key only, same as anyone on the internet):

| Probe | Result |
|---|---|
| Read 5 rows from each of the 18 tables | ✅ 0 rows everywhere, although demo and simulation data exist |
| Insert a company | ✅ refused (42501) |
| Update orders | ✅ 0 rows changed |
| Call the `private` schema | ✅ not exposed (PGRST106) |
| `invite_exists('demoC1')` | ✅ true, case-insensitive |
| List storage files | ✅ 0 |

Note: the run reported one failure, "19 public tables". The check was written with the wrong expected number. The schema has 18 tables (see [02-architecture.md](02-architecture.md)), so the database is correct. When you repeat this check, expect 18.

### 3. Frontend (production server with the Supabase keys)

**Routes** (`npm run check:routes`, `scripts/check-routes.mjs`):
- ✅ 30/30 pages (15 Arabic and 15 English) return 200 with the right `lang` and `dir` (rtl/ltr), no error text, and their key content.
- ✅ All pages respond in 23–172 ms.
- ✅ `/api/auth/confirm` with a bad token redirects to `/login?error=link`.
- ✅ An unknown company slug returns 404.
- ✅ A page with a broken Supabase auth cookie still returns 200, so the session refresh in the proxy does not break pages.

**Real rendering in a headless browser** (Microsoft Edge):
- ✅ 12 pages rendered with JavaScript: landing, signup, visitor login, main hall, operations, automation, sales, marketing, Al Jarab, client portal, compass, and the English main hall.
- ✅ 0 console errors and no "Application error". Console capture was confirmed to work, since it logged a browser-extension message.
- **Screenshots reviewed:** the main hall (RTL), sales, the English automation room (LTR), and the main hall on mobile (390 px).

### Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | The screens still show mock data (for example SO-1021 and PO-2041 on the sales page), not the Supabase data. | Expected | The screens are not wired to the backend yet; see [06-backend-handoff.md](06-backend-handoff.md) |
| 2 | Mobile (390 px), main hall: the floor plan is wider than the screen and the status strip is cut at the edge ("7 مشارك" shows as "ارك"). | Low, needs a manual look | Check on a real phone: the plan is meant to scroll and zoom, but the strip should not clip |
| 3 | App server → database over the transaction pooler (`withUser` against Supabase) has not been run. | Gap | Waiting for `DATABASE_URL` (task A5) |
| 4 | Sign-up, confirmation email and OTP have not been run against Supabase Auth. | Gap | Needs the auth screens wired to the backend (task B3) |

### How to repeat

1. Run `npm run lint`, `npx tsc --noEmit`, `npm run test:db` and `npm run build`.
2. Run `npx next start -p 3123`, then `npm run check:routes`.
3. **Live database** (Supabase MCP or SQL editor):
   1. Run `tests/db/smoke-supabase.sql`.
   2. Run the advisors (`get_advisors`, security and performance).
   3. Run the integrity queries for this section (they are kept with the A-tasks in [08-backend-tasks.md](08-backend-tasks.md)).
4. **Headless render:** run `msedge --headless=new --enable-logging=stderr --v=0 --dump-dom <url>` and look for `CONSOLE` lines with errors. Use `--screenshot --window-size=390,844` for mobile.
