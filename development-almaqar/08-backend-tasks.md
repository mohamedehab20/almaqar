# 08 — Backend completion tasks

What is left of the approved backend plan, split into small tasks for **two engineers** working in parallel:
- **Engineer A** owns the database and infrastructure.
- **Engineer B** owns application logic and tests.

Update the status column when a task lands, and record the change in [04-milestones.md](04-milestones.md) in the same commit.

Status: ✅ done · 🔄 in progress · ⏳ waiting on something · ⬜ not started

## Phase 1 — Database live on Supabase (no password needed)

| # | Task | Owner | Depends on | Status | Done when |
|---|---|---|---|---|---|
| A1 | Apply migrations 0000–0003 to the Supabase project (`rosifnxvdpwkvpqzguzj`) through the Supabase MCP, and record them in Drizzle's `drizzle.__drizzle_migrations` so `npm run db:migrate` skips them later | A | — | ⬜ | 18 tables, policies, functions, bucket and publication exist on the project |
| A2 | Run the Supabase security and performance advisors; fix the findings in a new migration | A | A1 | ⬜ | Advisors show no errors; any remaining warnings are explained here |
| A3 | Smoke test on the real database: RLS scenarios run inside a transaction that is rolled back (nothing is left behind), plus checks on storage policies and the realtime publication | A | A1 | ⬜ | Every scenario passes on Supabase, same as on PGlite |
| B1 | Orders → approval workflow: an order can point at an approval workflow. Making it `pending` starts the run, and finishing the run approves the order (or cancels it if the run is closed). | B | — | ⬜ | Covered in `tests/db/services.test.ts`; new migration applied |
| B2 | Unit tests for the action layer: Zod input schemas and the mapping of Postgres and auth errors to error codes | B | — | ⬜ | `npm run test:db` includes them and passes |

## Phase 2 — Running on Supabase (needs `DATABASE_URL` in `.env.local`)

| # | Task | Owner | Depends on | Status | Done when |
|---|---|---|---|---|---|
| A4 | `npm run db:seed -- --owner <owner email>` on Supabase | A | `DATABASE_URL` | ⏳ | `demo` company is visible in the dashboard |
| A5 | Check `withUser` over the transaction pooler (port 6543): role switch and RLS inside a pooled transaction | A | `DATABASE_URL` | ⏳ | A real query as a test user returns only that user's rows |
| B3 | Manual end-to-end auth check against Supabase: sign-up with email confirmation, company-code login, visitor email OTP | B | A4 | ⏳ | Each flow reaches its page; results recorded here |
| B4 | Vercel: add env vars (`NEXT_PUBLIC_*` now; `DATABASE_URL` and `SUPABASE_SECRET_KEY` as Sensitive after A5). Set Supabase Auth Site URL and redirect URLs to the Vercel domain. | B | A5, Vercel login | ⏳ | Production can sign in |

## Notes per task

(Filled in as tasks land: what was done, anything surprising, follow-ups.)
