# 09 — Full test report

A complete check of the frontend, the backend and the live Supabase database. Newest run first. Re-run it after any change that touches more than one layer, and add a new section here.

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

Note: the first run reported "19 tables" as a failure. The check itself was wrong; 18 is the correct count. Fixed in the check, not in the database.

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
