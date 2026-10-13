# 03 — Routes and modules

All routes also exist under `/en`. Every page below still runs on mock data. The backend for each one is ready, but the screens are not wired to it yet. See "Backend per module" at the end and [06-backend-handoff.md](06-backend-handoff.md).

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
| `/login` | `company-login-form.tsx` → `clerk-auth.tsx` `ClerkSignIn` | Clerk sign-in inside our card → `/api/auth/after-sign-in` → your company. Without Clerk keys it shows a "not enabled" note. |
| `/employee-login` | `login-form.tsx` | Clerk sign-in; "Join your company" → `/join`; visitor login link. |
| `/visitor-login` | `visitor-login-form.tsx` | Step 1: invite code (QR or typed), checked with `checkInviteCode`. Step 2: Clerk sign-in or sign-up → after-sign-in redeems the code → `/client-portal`. |
| `/signup` | `signup-form.tsx` | Step 1: your name and the company (type, size). Step 2: Clerk `<SignUp>` with the company in `unsafeMetadata`. after-sign-in creates it and opens it. |
| `/join` | `account-forms.tsx` `JoinForm` | Invited employee: Clerk `<SignUp>` with the email they were added with. `?status=no-invite` explains that no company has invited that email yet. |

Every auth page shows the logo linking to `/`.

## Company app — `src/app/[locale]/(app)/c/[companySlug]`

Wrapped by `layout.tsx` → `AppShell` (sidebar + topbar). The layout calls `getSignedInCompany(slug)`:
- **Signed in and a member:** the real company. The topbar shows your name and a sign-out button.
- **Signed in but not a member:** 404.
- **Signed out:** `/c/demo` stays the public demo, on mock data, reached from the "continue as a guest" button on the auth pages. A guest banner says nothing is saved and links to sign-up and sign-in. Any other slug redirects to `/login`.

The rooms' screens still show mock data. Only the layout and HR → Employees read the real company so far.

**Access:** every `/c/<slug>` page needs a sign-in (proxy → `/login?next=`). The demo opens without one only after the «ادخل كضيف» button (session cookie `almaqr_guest`).

**Sidebar** (`app-sidebar.tsx`): logo → `/`; groups «نظرة عامة» (voice, camera, recording, calendar, chat — coming soon) and «إدارة الأقسام». Enabled items: HR, operations, automation, marketing, and permissions (owner only; open in the demo). A signed-in member does not see rooms they have no `.view` permission for. Sales, Al Jarab, accounts, archive, meetings and tasks are dimmed and show a "coming soon" toast. «الترقية إلى الذهبية» → `/pricing`.

**Topbar** (`app-topbar.tsx`): menu button and logo on small screens, page title from `sectionTitles`, main-hall tabs (placeholders), notifications, avatar.

