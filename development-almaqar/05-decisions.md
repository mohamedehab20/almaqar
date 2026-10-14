# 05 — Decisions

Short records of choices made on purpose. Newest first. When you reverse one, add a new entry that points back to it rather than deleting it.

Format: **Decision** — why — alternatives considered.

### 2026-10-15 — Clients belong to a room, a department, or nobody (visitor); HR is always on
- **One owner per client:** an HQ room or a company department, never both (a database check); a visitor (`kind = visitor`) belongs to nobody and the server refuses one with an owner. Existing clients came from Marketing, so the migration set them to the Marketing room.
- **Same table:** visitors are rows of `clients` too, so they get a portal code and their meetings use `meetings.client_id` like any client.
- **The visitor side of the portal** (`/client-portal`) still shows the marketing demo; showing each client what belongs to their owner (meetings for a visitor, orders for a sales client, …) is the next step.
- **HR is locked on:** «إدارة الأقسام» lives inside HR, so turning HR off left the owner with no way back (it happened on the demo company). Rooms can carry `locked` in `rooms.ts`.

### 2026-10-15 — Recruitment: private candidates, referrals for everyone, interviews in the Schedule
- **Privacy:** candidates are personal data, so only `recruitment.manage` reads them. Other members see open jobs and the people they referred, nothing else (RLS).
- **Referrals:** any member may refer someone to an open job. It is saved as source «ترشيح», first stage, with them as the referrer; RLS refuses anything else from a non-recruiter.
- **Stages:** one step at a time (forward or back), reject from any active stage, hire only from an offer. This keeps the pipeline honest without blocking quick moves.
- **Interviews** are written straight into `meetings` (kind interview) by the recruitment service, so a recruiter does not also need Operations permissions; moving the interview updates the same item.
- **Hiring** can add the person to the team through `inviteMember` (so `members.invite` and the plan limit still apply). A job closes by itself once its openings are filled.
- **CVs** are a link for now; uploading files to storage can follow.

### 2026-10-15 — Rooms on / off per company; department and room managers are labels for now
**Chosen by the product owner:** one page with both the HQ rooms and the company departments.

- **Turning a room off** hides it from the sidebar for everyone, owner included, and its pages show «القسم ده مقفول». It is a company choice on top of permissions: the services still check permissions, and do not check the room switch. Blocking every action of a closed room on the server can come later if needed.
- **Rooms permission:** `company.settings`, because it changes the HQ for the whole company. **Departments:** `departments.manage`.
- **Managers** (of a room or a department) are recorded and shown, but grant nothing by themselves; access still comes from roles and exceptions. They are ready to drive approvals (for example leave going to the department manager) later.
- **Stop vs delete:** stopping keeps the people in the department and hides it for new employees; deleting leaves its people without a department.
- **RLS tightened:** `departments` were writable by any member since 0001 (the services checked the permission). Now only `departments.manage` writes them.

### 2026-10-15 — Working hours: sessions, a company time zone, today never counts as short
- **Data:** a session per stretch of work (`work_sessions`), from the clock-in button or typed by hand. A daily-total table would lose the in / out times needed for lateness.
- **Time zone:** each company sets one; days and lateness are read in it (`zonedToUtc` / `localParts`, daylight saving included). The server's UTC date would put late-evening work on the wrong day.
- **Expected hours** count working days until yesterday, minus approved leave. Counting today would show everyone "short" until they leave.
- **Hand entries:** allowed for yourself (forgotten clock-in, work outside the office), always marked «يدوي» with an optional note, and visible to the manager. Employees cannot remove timer records. A stricter flow (hand entries waiting for approval) can come later if needed.
- **Weekend:** shared with the leave policy, so the two pages never disagree.
- **Alternative considered:** reusing `leaves.manage` for hours. A separate `hours.manage` was kept, so a company can let someone follow attendance without approving leave.

### 2026-10-15 — Leave: working days, reserved pending days, a fixed list of types
- **Days counted:** working days only, skipping the company's weekend (Friday and Saturday by default). The server counts them when the request is made; public holidays are not subtracted yet.
- **Balance:** allowance − approved − pending. Pending days are reserved, so two requests cannot spend the same days; approval checks again (the allowance may have been lowered).
- **Types:** a fixed list (annual, casual, sick, unpaid), with company-wide yearly days and a per-employee figure per year. Casual leave has its own balance here; Egyptian law counts it inside annual leave, which a company can mirror by lowering the annual days. Custom types can come later.
- **Who decides:** `leaves.manage`, scoped by the employee's department, so a department head approves only their team. Nobody decides their own request except the owner. The policy needs an all-departments grant.
- **Alternative considered:** a separate approvals flow through the Automation room. It was left out for now, because leave needs balances and overlap checks that a generic approval run does not have.

### 2026-10-14 — Auth forms: our skeleton until Clerk draws, not until Clerk loads
Clerk loads in three steps after hydration (`clerk.browser.js`, then `/v1/environment` + `/v1/client`, then the sign-in UI chunks). `ClerkLoaded` fires after the second step, so it is not enough to know the form is visible.

- **The rule:** the skeleton stays until an input or button exists inside Clerk's box.
- **Faster later:** a production Clerk instance on our own domain would be quicker than the `*.clerk.accounts.dev` development instance.

### 2026-10-13 — Guest mode only from the guest button; links always ask to sign in
**Chosen by the product owner,** to protect company data when a link is shared or moved between browsers.

