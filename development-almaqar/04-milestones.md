# 04 — Milestones (changelog)

Newest first within each phase. Add one entry per shipped change. Commit hashes refer to `main` on GitHub.

Entry format:

```
### YYYY-MM-DD — Short title (`commit`)
What changed for the user, in one or two sentences.
Files: main files touched.
```

---

## Phase 1 — Frontend on mock data (in progress)

### 2026-10-12 — Backend foundation: Supabase + Drizzle + RLS
The complete backend and database, with no UI changes. Screens still use mock data until they are wired up.
- **Database:** 18 tables, Row Level Security on every table, document numbering, storage, realtime, and auth functions.
- **Backend:** a service, queries and Server Actions for every module, sign-up and company-code login, and visitor OTP by email or SMS.
- **Rules:** Free-plan limits are enforced on the server.
- **Seed:** demo data can be loaded with a seed script.
- **Tests:** `npm run test:db` (PGlite) covers RLS and every service.
- **Safe to deploy:** the site behaves exactly as before while no Supabase keys are set.

Files: `src/db/*`, `src/server/*`, `src/lib/supabase/*`, `src/modules/*/{service,queries,actions}.ts`, `src/modules/auth/session.ts`, `src/modules/files/actions.ts`, `src/app/api/auth/confirm/route.ts`, `src/proxy.ts`, `drizzle/*`, `scripts/seed.ts`, `tests/db/*`.

### 2026-10-12 — Docs enforced for every agent change (`4ff8bd3`)
Claude Code hook that refuses a commit, and stops an agent from finishing, while code changed without an update to this folder. `CLAUDE.md` states the rule so every agent and subagent sees it.
Files: `.claude/settings.json`, `.claude/hooks/require-dev-docs.mjs`, `CLAUDE.md`, `development-almaqar/07-conventions.md`.

### 2026-10-12 — Development reference folder
Added `development-almaqar/` (this folder) as the engineering record: setup, architecture, routes, milestones, decisions, backend handoff, conventions.
Files: `development-almaqar/*`.

### 2026-10-12 — «لماذا المقر؟» rewritten (`eeb7d9b`)
Six features built on real product strengths (live office, automation, Al Jarab, client portal, Arabic-first, security), numbered cards with hover, a closing line and a «ادخل مقرّك» CTA to signup.
Files: `src/components/marketing/why-section.tsx`, `landing.why` messages.

### 2026-10-12 — Logo links home on every page (`544cd4d`)
Logo added above the company login title, and a compact logo in the app topbar on small screens (where the sidebar is hidden). All 15 pages checked on desktop and mobile.
Files: `src/app/[locale]/(auth)/login/page.tsx`, `src/components/layout/app-topbar.tsx`.

### 2026-10-12 — Landing and login copy (`177b555`, `87c89c8`)
Landing subtitle: «مكانٌ لا تجده على الخريطة، لكن فريقك كلّه فيه الآن.» Login button: «افتح أبواب مقرّك».
Files: `landing.subtitle`, `auth.login.submit` messages.

### 2026-10-12 — Visitor login logo links home (`fe74312`)
Files: `src/app/[locale]/(auth)/visitor-login/page.tsx`, `common.backHome` message.

### 2026-10-12 — «الترقية إلى الذهبية» opens pricing (`81ce935`)
The sidebar upgrade button became a link to `/pricing`.
Files: `src/components/layout/app-sidebar.tsx`.

### 2026-10-12 — Al Jarab subtitle (`8999740`)
«جرابك مليان وكلاء أذكياء: وكيل يشيل عنك أي مهمة، ومتخصص يتقن شغلته.»

### 2026-10-12 — Main hall status chips pinned (`5ca251b`)
«اتصال مباشر» and «7 مشارك» moved into a fixed strip above the floor plan; the plan scrolls/zooms below it instead of sliding underneath.
Files: `src/modules/hq/components/hq-view.tsx`.

### 2026-10-12 — Icon-only menu button (`184442e`)
The «استكشف» label was removed; a ☰ button sits to the right of the logo. The drawer heading shows the brand.
Files: `src/components/marketing/explore-menu.tsx`, `marketing-header.tsx`.

### 2026-10-12 — Premium dialog for «إضافة طبقة أخرى» (`1dbb386`)
Adding a layer to the HQ is a Premium feature: the button shows a crown and opens an upsell dialog (floors, rooms, furniture) linking to `/pricing`.
Files: `src/modules/hq/components/premium-layer-dialog.tsx`, `hq-view.tsx`, `hq.premium` messages.