| Route | View | Highlights |
|---|---|---|
| `/c/demo` | `modules/hq/components/hq-view.tsx` | Main hall. Floor plan (`floor-plan.tsx`) with rooms, furniture and an open workspace split into department zones; status chips pinned in a fixed strip; zoom controls; presence / activity side panel; control bar (status menu, mic, camera, history). «إضافة طبقة أخرى» opens the Premium dialog (`premium-layer-dialog.tsx`) → `/pricing`. |
| `/c/demo/hr` | `modules/hr/components/hr-home.tsx` + `employees-panel.tsx` | HR home. **Signed in:** an Employees panel at the top shows the company code (with copy), the team with role and account status (active, or waiting for activation), an add-employee form (needs «إضافة موظفين»; only the owner picks the role, others add with «موظف»; optional WhatsApp number), a "Send the invite on WhatsApp" button after adding and on every employee still waiting, and remove. **Demo:** a note asking you to sign in. |
| `/c/demo/operations` | `modules/operations/components/operations-view.tsx` | Operations room: header actions (audit log, add operation, analysis, notes toggle), KPI cards, operations table by category (contracts, purchasing, finance, maintenance, operations, sales) with approve / reject / request changes, notes section with audience picker (whole company, or departments + employees). |
| `/c/demo/automation` | `modules/automation/components/automation-view.tsx` | Automation room: views all / workflows / flows / templates; header buttons «تصميم مسار عمل» (workflow builder) and «إنشاء مسار عمل مؤتمت جديد» side by side. Approval workflows built from employees (name + role + department), with attachments up to 10 MB. Runs follow `applyRunAction` in `workflows.ts`: approve → next step, reject → previous step (closes at the first), request changes → first step. Template `tpl-sales-ops` (7 steps). |
| `/c/demo/sales` (coming soon: redirects to `/c/demo`) | `modules/sales/components/sales-view.tsx` | Sale (SO-) and purchase (PO-) orders, totals, filter, order dialog, status changes. |
| `/c/demo/marketing` | `modules/marketing/components/marketing-view.tsx` | Idea bank, lab (version comparison), delivery; sections for clients (with a contract PDF per client), accounts, campaigns, and «ربحية العملاء» (owner/admins: margin, hourly yield, package use, revisions, late payments, alerts, advice, sector averages; computed on the server, demo data in /c/demo), channel budgets, channels; incoming briefs shared with the client portal. |
| `/c/demo/permissions` | `modules/permissions/components/permissions-manager.tsx` | «الصلاحيات» (owner only; others get «مالكش صلاحية هنا»). Tabs: roles, members, and «إعدادات التسويق» (standard time per task type, minutes per revision, monthly costs → hourly cost). Roles tab: built-in «مدير»/«موظف» + custom roles (create, copy, rename, delete) with a permission matrix by area and department scopes. Members tab: role per member, personal exceptions (by role / grant / deny + scope), permissions in effect. Demo: sample data, nothing saved. |
| `/c/demo/agents` (coming soon: redirects to `/c/demo`) | `modules/agents/components/agents-view.tsx` | «الجراب» — 2 general agents and 6 specialists; metrics, filter, assign-task dialog (adds to the agent's queue), pause/resume. |

## Client portal — `src/app/[locale]/(client)`

| Route | View | Highlights |
|---|---|---|
| `/client-portal` | `modules/marketing/components/client-home.tsx` | Signed-in client `c1`. Brief form (`BriefForm` from `client-portal.tsx`), campaign follow-up and replies. Briefs are stored in localStorage and appear live in the marketing room. |

## API routes

| Route | File | What it does |
|---|---|---|
| `/api/auth/after-sign-in` | `src/app/api/auth/after-sign-in/route.ts` | Every Clerk sign-in/up lands here (`?locale=`, `?invite=`, `?next=` = the company page a shared link asked to sign in for). It creates the pending company, claims invites, redeems a client invite and redirects. Signed out → `/login`. |
| `/sign-in`, `/sign-up` | `src/app/[locale]/sign-in`, `sign-up` | Clerk's default paths; they redirect to `/login` and `/signup`. |

## Backend per module

Each module has `service.ts` (logic), `queries.ts` (reads) and `actions.ts` (Server Actions). All actions return `ActionResult`: `{ ok: true, data }` or `{ ok: false, error }`.

| Module | Queries | Actions |
|---|---|---|
| `auth` | — | `checkInviteCode` (visitor step 1, anon). Everything else (sign-in/up, verification, password, sign-out) is Clerk. |
| `hq` | `getCompanyBySlug`, `listMyCompanies`, `listMembers`, `listDepartments`, `getFloorPlan`, `listActivity` (activity panel) | `updateCompany`, `setMyStatus`, `updateMyProfile`, `inviteMember`, `updateMember`, `removeMember`, department CRUD, `saveFloorPlan` |
| `marketing` | `listClients`, `listBriefs`, `listIdeas`, `listSocialAccounts`, `listCampaigns`, `getClientBudgets`, `getChannelStats`; portal: `getMyClients`, `listClientBriefs`, `listClientCampaigns`, `listClientAccounts` | `createClient`, `updateClient`, `regenerateInviteCode`, `sendBrief`, `setBriefStatus`, `replyToBrief`, `createIdea`, `updateIdea`, `deleteIdea`, `create/update/deleteSocialAccount`, `create/update/deleteCampaign` |
| `operations` | `listOperations`, `getOperationsStats(companyId, days?)` (KPI cards, category counts), `listNotes(companyId, departmentId?)`, `listTasks(companyId, assigneeId?)` | `startOperation` (OP-####), `createNote`, `setNotePinned`, `deleteNote`, `createTask`, `updateTask` (status/assignee/due/priority), `deleteTask` |
| `automation` | `listWorkflows`, `listRuns`, `listFlows`, `getAutomationStats` | `createWorkflow`, `createWorkflowFromTemplate`, `updateWorkflow`, `deleteWorkflow`, `startRun`, `actOnRun` (only the current step's assignee; reuses `applyRunAction`), `createFlow`, `createFlowFromTemplate`, `updateFlow` (enable/disable), `deleteFlow` |
| `sales` | `listOrders`, `listSuppliers` | `createOrder` (SO-/PO-####; optional `workflowId` → approval run), `updateOrder`, `setOrderStatus` (pending starts the run; approved only after the run completes), `createSupplier` |
| `events` | `fetchEvents(companyId?, filter?)` in `api.ts` | `emitEvent()` is called by the other services (not an action). Brief events: `brief.received` (client sent it; logged by a DB trigger), `brief.acknowledged`, `brief.clarification_requested`, `brief.reopened` (team status changes). |
| `agents` | `listAgents` | `createAgent`, `setAgentStatus`, `queueTask`, `completeTask` |
| `academy` | `getMyProgress` | `setLessonDone` |
| `profitability` | `getProfitabilityReport(companyId)` (6 months), `getProfitabilitySettings` | `saveProfitabilitySettings` (owner), `setClientPackage`, `createMeeting`, `createInvoice`, `markInvoicePaid`, `createFreelancerPayment`; tasks take `clientId`/`taskType`/`trackedMinutes`, ideas take `taskId` |
| `permissions` | `getMyPermissions`, `listRoles`, `getPermissionsOverview` (owner), `getRoomAccess(slug)` (sidebar + room guards) | `createRole`, `renameRole`, `deleteRole`, `setRolePermissions`, `assignRole`, `setMemberOverrides` (all owner only) |
| `files` | — | `uploadAttachment` (FormData), `getAttachmentUrl`, `deleteAttachment` |
