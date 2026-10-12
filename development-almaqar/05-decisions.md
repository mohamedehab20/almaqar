# 05 — Decisions

Short records of choices made on purpose. Newest first. When you reverse one, add a new entry that points back to it rather than deleting it.

Format: **Decision** — why — alternatives considered.

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
