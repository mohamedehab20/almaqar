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

### 2026-10-28 — Portal invites by WhatsApp and email
- On each card in «بوابة العملاء» (clients.manage) there are two buttons:
  - **«ابعت الدعوة على واتساب»** opens the chat to the contact's mobile with the company name, a link and the portal code.
  - **«ابعت الدعوة على الإيميل»** sends a Clerk invitation to the contact's email.
- Without a mobile or an email the button is off, with a hint to add it.
- The link opens `/visitor-login?invite=CODE`: the code is checked at once and the sign-in / sign-up form shows; after it they land in their portal.
- The Clerk email helper is shared with employee invites (`src/server/invite-email.ts`).

Files: `src/modules/clients/{actions,service,demo}.ts`, `src/modules/clients/components/client-portal-view.tsx`, `src/modules/auth/components/visitor-login-form.tsx`, `src/app/[locale]/(auth)/visitor-login/page.tsx`, `src/server/invite-email.ts`, `src/modules/hq/actions.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-27 — «بوابة العملاء» is its own room, for every kind of outside person
- **Moved:** out of HR into the sidebar (`/c/<slug>/clients`, permission `clients.view` for Admin and Employee, on/off from «إدارة الأقسام»). The old `/hr/client-portal` address forwards there.
- **Four kinds, one door** (visitor login + portal code):
  - **Client:** of an HQ room or a company department, as before.
  - **Meeting visitor:** as before.
  - **Following an operation:** a supplier or contractor linked to one operation. They see its code, status and steps («دلوقتي هنا»).
  - **Job candidate:** linked to their application. They see the job, their stage, and the interview time.
- **Portal parts per kind:** «متابعة العملية» and «طلب التوظيف» are new parts, each read through a narrow reader (`private.portal_operation` / `portal_application`, no notes or ratings). Fields that do not fit a kind are refused.
- **Marketing and profitability:** both now list real clients only; meeting visitors, operation followers and candidates are no longer included.
- **Migrations:** `0040_portal_kinds` and `0041_portal_kinds_rls` are applied on Supabase (2026-10-27).

Files: `src/app/[locale]/(app)/c/[companySlug]/clients/{layout,page}.tsx`, `hr/client-portal/page.tsx` (forward), `src/modules/clients/{access,service,actions,demo}.ts`, `src/modules/clients/components/client-portal-view.tsx`, `src/modules/marketing/components/{client-home,portal-sections}.tsx`, `src/modules/permissions/catalog.ts`, `src/modules/departments/{rooms.ts,components/departments-view.tsx}`, `src/components/layout/{app-sidebar,app-topbar}.tsx`, `src/modules/hr/components/hr-home.tsx`, `src/modules/{marketing,profitability}/service.ts`, `src/db/schema.ts`, `drizzle/0040_portal_kinds.sql`, `drizzle/0041_portal_kinds_rls.sql`, `tests/db/{portal-access,client-portal}.test.ts`, `scripts/check-routes.mjs`.

### 2026-10-27 — Employee invites by email and WhatsApp
- «رقم الواتساب» is required (no «اختياري») and saved on the member (`members.phone`, migration `0039_member_phone`, applied), in international form (01xxxxxxxxx → 2010…).
- **Email:** the invite is now a Clerk invitation (a link to create the account, landing on `/join`). Before, it used Supabase Auth, which the app no longer uses, so no email was ever sent.
- **WhatsApp:** after adding, one tap opens the chat with the invite message.
- **Pending members:** two buttons, one to email the invite again (`resendInviteEmail`) and one for WhatsApp to the saved number.

Files: `src/modules/hq/{actions,service}.ts`, `src/modules/hr/components/employees-panel.tsx`, `src/lib/phone.ts`, `src/db/schema.ts`, `drizzle/0039_member_phone.sql`, `tests/db/wiring.test.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-27 — The logo keeps you in your HQ
- Inside a company, the logo (sidebar, and top bar on small screens) opens the main hall `/c/<slug>` instead of the public home page, which looked like being signed out. In the public demo it still opens the home page.
- The home page header knows you are signed in: «ادخل مقرك» (to `/join`, which opens your company) instead of «إنشاء حساب» / «تسجيل الدخول».
- In the client portal the logo stays in the portal.

Files: `src/components/layout/{app-sidebar,app-topbar,app-shell,logo}.tsx`, `src/components/marketing/marketing-header.tsx`, `src/modules/marketing/components/client-home.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-27 — The client portal shows what each client is allowed
- **Company side («بوابة العملاء»):** every client has switches «مسموح له في البوابة»: الطلبات، الفواتير، المواعيد، الملفات. A new client starts with all four; a meeting visitor with meetings only. The card shows what is on.
- **Invoices panel:** whoever has profitability.view sees a client's invoices on its card, adds one (amount, due date), and marks it «اتدفعت». There is no online payment yet; payment is recorded by hand.
- **Visitor side (`/client-portal`):** a signed-in client user sees only the allowed parts: requests (send and follow), «فواتيري» (paid, waiting, late), «مواعيدي» (upcoming and past, company time), «ملفاتي» (the signed contract). With nothing allowed, a short message.
- **Enforced in the database** (migrations `0037_client_portal_access`, `0038_client_portal_access_rls`, applied): `clients.portal_access` (only known values); briefs RLS needs «briefs» for portal users; invoices and meetings reach portal users only through `private.portal_invoices` / `private.portal_meetings`, which return their own client's rows when allowed.

Files: `src/modules/clients/{access,service,actions,queries,demo}.ts`, `src/modules/clients/components/client-portal-view.tsx`, `src/modules/marketing/components/{client-home,portal-sections}.tsx`, `src/app/[locale]/(client)/client-portal/page.tsx`, `src/db/schema.ts`, `drizzle/0037_client_portal_access.sql`, `drizzle/0038_client_portal_access_rls.sql`, `tests/db/portal-access.test.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-21 — Signed in without a company: no demo, a real way forward
- **Before:** a signed-in person with no company was stuck on `/join` (the sign-up form never draws for someone already signed in, `/login` sent them back, no sign-out), and could open `/c/demo` with its in-browser data.
- **Now `/join`** links pending invites and opens their company. With none, it shows «لسه مش تابع لشركة»: «أنشئ شركتك» (`createMyCompany` → `create_company` in the database, then opens it), «تحقق تاني» for an invite, and sign out.
- **`/c/demo`, `/signup`, `/client-portal`:** a signed-in person is sent to their own company or to `/join`. The demo stays for guests only.

