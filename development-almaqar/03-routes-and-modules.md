# 03 — Routes and modules

All routes also exist under `/en`. Every page below runs on mock data.

## Public site — `src/app/[locale]/(marketing)`

| Route | Page file | Main components | What it does |
|---|---|---|---|
| `/` | `(marketing)/page.tsx` | `MarketingHeader`, `RoleCards`, `WhySection`, `MarketingFooter` | Hero («هنا يبدأ كل شيء»), «ابدأ رحلتك» → `/signup`, «جرّب الآن» → `/pricing`, role cards (owner / employee / visitor → their login), «لماذا المقر؟» with six features and a CTA to signup. |
| `/pricing` | `(marketing)/pricing/page.tsx` | `src/components/marketing/pricing-plans.tsx` | Free (0 EGP) and Premium (300 EGP/month, or 210/month billed yearly = 30% off) with a monthly/yearly toggle, feature lists, FAQ. Both CTAs → `/signup`. |
| `/compass` | `(marketing)/compass/page.tsx` | `src/modules/academy/components/academy-view.tsx` | «بوصلة المقر» — Al Maqr Academy: stats, three role tracks (filter), course cards with lesson checklists and progress, hands-on guides into the demo rooms, CTA. |

**Marketing header** (`marketing-header.tsx`): ☰ button (`explore-menu.tsx`) to the right of the logo opens a side drawer with Site (home, why, pricing), Learn (compass) and Sign-in links; then signup / login buttons.

## Auth — `src/app/[locale]/(auth)`

| Route | Form component | On submit |
|---|---|---|
| `/login` | `modules/auth/components/company-login-form.tsx` (company code, email, password; tabs to signup) | → `/c/demo` |
| `/employee-login` | `login-form.tsx` inside `auth-split-layout.tsx` | → `/c/demo` |
| `/visitor-login` | `visitor-login-form.tsx` (QR box, invite code, phone, OTP) | → `/client-portal` |
| `/signup` | `signup-form.tsx` | → `/c/demo` |

Every auth page shows the logo linking to `/`.

## Company app — `src/app/[locale]/(app)/c/[companySlug]`

Wrapped by `layout.tsx` → `AppShell` (sidebar + topbar). Only slug `demo` is valid.

**Sidebar** (`app-sidebar.tsx`): logo → `/`; groups «نظرة عامة» (voice, camera, recording, calendar, chat — coming soon) and «إدارة الأقسام». Enabled items: HR, operations, automation, sales, marketing, Al Jarab. Accounts, archive, meetings, tasks and permissions are dimmed and show a "coming soon" toast. «الترقية إلى الذهبية» → `/pricing`.

**Topbar** (`app-topbar.tsx`): menu button and logo on small screens, page title from `sectionTitles`, main-hall tabs (placeholders), notifications, avatar.

| Route | View | Highlights |
|---|---|---|
| `/c/demo` | `modules/hq/components/hq-view.tsx` | Main hall. Floor plan (`floor-plan.tsx`) with rooms, furniture and an open workspace split into department zones; status chips pinned in a fixed strip; zoom controls; presence / activity side panel; control bar (status menu, mic, camera, history). «إضافة طبقة أخرى» opens the Premium dialog (`premium-layer-dialog.tsx`) → `/pricing`. |
| `/c/demo/hr` | `modules/hr/components/hr-home.tsx` | HR home. |
| `/c/demo/operations` | `modules/operations/components/operations-view.tsx` | Operations room: header actions (audit log, add operation, analysis, notes toggle), KPI cards, operations table by category (contracts, purchasing, finance, maintenance, operations, sales) with approve / reject / request changes, notes section with audience picker (whole company, or departments + employees). |
| `/c/demo/automation` | `modules/automation/components/automation-view.tsx` | Automation room: views all / workflows / flows / templates. Approval workflows built from employees (name + role + department), with attachments up to 10 MB. Runs follow `applyRunAction` in `workflows.ts`: approve → next step, reject → previous step (closes at the first), request changes → first step. Template `tpl-sales-ops` (7 steps). |
| `/c/demo/sales` | `modules/sales/components/sales-view.tsx` | Sale (SO-) and purchase (PO-) orders, totals, filter, order dialog, status changes. |
| `/c/demo/marketing` | `modules/marketing/components/marketing-view.tsx` | Idea bank, lab (version comparison), delivery; sections for clients, accounts, campaigns, channel budgets, channels; incoming briefs shared with the client portal. |
| `/c/demo/agents` | `modules/agents/components/agents-view.tsx` | «الجراب» — 2 general agents and 6 specialists; metrics, filter, assign-task dialog (adds to the agent's queue), pause/resume. |

## Client portal — `src/app/[locale]/(client)`

| Route | View | Highlights |
|---|---|---|
| `/client-portal` | `modules/marketing/components/client-home.tsx` | Signed-in client `c1`. Brief form (`BriefForm` from `client-portal.tsx`), campaign follow-up and replies. Briefs are stored in localStorage and appear live in the marketing room. |