- **The check runs in the proxy:** no Clerk session and no guest cookie → `/login?next=`.
- **`next` is accepted only for company paths** (`safeNext` in `src/lib/guest.ts`), so it cannot send anyone to another site.
- **Updates** «Continue as a guest»: the demo is no longer open to a bare link.

### 2026-10-13 — Client profitability on minimal tables, computed on the server
**Chosen by the product owner:** minimal tables, not full Calendar/Invoices/Freelancers modules.

- **What existed:**
  - Clients, tasks, and the approval portal (`marketing_ideas.delivery`).
  - There was no calendar, no invoices, no freelancers and no cost settings.
- **Added, the least needed:**
  - **Columns:** `clients.package_deliverables` / `package_revisions_per_post`, and `tasks.client_id` / `task_type` / `tracked_minutes` / `revisions`. `marketing_ideas.task_id` links content to its production task, so a client's change request in the portal adds one revision to that task.
  - **Tables:** `meetings`, `invoices` (income per `period` month, plus due/paid dates), `freelancer_payments` and `profitability_settings`.
  - **No screens yet** for meetings, invoices or freelancers; there are actions only.
- **Formulas:** one pure module, `src/modules/profitability/calc.ts`. Both the real service and the demo use it, on the server. The UI only filters and sorts.
- **Income = invoices of the month.** `clients.monthly_budget` is the client's ad budget, not the agency's fee.
- **Main cause of a red month** = the biggest number of hours beyond the contract:
  - extra revisions,
  - pieces above the package,
  - meetings above 20 % of the client's hours.
  - If none of these, the price is too low.
- **Money tables** (`invoices`, `freelancer_payments`) are readable only with `profitability.view`, also through RLS. Cost settings are written by the owner only.
- **Currency of this screen: EGP (ج.م).** The rest of the marketing room still shows ر.س from Phase 0.

Alternatives: build the full modules first (much larger), or compute in the browser on demo data (rejected: the owner asked for server-side calculation).

### 2026-10-13 — Sales and Al Jarab closed as "coming soon"
**Chosen by the product owner.**

- **Closed in two places:** the sidebar and the URL.
- **Nothing deleted:** code, data and backend stay, so reopening them means restoring the two `href`s in `app-sidebar.tsx` and removing `COMING_SOON_ROOM` in `src/proxy.ts` and the two redirect layouts.
- **Alternative:** deleting the rooms, rejected because the work is done and only the launch is postponed.

### 2026-10-13 — Permissions: owner-defined roles + per-member exceptions, scoped by department
**Chosen by the product owner.**

- **Roles:** the owner defines roles and their permissions. Every company has two built-in roles that cannot be deleted: «مدير» and «موظف» (`roles.system_key`).
- **Exceptions:** per member, grant or deny any permission.
- **Department scopes:** some permissions can be limited to departments.
- **The rule, in the database** (`private.has_permission`):
  1. The owner → yes.
  2. A deny exception → no.
  3. A grant exception → yes.
  4. A permission from the member's role → yes.
  5. Otherwise → no.
- **What the scope applies to:** the member the action is about. That is the target member, the task's assignee, the note's author or the order's creator.
- **Owner-only:** managing permissions, and choosing a member's role. These can never be granted, so nobody can raise their own access.
- **A room without its `.view` permission is closed:** hidden in the sidebar, a blocked page, and the server refuses the actions.
- **Reads stay with RLS (company members).** The permission checks are on actions.
- **`members.role` stays** only to mark the owner. `admin`/`employee` no longer decide anything; `role_id` does.

Alternatives: fixed roles only (no custom roles), or per-member toggles without roles. Both were rejected as too rigid or too much work for the owner.

### 2026-10-13 — Clerk for accounts and sign-in; Supabase only for data
**Chosen by the product owner.** This reverses the Supabase Auth decision.

- **Clerk** owns accounts, sign-in/up, verification, password reset and sign-out.
- **The database** still enforces everything with RLS. `withUser()` sets the JWT claims from Clerk (`sub`, `email`), and the rules read `private.uid()` (text, Clerk ids are not uuids). `user_id` columns are text (migration 0013).
- **Supabase Storage and Realtime** do not know Clerk users. File access is checked on the server and done with the secret key. Realtime would need Clerk as a Supabase third-party auth provider.
- **Dropped:** the company code at sign-in. People sign in with their account, and after-sign-in opens their company.

Alternatives: keep Supabase Auth (the earlier recommendation), or use Clerk + Supabase third-party auth for everything.

### 2026-10-13 — Never fake success in auth forms
When the server has no Supabase keys, the forms report it. They do not open the demo instead. Why: the silent fallback made a real sign-up look successful while nothing was saved. This reverses the earlier "keep the demo reachable" fallback. The demo is still open at `/c/demo` and from the landing page.

### 2026-10-13 — Employees join by email + company code; no separate employee IDs
- **Joining:** an owner or admin adds the employee's email (HR → Employees). The employee activates at `/join` with that email and a password.
- **Signing in:** from then on, company code + email + password.

Why: it reuses Supabase Auth and the `claim_invites` link. There is nothing extra to store or reset.

The old "email or employee code" field now accepts email only.

### 2026-10-13 — Signed out, only the demo company is public
A signed-out visitor who opens any other `/c/<slug>` is redirected to `/login`, not shown a 404. Why: a 404 would reveal which company slugs exist.

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
