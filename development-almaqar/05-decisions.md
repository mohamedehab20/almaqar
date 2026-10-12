# 05 — Decisions

Short records of choices made on purpose. Newest first. When you reverse one, add a new entry that points back to it rather than deleting it.

Format: **Decision** — why — alternatives considered.

### 2026-10-12 — An order's approval is decided by its workflow run, not by hand
When an order has a workflow, only the run can approve it: completed → approved, closed → cancelled. Cancelling by hand is still allowed.

Why: the approval trail lives in the run's history, and a manual approve would skip it.

Alternative: allow admins to override. Not needed yet.

### 2026-10-12 — Privileged RPCs live in `private`; `public` only has SECURITY INVOKER wrappers
Why: anything in `public` is an API endpoint, and Supabase's advisor flags `SECURITY DEFINER` there. The wrapper can only run the private body if the caller was granted EXECUTE on it. Grants are explicit, function by function.

Alternative: keep the definer functions in `public` and accept the warnings.

### 2026-10-12 — Backend in TypeScript inside Next.js; Python only for a future AI-agents service
Why:
- Supabase already provides auth, realtime, storage and tenant isolation (RLS).
- The frontend types are reused as-is, so nothing is defined twice.
- There is one deploy (Vercel) and no CORS or token forwarding.

Alternative: a separate FastAPI backend. It would duplicate every type and need its own hosting. Python is kept for the agent runtime (الجراب), which reads tasks from `agent.task_queued` events.

### 2026-10-12 — Queries go through Drizzle inside a transaction that runs as the user (`withUser`), not supabase-js
Why: typed camelCase queries over the same schema as the migrations, while RLS still applies (`SET LOCAL ROLE authenticated` plus the JWT claims). supabase-js is used only for auth, RPC during sign-in, and storage.

Alternative: supabase-js everywhere, which means generated types and snake_case rows.

**Rule:** `db()` bypasses RLS and is never used for user requests.

### 2026-10-12 — Service functions take `(ctx, input)` and import nothing from Next.js
Why: the same code runs in Server Actions and in tests on PGlite.

`queries.ts` and `actions.ts` are one-line wrappers around the services.

### 2026-10-12 — Authorization in the database first
- RLS checks membership.
- `private.*` SECURITY DEFINER helpers live outside the API schema.
- A trigger stops non-admins from changing member details other than presence.

Services add the business rules: owner/admin-only actions, step assignee, plan limits.

### 2026-10-12 — Document numbers (SO-/PO-/OP-####) come from database triggers
They are per company, start at 1001, and cannot be edited. Why: safe under concurrent inserts.

Alternative: count in the app, which races.

### 2026-10-12 — Sign-up creates the company after email confirmation
The company details wait on the auth user (`pending_company`), and `finishSignIn()` creates the company on the first session.

Invited members are rows with an `email` and no `user_id`. They are linked on sign-in (`claim_invites`).

### 2026-10-12 — Visitor OTP supports email and SMS
Email works with no extra setup. SMS needs an SMS provider in Supabase; the code does not change. Chosen by the product owner.

### 2026-10-12 — Company data keeps bilingual `{ ar, en }` jsonb fields
Why: it matches the frontend contracts, so wiring the screens is a swap.

Text typed by users is stored in both keys until per-language editing exists.

### 2026-10-12 — Documentation lives in `development-almaqar/` and is updated with every milestone
Why: anyone joining should understand the project without reading the whole Git history or chat logs.

### 2026-10-12 — Premium-gated features open an upsell, not an error
«إضافة طبقة أخرى» (HQ editor) shows a Premium dialog linking to `/pricing`. Reuse this pattern for other paid features.

### 2026-10-12 — Prices in EGP: Premium 300/month, 30% off yearly (210/month)
Set by the product owner. Constants `PREMIUM_MONTHLY` and `PREMIUM_YEARLY_PER_MONTH` in `src/components/marketing/pricing-plans.tsx`; currency strings in `pricing` messages. Free plan: up to 5 employees.

### 2026-10-12 — Explore menu is a side drawer portaled to `<body>`
Why: the marketing header uses `backdrop-filter` (`glass`), which traps `position: fixed` children. Alternative: drop the glass effect.

### 2026-10-12 — Main hall status chips live in a fixed strip, not floating over the plan
Why: floating chips over a zoomable/scrollable plan looked like they were moving.

### Phase 0 — Frontend first, on mock data
Build and approve every screen before any backend. All forms skip validation (`noValidate`) and navigate straight to the next screen. Each module has its own `mock.ts`, and `TODO(backend)` comments mark every place real data is needed.

### Phase 0 — Planned backend: Supabase + Drizzle (not Firebase)
Why: the data is relational (company ↔ departments ↔ members ↔ workflows ↔ orders); Row Level Security on `company_id` gives tenant isolation in the database. Alternative: Firebase, as the product doc suggested. Deferred until the frontend is approved. An event-table migration was drafted and then cancelled by the product owner.

### Phase 0 — Arabic-first i18n with next-intl, `localePrefix: "as-needed"`, no locale detection
Arabic at `/`, English at `/en`. Browser language never switches the site to English.

### Phase 0 — Feature modules under `src/modules/<feature>`
Pages stay thin; each feature owns its types, mock data and components. Shared demo company data stays in `src/modules/hq/mock.ts`.

### Phase 0 — Cross-page shared state via localStorage + `useSyncExternalStore`
For briefs between the marketing room and the client portal, until a realtime backend exists. The hook API (`useBriefs`, `updateBriefs`) is meant to survive the switch to an API.

### Phase 0 — Approval workflow rules
Approve → next step; reject → previous step (closes the run at the first step); request changes → back to the first step's owner. Implemented in `applyRunAction` (`src/modules/automation/workflows.ts`).

### Phase 0 — Employees are always shown with role and department
In pickers (workflow builder, notes), to tell apart employees with similar names (`memberLabel`, `memberRole`).