Files: `src/app/[locale]/(auth)/join/page.tsx`, `src/modules/auth/components/no-company.tsx`, `src/modules/auth/{actions,session}.ts`, `src/app/[locale]/(auth)/signup/page.tsx`, `src/app/[locale]/(app)/c/[companySlug]/layout.tsx`, `src/app/[locale]/(client)/client-portal/page.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-21 — No more demo data inside a real company (QA-001…004)
The four problems from the end-to-end run on production are fixed:
- **QA-001 Main hall:** shows the company's real people with their live presence, its departments, and the latest activity in company time. A company that has not drawn its office yet gets a starting office built from its departments, with a desk per person (`hq/layout.ts` `defaultOffice`). Changing my status is saved (`setMyStatus`).
- **QA-002 Visitor portal:** a signed-in client user sees their own client and briefs (`getMyClients`, `listClientBriefs`). Sending a brief and answering a question are saved (`sendBrief`, `replyToBrief`). «خروج» signs out. Anyone else still sees the demo client.
- **QA-003 Operations, tasks, schedule, notes, automation:** all read and write the database for a real company.
  - **Operations room:** the operations table is built from `workflow_runs` (`operations/rows.ts` `runToRow`); the Analysis cards and the category counts come from real figures; «إضافة عملية» uses `startOperation`.
  - **Notes:** saved, with their files uploaded straight to storage.
  - **Tasks:** both the meetings room and the operations room use `createTask`, `updateTask` and `deleteTask`.
  - **Schedule:** list, create, update and delete are saved, shown in the company's time zone.
  - **Automation:** workflows (builder with uploaded files, templates), runs (only the person at the current step acts), flows (create, template, on/off) and the header figures are real. With no workflows, the room shows an empty state instead of crashing.
  - **Errors:** each change shows at once, is put back if the server refuses it, and a refusal says why.
- **QA-004 Times:** every page now formats times in the company's time zone (`TimeZoneProvider` in the company layout, `useTimeZone()`). Server and browser render the same text, so the hydration error (#418) on approvals, the client portal and recruitment is gone.
- The public demo (`/c/demo`) is unchanged and still runs on sample data.

Files: `src/lib/time-zone.tsx`, `src/modules/hq/{layout,service,queries}.ts`, `src/modules/hq/components/hq-view.tsx`, `src/modules/operations/{rows,demo,service,queries}.ts`, `src/modules/operations/components/{operations-view,tasks-section,notes-section,schedule-section,kpi-cards,meetings-room}.tsx`, `src/modules/automation/{demo,service,queries}.ts`, `src/modules/automation/components/{automation-view,workflows-section,workflow-builder-dialog}.tsx`, `src/modules/marketing/components/client-home.tsx`, the pages of the main hall, operations, automation, meetings and client portal, `tests/db/wiring.test.ts`.

### 2026-10-19 — «التحليلات» room (release 1)
- New room in the sidebar (`/c/<slug>/analytics`), on/off from «إدارة الأقسام». For one month it puts the departments side by side: delivery, on-time completion, overdue work (and how old), median cycle time, open work per person, hours logged vs expected (after approved leave), approvals waiting and operations stuck at a step. Summary tiles, a status per department (on target / below / little data), «محتاج متابعة» with evidence and neutral advice, per-person details, and «إزاي بنحسب؟».
- **Permissions** (migration `0036_analytics`): `analytics.view` opens the room; `analytics.departments` (scoped) chooses which departments' totals appear; `analytics.members` (scoped) shows people. The default Admin role has all three; Employee none.
- **Scope is decided on the server.** The page sends only the month. Hours, leave and approvals are private under RLS, so three readers (`private.analytics_minutes`, `analytics_leave`, `analytics_waiting_approvals`, SECURITY DEFINER) return rows only for departments the caller may analyse.
- **Fairness:** no single score; under 5 items shows «بيانات غير كافية»; bottlenecks never label a person.
- **Applied on Supabase** (2026-10-19, version 20261019193147). The MCP connection was signed out, so it went through `DATABASE_URL` in one transaction and was recorded in `drizzle.__drizzle_migrations` and `supabase_migrations.schema_migrations` like the earlier ones.

Files: `src/modules/analytics/{calc,service,queries,demo}.ts`, `src/modules/analytics/components/analytics-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/analytics/{layout,page}.tsx`, `drizzle/0036_analytics.sql`, `src/modules/permissions/catalog.ts`, `src/modules/departments/{rooms.ts,components/departments-view.tsx}`, `src/components/layout/{app-sidebar,app-topbar}.tsx`, `src/i18n/messages/{ar,en}.json`, `scripts/check-routes.mjs`, `tests/db/analytics.test.ts`.

### 2026-10-19 — Analytics design documented against the real code
- `Almaqar.pdf` (a proposed SRS, ERD, use cases, architecture, API and QA plan for an analytics module) was reconciled with the code and written as files 10–15 in this folder, linked by IDs (ANA-FR, KPI, UC, API, SEC-TC, QA).
- Key mappings: organizations → `companies`, teams → `departments`, roles/scopes → the existing permissions tables, audit log → `events`, REST endpoints → queries and Server Actions.
- Release 1 (next): a read-only «التحليلات» room on existing data. Release 2: CSV/Excel import, jobs, saved dashboards, reports, AI.

Files: `development-almaqar/{10-analytics-srs,11-erd,12-use-cases,13-analytics-architecture,14-api-contracts,15-security-qa}.md`, `README.md`.

### 2026-10-15 — The seeded "demo" company was removed from the live database
- The owner asked to delete it and keep **kira glass** (`/c/kira-glass-7c2n`) as the company for real testing. The row and all its data (7 members, rooms, orders…) were deleted; every table cascades from `companies`, and it had no stored files.
- `/c/demo` still works for everyone as the public demo on mock data (the layout falls back to it when no real company has that slug). `npm run db:seed` can recreate the database copy if it is ever needed.
- Live companies now: `kira-glass-7c2n`, `ismail-7qz4`, `simulation`.

### 2026-10-15 — «الاعتماد» in the meeting room; files on approvals and notes
- **Tab «الاعتماد»** next to «الجدولة» (`/c/<slug>/meetings?tab=approvals`): ask a specific colleague to approve an **action** (a purchase, a payment, overtime…) or a **position** (a reply to a client, a policy…), with details, an answer-by date and up to 6 photos or files (10 MB each, image thumbnails). Views: waiting for me (with a count), my requests, all. The approver approves or rejects with a note; the requester can withdraw while it waits.
- **Saved for real companies:** `approval_requests` (migrations 0034–0035, applied). Only the two people and the owner see a request (RLS); only the approver decides, once; files must sit in the company's `approvals` folder. Events `approval.requested`, `approval.approved`, `approval.rejected`.
- **Uploads go straight from the browser to storage:** the server checks access and hands out a one-time signed upload link (`createUploadTarget` + `uploadFile`), so files are not limited by Vercel's request size. The page gets short-lived links to show and open files.
- **Notes (Operations room):** attach photos or files to a note; they show on the note. The notes screen still runs on demo data, so the files stay in the browser for now; `notes.attachments` and `createNote({ attachments })` are ready for when it is wired.
- **Needs `SUPABASE_SECRET_KEY`:** it is not set on Vercel or in `.env.local` yet, so real uploads answer "storage off" until it is added. Requests without files work.

Files: `src/modules/approvals/{service,actions,queries,demo}.ts`, `src/modules/approvals/components/approvals-section.tsx`, `src/modules/files/{actions,upload,storage}.ts`, `src/modules/operations/components/{meetings-room,notes-section}.tsx`, `src/modules/operations/{service,actions,notes}.ts`, `src/app/[locale]/(app)/c/[companySlug]/meetings/page.tsx`, `src/db/schema.ts`, `drizzle/0034_approvals.sql`, `drizzle/0035_approvals_rls.sql`, `next.config.ts`, `tests/db/approvals.test.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — «إعدادات الربحية» moved into Marketing → «ربحية العملاء»
- The «إعدادات التسويق» tab left the Permissions page. The same form now lives in Marketing → «ربحية العملاء» as a second tab, «إعدادات الربحية», next to «التقرير».
- Owner only, as before (only the owner saves these costs); admins with `profitability.view` see the report without the settings tab. The demo shows both tabs.
- Texts that pointed to «الصلاحيات ← إعدادات التسويق» now point to the new tab.