### 2026-10-12 — Explore side drawer and Al Maqr Compass (`4ebd14d`)
Explore became a side drawer (portaled to `<body>`, focus on open, Esc / backdrop to close). New `/compass` page: Al Maqr Academy with role tracks, courses, lesson progress and guides.
Files: `src/components/marketing/explore-menu.tsx`, `src/modules/academy/*`, `src/app/[locale]/(marketing)/compass/page.tsx`.

### 2026-10-12 — Al Jarab: AI agents room (`75acce8`)
New sidebar item and page `/c/demo/agents`: 2 general agents and 6 specialists, metrics, filter, assign-task dialog, pause/resume.
Files: `src/modules/agents/*`, `src/app/[locale]/(app)/c/[companySlug]/agents/page.tsx`, sidebar and topbar.

### 2026-10-12 — Explore menu next to the logo (`78a4c69`)
First version as a dropdown (later replaced by the drawer).

### 2026-10-12 — Pricing page (`f961d9e`, `33fbae7`)
`/pricing` with Free and Premium, monthly/yearly toggle and FAQ. «جرّب الآن» and the signup «الأسعار» link point to it. Prices set to 300 EGP/month, 30% off yearly (210/month).
Files: `src/components/marketing/pricing-plans.tsx`, `src/app/[locale]/(marketing)/pricing/page.tsx`.

### 2026-10-12 — Landing hero badge (`4b62fd6`)
«مقرّك الرقمي بانتظارك».

### 2026-10-12 — Operations notes audiences (`4d22c83`, `eec8339`)
Notes can go to the whole company, or to selected departments and employees (department chips filter the employee list). The «إلى» picker sits above the message. Notes list filters by department.
Files: `src/modules/operations/notes.ts`, `components/notes-section.tsx`.

### 2026-10-12 — Visitor login opens the client portal (`e86928c`)
Files: `visitor-login-form.tsx`, `src/app/[locale]/(client)/client-portal/page.tsx`, `client-home.tsx`.

### 2026-10-12 — Sales operations template (`261fffc`)
A ready 7-step workflow template `tpl-sales-ops` in the automation room.
Files: `src/modules/automation/workflows.ts`, `automation-view.tsx`.

### 2026-10-12 — Workflow attachments (`e6c948c`)
Workflow builder accepts documents/images up to 10 MB each (local previews only).
Files: `workflow-builder-dialog.tsx`, `attachment-chip.tsx`.

### 2026-10-12 — Logo and favicon (`2a25274`)
Brand logo in `public/brand/logo.png`, favicon `src/app/icon.png`; sidebar brand links to `/`.

### 2026-10-12 — Repository created (`e893e1f`)
Everything below was built before Git and lands in this initial commit. The repo was pushed to GitHub and connected to Vercel.

---

## Phase 0 — Foundation (before 2026-10-12, squashed into `e893e1f`)

Listed in the order it was built.

1. **Project setup.** Next.js 16 + Tailwind v4 + next-intl, Arabic RTL default with English at `/en`, design tokens, Cairo/Inter fonts, `run-local.bat`.
2. **Landing page** from the first design: hero, role cards (owner / employee / visitor), why section, footer.
3. **Auth screens:** company login (Stitch design), employee login, visitor login (QR + invite code + OTP), signup. All forms `noValidate` and navigate without real checks so designs can be reviewed.
4. **Main hall** (`/c/demo`): floor plan with rooms and furniture, the open workspace split into department zones, presence panel, status menu (available, busy, meeting, restroom, waiting, away), control bar, zoom. «إضافة طبقة أخرى» pinned under the open workspace.
5. **App shell:** collapsible sidebar groups («نظرة عامة», «إدارة الأقسام»), topbar with section titles.
6. **Operations room:** KPI cards, operations log with approve / reject / request changes, add-operation dialog, analysis button; categories split into contracts, purchasing, finance, maintenance, operations and sales.
7. **HR home** inside «إدارة الموارد البشرية».
8. **Marketing department:** idea bank, lab, delivery; sections for clients, accounts, marketing operations, channel budgets and channels; client portal link for briefs.
9. **Sidebar states:** HR and marketing enabled, everything without a page dimmed with a "coming soon" toast.
10. **Operations and automation split** into «غرفة العمليات» and «غرفة الأتمتة», each with its own top-level views (analysis, automated flows, templates).
11. **Sales:** sale and purchase orders.
12. **Event model** (frontend only): `src/modules/events` types, constants, helpers and mock API. A database migration version was requested and then cancelled.
13. **Approval workflows** moved into the automation room: employees picked by name + role + department, approve → next owner, reject → previous owner, request changes → first step (flowchart-style). Notes moved to the operations room; tasks removed from automation.
14. **Briefs shared between tabs** via a localStorage store (marketing room ↔ client portal).