Files: `src/modules/profitability/components/{profitability-section,settings-form}.tsx`, `src/modules/marketing/components/marketing-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/marketing/page.tsx`, `src/modules/permissions/components/permissions-manager.tsx`, `src/app/[locale]/(app)/c/[companySlug]/permissions/page.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — «بوابة العملاء» tile; HR can no longer be turned off
- **Page:** `/c/<slug>/hr/client-portal`, from the new «بوابة العملاء» tile in HR.
- **Who a client belongs to («تبع مين؟»):** an HQ room (marketing, sales, operations, …), a company department, or «زائر اجتماع» for someone who only comes to a meeting. Filter chips per owner, and stats (clients, visitors, rooms and departments with clients, upcoming meetings).
- **Each card:** status, owner, who handles it, contact person, phone, email, notes, the next meeting, the portal code (copy, renew) and how many people signed in. **«حدد اجتماع»** books a meeting with the client into the company Schedule (a visitor as an appointment), with the person handling it.
- **Existing clients** (all from Marketing) now belong to the Marketing room.
- **Security:** clients were writable by any member; now only `clients.manage` adds, edits or deletes them, and a department must be the company's (RLS).
- **Fix:** the HR room had been turned off by mistake on the demo company from «إدارة الأقسام», which lives inside HR, so there was no way back. It was turned back on in the database, and HR is now always on (`locked`): its switch is disabled, the server refuses it, and an old "off" row is ignored.
- **Database:** `clients.kind`, `room`, `department_id`, `contact_name`, `contact_phone`, `contact_email`, `notes` (migrations 0032–0033, applied).

Files: `src/modules/clients/{service,actions,queries,demo}.ts`, `src/modules/clients/components/client-portal-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/client-portal/page.tsx`, `src/modules/departments/{rooms,service,demo}.ts`, `src/modules/departments/components/departments-view.tsx`, `src/modules/marketing/service.ts`, `src/modules/hr/components/hr-home.tsx`, `src/db/schema.ts`, `drizzle/0032_client_portal.sql`, `drizzle/0033_client_portal_rls.sql`, `tests/db/{client-portal,departments}.test.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — Recruitment («التوظيف»)
- **Page:** `/c/<slug>/hr/recruitment`, from the «التوظيف» tile in HR (now with the working tools).
- **Recruiters (`recruitment.manage`):**
  - Stats: open jobs, candidates in the pipeline, interviews this week, hired in the last 3 months.
  - **«مسار المرشحين»:** columns applied → screening → interview → offer, filtered by job, with hired and rejected counted aside. Each card shows the source, rating, days in the stage (red after a week) and the next interview.
  - **A candidate's panel:** contact, CV link, 1–5 stars, notes, one step forward or back, book or move the interview (goes into the company Schedule as an «مقابلة», with the job's hiring manager), reject with a reason, reopen, and **hire** (optionally adding them to the team in Employee management with the job's title and department).
  - **«الوظائف»:** add / edit (title, department, hiring manager, type, work place, people needed, salary range, description, requirements), open / pause / close, delete, and candidates per stage. A job closes by itself when all its openings are hired.
- **Everyone else:** sees the open jobs, refers someone to one («رشّح حد»), and follows their referrals in «ترشيحاتي». Candidate data stays private to recruiters.
- **Database:** `job_openings` and `candidates` with RLS (migrations 0030–0031, applied). New permission `recruitment.manage` (Admin roles). New events `candidate.added`, `candidate.hired`.
- **Demo:** five jobs and fourteen candidates across every stage.

Files: `src/modules/recruitment/{pipeline,service,actions,queries,demo}.ts`, `src/modules/recruitment/components/recruitment-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/recruitment/page.tsx`, `src/modules/hr/components/hr-home.tsx`, `src/db/schema.ts`, `drizzle/0030_recruitment.sql`, `drizzle/0031_recruitment_rls.sql`, `src/modules/permissions/catalog.ts`, `src/modules/events/constants.ts`, `tests/db/recruitment.test.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — «إدارة الأقسام»: HQ rooms and company departments in one page
- **Page:** `/c/<slug>/hr/departments`, from the «إدارة الأقسام» tile in HR (now with the working tools).
- **«أقسام المقر»:** every room of the sidebar (HR, operations, automation, marketing, meetings, and the coming-soon accounts, sales, Al Jarab, archive) with its state (on, off, soon), an on / off switch and a manager. A room turned off is hidden from the sidebar for everyone and its pages show «القسم ده مقفول». Coming-soon rooms cannot be turned on; their manager can be chosen already. Needs `company.settings`.
- **«أقسام الشركة»:** add a department (name, colour, manager), rename, recolour, choose the manager, stop / restart (a stopped department keeps its people but is not offered in the add-employee form), delete (its people stay, without a department). Needs `departments.manage`.
- **Database:** `company_rooms` (on / off and manager per room; no row = on) and `departments.active` / `departments.manager_id` (migrations 0028–0029, applied). Departments were writable by any member through RLS; now only with `departments.manage`. A manager must belong to the company (also checked in RLS).
- **Demo:** the demo departments and rooms with managers; changes stay in the browser.

Files: `src/modules/departments/{rooms,service,actions,queries,demo}.ts`, `src/modules/departments/components/departments-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/departments/page.tsx`, `src/modules/hq/{service,actions,mock}.ts`, `src/modules/permissions/{queries.ts,components/room-guard.tsx}`, `src/components/layout/app-sidebar.tsx`, `src/modules/hr/components/{hr-home,employees-panel}.tsx`, `src/db/schema.ts`, `drizzle/0028_departments_rooms.sql`, `drizzle/0029_departments_rooms_rls.sql`, `tests/db/departments.test.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — HR home: working tools first, «إدارة الموظفين» gets its own page
- **«إدارة الموظفين»:** the employees panel (company code, team, add / remove) moved off the HR home to `/c/<slug>/hr/employees`, opened from its own tile.
- **Order:** the three working tools come first (إدارة الموظفين، الإجازات، ساعات العمل); the other 14 are dimmed with a «قريباً» badge.
- **Removed:** the «الصلاحيات» tile (permissions stay in the sidebar).

Files: `src/modules/hr/components/hr-home.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/page.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/employees/page.tsx`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — Working hours («ساعات العمل»)
- **Page:** `/c/<slug>/hr/work-hours` (`?month=YYYY-MM`, last six months), opened from the «ساعات العمل» tile in HR.
- **«ساعاتي» (everyone):** a clock-in / clock-out button with the running time; the month's hours worked, hours expected, the difference (extra or short), late days and absent days; every day of the month with status (present, late, absent, leave, weekend, today), in, out and hours; hours added by hand (marked «يدوي», with a note), and removing them.
- **«ساعات الفريق» (`hours.manage`):** who is working now; per employee: days present, late, absent, leave, hours worked, expected and the difference; click a row for their days, to add or remove hours.
- **«مواعيد العمل»:** start and end of the day, break, grace for lateness, time zone. The weekend comes from the leave policy.
- **Rules (`calc.ts`, shared with the demo):** a session counts on the local day it started; expected = working days until yesterday, minus approved leave, × daily hours; today never counts as short; late = first clock-in after start + grace.
- **Permission:** new `hours.manage` (scoped by department), given to every Admin role. Clocking in and adding your own hours needs none. A lead with `hours.manage` also sees their team's approved leave.
- **Database:** `work_sessions` (one running session per person) and `work_settings`, with RLS (migrations 0026–0027, applied to Supabase).
- **Demo:** the demo team's month with habits (early and long days, often late, short days, an absence), leave from the leave demo, and people clocked in during the day.

Files: `src/modules/hours/{calc,service,actions,queries,demo}.ts`, `src/modules/hours/components/hours-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/work-hours/page.tsx`, `src/modules/hr/components/hr-home.tsx`, `src/db/schema.ts`, `drizzle/0026_work_hours.sql`, `drizzle/0027_work_hours_rls.sql`, `src/modules/permissions/catalog.ts`, `tests/db/hours.test.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-15 — Leave: requests, balances, approvals and policy («الإجازات»)
- **Page:** `/c/<slug>/hr/leave`, opened from the «الإجازات» tile in HR (the first HR tool with its own page).
- **Every employee («إجازاتي»):** a balance card per type (annual, casual, sick, unpaid) with days left, used and pending; a request form that counts working days and shows the balance after; their requests with status, the manager's name and note, and cancel (while pending, or approved and not started).
- **Managers («طلبات الفريق»):** who is off today; waiting / approved / all, by department; approve, or reject with a reason. Each request shows the employee's balance and colleagues from the same department away on the same days.
- **«أرصدة الموظفين»:** left / allowance per employee and type for the chosen year; a custom allowance per person (marked «خاص»), and reset to the default.
- **«سياسة الإجازات»:** yearly days per type (empty = no limit) and the weekend days. Defaults: 21 annual, 6 casual, 15 sick, unpaid with no limit; Friday and Saturday off.
- **Rules on the server:** working days only; no overlapping requests; no request or approval beyond the balance (pending days are reserved); a request across New Year counts in each year.
- **Permission:** new `leaves.manage` (scoped by the employee's department), given to every Admin role. Requesting needs no permission. The policy needs an all-departments grant.
- **Database:** `leave_requests`, `leave_balances` and `leave_settings` with RLS (migrations 0024–0025, applied to Supabase). New events: `leave.approved`, `leave.rejected`, `leave.cancelled`.
- **Demo:** the demo team with sample requests built around today; changes stay in the browser.

Files: `src/modules/leave/{calc,service,actions,queries,demo}.ts`, `src/modules/leave/components/leave-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/leave/page.tsx`, `src/modules/hr/components/hr-home.tsx`, `src/db/schema.ts`, `drizzle/0024_leave.sql`, `drizzle/0025_leave_rls.sql`, `src/modules/permissions/catalog.ts`, `src/modules/events/constants.ts`, `src/server/errors.ts`, `tests/db/leave.test.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-14 — «غرفة الاجتماعات» page (schedule + task management)
- **Sidebar:** «اجتماعات» now opens `/c/<slug>/meetings` (no longer "coming soon"), with the tabs «إدارة المهام» and «الجدولة» side by side. «مهام» opens the same room on the tasks tab (`?tab=tasks`).
- **The schedule** is the one from the Operations room: meetings, appointments, trips outside and interviews, with full details per item. It stays in the Operations room too.
- **Access:** the room opens with `operations.view` (`ROOM_VIEW.meetings`) and is guarded like the other rooms.
- **Demo data** is built in the browser, so dates follow the viewer's clock.
- **Checked:** route checks (ar/en, both tabs) and a real browser.
Files: `src/app/[locale]/(app)/c/[companySlug]/meetings/{page,layout}.tsx`, `src/modules/operations/components/meetings-room.tsx`, `src/components/layout/{app-sidebar,app-topbar}.tsx`, `src/modules/permissions/catalog.ts`, `scripts/check-routes.mjs`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-14 — Login: the skeleton stays until the real form is drawn
- **Found by a load test:** a cold browser on the live site, polling every 150 ms. The first fix (`ClerkLoading`) hid the skeleton as soon as Clerk's script was ready, but the form's own code loads after that. That left the guest button alone for 3–4 s, and the form took up to 12 s on a first visit.
- **Now:**
  - `FormGate` keeps the skeleton until Clerk has drawn its first field (watched with a `MutationObserver`).
  - If Clerk fails to load, `ClerkFailed` shows a message with a reload button.
  - The layout preconnects to Clerk's Frontend API (sent as an HTTP `Link` header).
  - The guest button no longer prefetches the demo company in the background.
- **Test (local production build):** `/login`, `/employee-login` and `/en/login` normally, and `/login` on a throttled slow network. The guest button was alone for 0 ms in every run.
Files: `src/modules/auth/components/{clerk-auth,guest-button}.tsx`, `src/lib/clerk.ts`, `src/app/[locale]/layout.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Login: no more "guest only" flash while Clerk loads
- **The problem:** for a few seconds on the sign-in and sign-up pages only the «ادخل كضيف» button showed, because Clerk's form loads in the browser after the page.
- **Now:** a skeleton of the form (title, fields, button) holds its place (`ClerkLoading`) and is swapped for the real form when Clerk is ready (`ClerkLoaded`). This covers every page that uses `ClerkSignIn` / `ClerkSignUp`.
- **Checked:** in a real browser, at 0.4 s and after loading.
Files: `src/modules/auth/components/clerk-auth.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Company schedule in the Operations room («الجدولة»)
- **Button** next to «إدارة المهام».
- **Kinds:** company meetings, appointments, trips outside the office (client visits, suppliers, government offices) and interviews.
- **List:** grouped by day (today / tomorrow / dates), upcoming or past, filter by kind with counts, "only mine", and a «تعارض» badge when someone is booked twice.
- **Each item opens its details:** type, time and duration, place / full address / meeting link, transport (company car, own car, taxi, online), purpose, notes, organizer, attendees, client, and the outside contact (name, role, phone you can tap; the candidate for interviews). Actions: mark done, cancel, reopen, delete.
- **Add form:** the fields change with the kind (contact and phone for trips, appointments and interviews; transport for trips; position for interviews). Attendees are picked from the team.
- **Backend:**
  - The `meetings` table (from client profitability) became the schedule: kind, status, location, organizer, attendees, contact, purpose, transport and notes (migration 0023, applied to Supabase).
  - `listSchedule`, `createScheduleItem`, `updateScheduleItem`, `deleteScheduleItem`.
  - Rules: attendees and the client must belong to the company. The organizer edits their own items; others need `tasks.manage`.
  - Items linked to a client count toward its profitability unless cancelled.
- **Screen:** demo data, like the rest of the room.
- **Checks:** tests 42/42 (new schedule test, plus "cancelled visits do not count" in profitability), smoke test OK, advisors clean, checked in a real browser.
Files: `src/modules/operations/{schedule.ts,components/schedule-section.tsx,components/operations-view.tsx,service.ts,actions.ts,queries.ts}`, `src/modules/profitability/service.ts`, `src/db/schema.ts`, `drizzle/0023_schedule.sql`, `tests/db/{services,profitability}.test.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Client portal: «الفيديوهات المرسلة»
- **New tab** in the team's client portal (Marketing → «بوابة العميل») listing everything sent to clients for approval, newest first.
- **Each delivery shows:** the client, format, title, sent date, the owner, revision rounds, the hook, and the client's feedback when changes were requested. Its files list name, duration, aspect, size and version, plus the best lab-test result (views, completion, engagement) when it came from the lab.
- **Header:** a filter by client, counts by status (awaiting / approved / changes), and a badge on the tab for items awaiting the client.
- **From the lab:** an idea sent to the client carries its tested versions as the files.
- **Data:** demo only (`marketing/mock.ts`: `SentVideo`, `Idea.clientId`, `Idea.videos`, `delivery.feedback` / `rounds`). The three demo deliveries now belong to real demo clients.
- **Checked:** in a real browser.
Files: `src/modules/marketing/components/{sent-videos,client-portal,marketing-view}.tsx`, `src/modules/marketing/mock.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Shared company links ask to sign in
- **The problem:** a company link copied to another browser (not signed in) opened the guest demo instead of asking to sign in. The demo company is also the product owner's real company.
- **Now:** every company page (`/c/<slug>/…`) without a sign-in goes to `/login?next=<that page>`, and after signing in it opens that same page again.
- **Guest mode** opens only from the «ادخل كضيف» button. It sets a session cookie (`almaqr_guest`) that dies when the browser closes.
- **Checked:** route checks (new: 4 shared-link cases) and a real browser (shared link → login; guest button → demo; same browser → demo stays open).
Files: `src/proxy.ts`, `src/lib/guest.ts`, `src/modules/auth/components/{guest-button,company-login-form}.tsx`, `src/app/[locale]/(auth)/login/page.tsx`, `src/app/api/auth/after-sign-in/route.ts`, `src/app/[locale]/(app)/c/[companySlug]/layout.tsx`, `scripts/check-routes.mjs`.

### 2026-10-13 — Client profitability (Marketing → «ربحية العملاء»)
- **What the owner sees, per client and month:**
  - Margin in green (above 40 %), yellow (15–40 %) or red (below 15 %).
  - Effective income per hour.
  - Package use, shown as «سلّمت 18 من 12».
  - Revisions per post against the contract limit.
  - Average days of late payment.
  - Profit.
  - Filters by month and sector, and sorting on every column.
- **Clicking a client opens:**
  - Hours split into tasks / revisions / meetings.
  - Income, team cost, freelancers and profit.
  - A comparison with the previous five months.
- **Alerts:**
  - The client is above 100 % of the package.
  - The margin is below 15 %.
  - Revisions are above what the contract allows.
  - Example: «عيادات نور وصل 150% من الباقة الشهر ده، وهامش ربحه نزل لـ6%».
- **Advice for red clients, by main cause:**
  - Too many revisions.
  - More work than the package (offer an upgrade at the same price per piece).
  - Too many meetings.
  - Price too low: the fee for a 40 % margin, with the numbers.
  - Red three months in a row: "consider ending".
- **Average profitability by sector**, for pricing new clients.
- **«بيانات غير كافية»** shows instead of numbers when a month has no invoice, no recorded work, or no cost settings.
- **Setup:** Permissions → new tab «إعدادات التسويق» (owner only). It holds the standard time per task type (post 1.5 h, reel 4 h, carousel 2 h…), the minutes one revision adds, and salaries + rent + tools ÷ monthly hours = internal hourly cost.
- **Access:** the new permission `profitability.view` is in the Admin role, not in Employee. The screen is computed on the server and is not sent to anyone else.
- **Demo:** 5 sample clients, one per situation: healthy, over the package, too many revisions (red for 6 months), too many meetings, and insufficient data (with an underpriced month earlier).

Tests 41/41 (6 new in `tests/db/profitability.test.ts`). The smoke test passes, and the advisors are clean after splitting the overlapping policies (0021–0022). Screens were checked in a real browser.
Files: `src/modules/profitability/{calc,service,actions,queries,demo}.ts`, `src/modules/profitability/components/{profitability-section,settings-form}.tsx`, `src/modules/marketing/components/marketing-view.tsx`, `src/app/[locale]/(app)/c/[companySlug]/{marketing,permissions}/page.tsx`, `src/modules/permissions/{catalog.ts,components/permissions-manager.tsx}`, `src/modules/operations/{service,actions}.ts`, `src/modules/marketing/{service,actions}.ts`, `src/db/schema.ts`, `drizzle/0019_profitability.sql`–`0022_permission_policies_split.sql`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Client contracts in Marketing → Clients
- **New «العقد» column** after the status: a red **PDF** button opens the client's contract in a new tab. A client without one shows «مفيش عقد».
- **Demo:** four sample clients open `public/demo/contract-sample.pdf`.
- **Backend:**
  - `clients.contract_path` (migration 0018, applied to Supabase).
  - Upload with `uploadAttachment` (new folder `contracts`), save with `updateClient({ contractPath })`, open with `getAttachmentUrl`.
  - The path must be in the client's company folder (`<company_id>/contracts/…`), and saving needs `clients.manage`.
- **Proxy fix:** `.pdf` files are no longer sent through locale routing, which returned 404.

Tests 35/35 (the contract path check is in the client portal test). Smoke test OK, security advisors clean, route checks pass.
Files: `src/modules/marketing/{components/sections.tsx,sections-mock.ts,service.ts,actions.ts}`, `src/modules/files/actions.ts`, `src/db/schema.ts`, `drizzle/0018_client_contracts.sql`, `src/proxy.ts`, `public/demo/contract-sample.pdf`, `tests/db/services.test.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Automation room: «تصميم مسار عمل» moved to the header
The button that opens the approval-workflow builder now sits in the room header next to «إنشاء مسار عمل مؤتمت جديد», instead of inside the workflows section. A new workflow opens selected in the workflows section (switching there from the flows or templates view).
Files: `src/modules/automation/components/{automation-view,workflows-section}.tsx`.

### 2026-10-13 — Sales and Al Jarab back to "coming soon"
- **Sidebar:** «المبيعات» and «الجراب» are dimmed, with the "coming soon" toast.
- **Their URLs** (`/c/<slug>/sales`, `/c/<slug>/agents`) redirect to the main hall (307, in `src/proxy.ts`).
- **The Compass guide** «كلّف وكيل بمهمة» was removed.
- **Kept:** the pages, services, tables and permissions stay in the code for when they open again.

Files: `src/components/layout/app-sidebar.tsx`, `src/proxy.ts`, `src/app/[locale]/(app)/c/[companySlug]/{sales,agents}/layout.tsx`, `src/modules/academy/mock.ts`, `scripts/check-routes.mjs`.

### 2026-10-13 — Permissions managed by the owner
- **New page «صلاحيات»** (`/c/<slug>/permissions`, under «إدارة الأقسام»), owner only. The demo shows it on sample data without saving.
  - **Roles tab:** the built-in roles «مدير» (every permission) and «موظف» (open the rooms, add things, use agents), plus custom roles the owner creates (empty or copied from another role), renames and deletes. Each role has a permission matrix by area: HR, operations, automation, sales, marketing, Al Jarab and company.
  - **Department scopes:** «إضافة/تعديل/إزالة موظفين», «تثبيت وحذف ملاحظات الآخرين», «إدارة مهام الآخرين» and «اعتماد الطلبات» can be limited to chosen departments.
  - **Members tab:** each member's role, plus personal exceptions per permission (by role / grant / deny, with a scope), and how many permissions are in effect.
- **Closed rooms:** a room without its «فتح …» permission disappears from the sidebar, and its URL shows «مالكش صلاحية هنا».
- **Server:** every action checks its permission (`requirePermission`); the old fixed admin/employee checks are gone.
- **HR → Employees:** the role column shows the member's role, the owner picks a role when adding, and add/remove follow the permissions.
- **Database:**
  - Migrations 0016–0017, applied to Supabase: `roles`, `role_permissions`, `member_permission_overrides`, `members.role_id` and `orders.created_by_id`.
  - `private.has_permission` decides each check.
  - Existing companies got both roles: admins → «مدير», employees → «موظف», so nobody lost access.
- **Checks:** tests 35/35 (7 new in `tests/db/permissions.test.ts`). The smoke test on Supabase now covers permissions. Security advisors are clean. Build and route checks pass.

Files: `src/modules/permissions/{catalog,service,actions,queries}.ts`, `src/modules/permissions/components/{permissions-manager,room-guard}.tsx`, `src/server/permissions.ts`, `src/app/[locale]/(app)/c/[companySlug]/permissions/page.tsx`, `src/app/[locale]/(app)/c/[companySlug]/*/layout.tsx`, every `modules/*/service.ts`, `src/components/layout/{app-shell,app-sidebar,app-topbar}.tsx`, `src/modules/hr/components/employees-panel.tsx`, `src/db/schema.ts`, `drizzle/0016_permissions.sql`, `drizzle/0017_permissions_logic.sql`, `tests/db/*`.

### 2026-10-13 — Task management in the Operations room
- **Button:** "إدارة المهام" sits next to Notes and shows the number of open tasks.
- **Board:** opens with three columns (to do / in progress / done).
- **Add form:** title, owner, due date, priority, and an optional linked operation.
- **"Mine / all" filter.**
- **Task cards:** buttons to move a task, overdue tasks first and in red, priority colors, and delete.
- **Backend:**
  - `tasks` table (migrations 0014–0015, applied to Supabase).
  - RLS: members of the company.
  - The assignee must be in the same company. Done sets `completed_at` and logs `task.completed`.
  - Delete: creator, assignee or owner/admin.
- **Screen:** uses demo tasks until it is wired, like the rest of the room.

Tests 28/28, smoke test OK, advisors clean.
Files: `src/modules/operations/{tasks.ts,components/tasks-section.tsx,components/operations-view.tsx,service.ts,actions.ts,queries.ts}`, `src/db/schema.ts`, `drizzle/0014_tasks.sql`, `drizzle/0015_tasks_rls.sql`, `tests/db/services.test.ts`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Continue as a guest
- **"ادخل كضيف" button:** on `/signup`, `/login` and `/employee-login`. It opens the public demo company (`/c/demo`, mock data) without an account.
- **Guest banner:** while not signed in, every company page shows "you are browsing as a guest, nothing is saved", with buttons to create an account or sign in.

Files: `src/modules/auth/components/guest-button.tsx`, `src/components/layout/guest-banner.tsx`, `src/components/layout/app-shell.tsx`, `src/modules/auth/components/{signup-form,company-login-form,login-form}.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Employee invites on WhatsApp
- **After adding an employee:** HR → Employees shows "Send the invite on WhatsApp". It opens a `wa.me` link with a ready message (name, company, the email to sign up with, the `/join` link in the current language).
- **Optional phone field:** opens that chat directly. Local Egyptian numbers `01…` get the country code 20.
- **Waiting employees:** each one has a WhatsApp button to resend the invite.
- **Instruction text:** updated, since sign-in is by account now, not by company code.

The phone is not stored.
Files: `src/modules/hr/components/employees-panel.tsx`, `src/app/[locale]/(app)/c/[companySlug]/hr/page.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — First real account on production
The product owner signed up on production: company `kira-glass-7c2n` was created, and they also became the owner of `demo` through the email invite. A full retest passed (see 09-test-report).
Files: `development-almaqar/09-test-report.md`.

### 2026-10-13 — Production is live with Clerk + Supabase
- **Database password:** reset via the Supabase Management API and written to `DATABASE_URL`, without printing it.
- **Vercel:** the CLI linked the project, all env vars were added (secrets as Secret), and production was redeployed.
- **Verified on https://almaqar-theta.vercel.app:**
  - An owner signs in and their company is created and opened.
  - An invited employee signs in and lands in that company.
  - The test data was removed afterwards.

Files: docs only (`development-almaqar/08-backend-tasks.md`, `01-getting-started.md`).

### 2026-10-13 — Clerk replaces Supabase Auth
- **Sign-in and sign-up:** Clerk's components, in Arabic and English, sit inside our pages:
  - `/login` and `/employee-login`: sign in.
  - `/signup`: our company step, then Clerk sign-up.
  - `/join`: an invited employee creates their account.
  - `/visitor-login`: invite code, then Clerk.
- **New route `/api/auth/after-sign-in`:** creates a new owner's company, claims invites, redeems client invites and opens the company.
- **Database (migration 0013, applied to Supabase):** `user_id` is text, and the rules use `private.uid()`.
- **Server side:** `withUser` takes the user from Clerk. File access is checked in the database before using the Storage secret key.
- **Removed:** the Supabase Auth pages, the email-link route and the auth actions.

Tests 27/27, the smoke test on Supabase passes and the security advisor is clean. Without Clerk keys the site stays the public demo.
Files: `drizzle/0013_clerk_user_ids.sql`, `src/db/schema.ts`, `src/proxy.ts`, `src/app/[locale]/layout.tsx`, `src/lib/clerk.ts`, `src/server/{session,context}.ts`, `src/app/api/auth/after-sign-in/route.ts`, `src/modules/auth/*`, `src/modules/files/actions.ts`, `src/components/layout/app-topbar.tsx`, `tests/db/{rls.test.ts,smoke-supabase.sql}`, `scripts/check-routes.mjs`.

### 2026-10-13 — Auth forms no longer fall back to the demo silently
The product owner signed up on a server without Supabase keys (Vercel). The form opened `/c/demo`, so the account looked created while nothing was saved; the Supabase auth logs had no sign-up request. Sign-up and both logins now show a clear "real sign-in isn't enabled on this server, nothing was saved" message.
Files: `src/modules/auth/components/{company-login-form,login-form,signup-form}.tsx`, `src/i18n/messages/{ar,en}.json`.

### 2026-10-13 — Real sign-in and employee management
- **Sign-in and sign-up:** sign-up, company login and employee login now call the backend and open the real company. Errors are shown in Arabic and English.
- **New pages:** `/join` (an invited employee activates their account), `/forgot-password` and `/reset-password`.
- **Company layout:** loads the signed-in member's company. Signed out, only `/c/demo` stays public; other slugs → `/login`.
- **Topbar:** shows a sign-out button.
- **HR → Employees:** company code, team list, add and remove employees.

Needs `DATABASE_URL` in `.env.local` to work against Supabase.
Files: `src/modules/auth/components/{company-login-form,login-form,signup-form,account-forms}.tsx`, `src/modules/auth/use-auth-action.ts`, `src/modules/auth/actions.ts` (`signUpEmployee`), `src/app/[locale]/(auth)/{join,forgot-password,reset-password}/page.tsx`, `src/app/[locale]/(app)/c/[companySlug]/{layout,hr/page}.tsx`, `src/modules/hq/queries.ts` (`getSignedInCompany`), `src/components/layout/{app-shell,app-topbar}.tsx`, `src/modules/hr/components/{hr-home,employees-panel}.tsx`, `src/i18n/messages/{ar,en}.json`, `scripts/check-routes.mjs`.

### 2026-10-13 — Account self-service backend (task C4)
New actions:
- "Forgot password" email, which does not reveal which emails exist.
- Change password.
- Edit your own account name and phone.
- Edit your own name and title in a company. The database guard now allows this; role and department stay with admins.

Reset links land on `/reset-password`, a page still to be built. Migration 0012 is applied to Supabase.
Files: `drizzle/0012_self_profile.sql`, `src/modules/auth/actions.ts`, `src/modules/hq/{service,actions}.ts`, `src/app/api/auth/confirm/route.ts`, `tests/db/{rls,services}.test.ts`.

### 2026-10-13 — Automated flows backend (task C3)
Automated flows (trigger → condition → action) are stored, created from templates, enabled and disabled, and counted when they run. The Automation room header figures are computed.

Migrations 0010–0011 are applied to Supabase, the demo flows are added there, and a new test covers it.
Files: `src/db/schema.ts`, `drizzle/0010_automation_flows.sql`, `drizzle/0011_automation_flows_rls.sql`, `src/modules/automation/{service,actions,queries}.ts`, `src/db/seed.ts`, `tests/db/services.test.ts`.

### 2026-10-13 — Marketing sections backend (task C2)
New tables: social accounts and campaigns, with per-channel metrics. Client budgets and channel stats are computed from them. The client portal can read its own campaigns.

Migrations 0008–0009 are applied to Supabase, the demo data is added there, and a new test covers it.
Files: `src/db/schema.ts`, `drizzle/0008_marketing_sections.sql`, `drizzle/0009_marketing_sections_rls.sql`, `src/modules/marketing/{service,actions,queries}.ts`, `src/db/seed.ts`, `tests/db/services.test.ts`.

### 2026-10-13 — Activity feed and operations KPIs (task C1)
Events now record their actor. The main hall activity panel and the Operations KPI cards have real queries:
- `listActivity`, which writes bilingual, gender-neutral lines.
- `getOperationsStats`.

Migration 0007 is applied to Supabase.
Files: `src/db/schema.ts`, `drizzle/0007_event_actor.sql`, `src/modules/events/service.ts`, `src/modules/operations/{service,queries}.ts`, `src/modules/hq/queries.ts`, `tests/db/services.test.ts`.

### 2026-10-13 — Full test run: frontend, backend, live database
Everything passed:
- **Backend:** 22/22 tests, lint, types and build.
- **Live database:** migrations, advisors, the RLS smoke test, data integrity for both companies, and the anonymous API probe (0 rows from all 18 tables).
- **Frontend:** 30 pages in both languages, headless rendering with 0 console errors, and screenshots reviewed.

Open points: a mobile clipping point in the main hall, and the direct app → database path (needs `DATABASE_URL`).
Files: `development-almaqar/09-test-report.md`, `scripts/check-routes.mjs`, `package.json`.

### 2026-10-12 — Demo data and a simulated day live on Supabase (tasks A4, A6)
- **`demo` company:** loaded from the real seed and owned by the product owner's email.
- **`simulation` company:** produced by a full working day run through the real services as real users. Covers invites, an approval workflow that approves PO-1001, the client portal brief with a clarification, an idea, a note, an agent task and an operation.

Both are now on Supabase. The simulation caught a duplicated event name (`brief.received` meant two things), now fixed.
Files: `scripts/seed-to-sql.mts`, `scripts/simulate-day.mts`, `src/modules/marketing/service.ts`, `tests/db/services.test.ts`, `package.json`.

### 2026-10-12 — Tests for the action layer (task B2)
Unit tests cover input validation, error-code mapping (including errors wrapped by Drizzle) and the shared Zod helpers. `npm run test:db` now runs every test under `tests/` (22 tests).
Files: `tests/server/actions.test.ts`, `package.json`.

### 2026-10-12 — Orders go through an approval workflow (task B1)
An order can name an approval workflow:
- Becoming pending starts the run.
- Finishing the run approves the order; a run closed by rejection cancels it.
- An order with a workflow cannot be approved by hand.

Applied to Supabase (migration 0006) and covered by a new service test.
Files: `src/db/schema.ts`, `drizzle/0006_order_approval.sql`, `src/modules/sales/{service,actions}.ts`, `src/modules/automation/service.ts`, `tests/db/services.test.ts`.

### 2026-10-12 — RLS verified on the live Supabase database (task A3)
A rolled-back SQL smoke test proves the access rules on the real project:
- tenant isolation
- the member guard
- numbering
- the client portal and its brief event
- append-only events
- storage folders
- anon lockout

No data is left behind.
Files: `tests/db/smoke-supabase.sql`.

### 2026-10-12 — Supabase advisors clean (task A2)
The security advisor is down from 3 warnings to 0. Changes:
- Pinned `search_path` on two helpers.
- Moved the `SECURITY DEFINER` RPCs to `private`, behind invoker wrappers.
- Added 25 foreign-key indexes.
- Merged duplicate policies.
- Briefs must stay inside their client's company.

Applied to Supabase, and covered by a new RLS test.
Files: `drizzle/0004_fk_indexes.sql`, `drizzle/0005_advisor_fixes.sql`, `src/db/schema.ts`, `tests/db/rls.test.ts`.

### 2026-10-12 — Database live on Supabase (task A1)
The schema, RLS, functions, storage bucket and realtime publication now exist on the Supabase project `rosifnxvdpwkvpqzguzj`. They were applied through the Supabase MCP and recorded for Drizzle, so `npm run db:migrate` will not re-apply them. The task board is in `08-backend-tasks.md`.
Files: `development-almaqar/08-backend-tasks.md` (no code change).

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
