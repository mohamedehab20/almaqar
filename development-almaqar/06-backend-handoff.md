# 06 — Backend handoff

Everything the frontend still fakes. **The backend for every row now exists.** What is left is wiring each screen to it: replace the mock with the query/action listed, then delete the row and its `TODO(backend)` comment.

Find the remaining places with:

```bash
grep -rn "TODO(backend)" src
```

## Wiring checklist

| Area | Where (UI) | Backend ready |
|---|---|---|
| Rooms' data | every room view | The layout already loads the real company (`getSignedInCompany`). Each room still needs its own queries/actions wired (see the rows below). |
| Visitor login | `visitor-login-form.tsx` | Done: invite code → Clerk → after-sign-in redeems it. Still to do: `client-home.tsx` must read the visitor's client (`getMyClients`) instead of `DEMO_CLIENT_ID`. |
| Signed-in client | `modules/marketing/components/client-home.tsx` (`DEMO_CLIENT_ID`) | `marketing/queries.ts` `getMyClients()` |
| Briefs | `modules/marketing/briefs-store.ts`, `client-portal.tsx` | `listBriefs` / `listClientBriefs`, plus `sendBrief`, `setBriefStatus`, `replyToBrief`. Realtime: subscribe to `briefs` with the browser client. A `brief.received` event is logged automatically. |
| Marketing ideas | `marketing-view.tsx` | `listIdeas`, `createIdea` (from a brief: pass `briefId`), `updateIdea` (stage, ratings, versions, delivery) |
| Operations | `operations-view.tsx` | `operations/queries.ts` `listOperations`, and the `startOperation` action (returns OP-####). The UI row shape (`WorkflowRow`) is built from the run plus its members. |
| Sent videos (client portal) | `sent-videos.tsx` (demo ideas with `videos`) | `listIdeas` (stage delivery, `delivery`) + the files in storage (`uploadAttachment`). Missing in the database: a list of sent files per idea (like `workflows.attachments`), and feedback/rounds on `delivery`. |
| Client profitability | `profitability-section.tsx` (wired: real report for owner/admins, demo report in /c/demo) | Missing screens to feed it: meetings (calendar), invoices, freelancer payments, client package, and client/type/timer on the task board. The actions exist: `createMeeting`, `createInvoice`, `markInvoicePaid`, `createFreelancerPayment`, `setClientPackage`, `createTask/updateTask({ clientId, taskType, trackedMinutes })`, `updateIdea({ taskId })`. |
| Client contracts | `sections.tsx` → `ClientsSection` (`contractUrl` in `sections-mock.ts`) | Upload: `uploadAttachment({ folder: "contracts" })` → `updateClient({ contractPath })`. Open: `getAttachmentUrl({ path: client.contractPath })` (10-minute signed link). |
| Permissions | `permissions-manager.tsx` (wired: real data for the owner, sample data in the demo) | `getPermissionsOverview`, `createRole`, `renameRole`, `deleteRole`, `setRolePermissions`, `assignRole`, `setMemberOverrides`. Room screens still on mock data should hide buttons with `getMyPermissions` once wired; the server already refuses. |
| Operations tasks | `tasks-section.tsx` (demo tasks in `operations/tasks.ts`) | `listTasks`, `createTask`, `updateTask`, `deleteTask` |
| Operations notes | `notes-section.tsx` | `listNotes(companyId, departmentId?)`, `createNote`, `setNotePinned`, `deleteNote`. Notify the audience from `note.created` events (realtime). |
| Automation flows | `automation-view.tsx` | `automation/actions.ts`: `createWorkflow`, `createWorkflowFromTemplate`, `startRun`, `actOnRun` |
| Workflow attachments | `workflow-builder-dialog.tsx` | `files/actions.ts` `uploadAttachment` (folder `workflows`) → pass the result in `attachments`; open with `getAttachmentUrl` |
| Sales orders | `sales-view.tsx` | `listOrders`, `listSuppliers`, `createOrder` (number from DB; pass `workflowId` to require approval), `setOrderStatus`, `createSupplier`. An order with a workflow shows its run (`runId`) and is approved by the run, not by a button. |
| Events | `modules/events/api.ts` | Done: `fetchEvents(companyId)` reads the table when signed in. Callers still need to pass `companyId`. |
| AI agents | `modules/agents/components/agents-view.tsx` | `listAgents`, `queueTask`, `setAgentStatus`, `createAgent`. Running tasks needs the agent runtime (future Python service), which consumes `agent.task_queued` events and calls `completeTask`. |
| Academy progress | `modules/academy/components/academy-view.tsx` | `getMyProgress`, `setLessonDone` (lesson content stays in `mock.ts`) |
| Activity panel | `hq/mock.ts` `activity`, `hq-view.tsx` | `hq/queries.ts` `listActivity(companyId)` → items with ISO `time` (format it in the UI) and bilingual `text` |
| Automated flows | `automation/mock.ts` `flows`, `automationStats`; `automation-view.tsx` | `listFlows`, `getAutomationStats`, `createFlow`, `createFlowFromTemplate`, `updateFlow` (toggle), `deleteFlow` |
| Marketing sections | `marketing/sections-mock.ts` `accounts`, `campaigns`, `budgets`, `channels` | `listSocialAccounts`, `listCampaigns`, `getClientBudgets`, `getChannelStats`, plus the account and campaign actions. Units match the mock: progress and spendShare are 0–1, conversion is a %. |
| Operations KPIs | `operations/mock.ts` `kpis`, `categoryCounts` | `operations/queries.ts` `getOperationsStats(companyId)` |
| Presence | `src/modules/hq/mock.ts`, `hq-view.tsx` | `listMembers`, `setMyStatus`; realtime on `members`. The floor plan comes from `getFloorPlan` and is saved with `saveFloorPlan`. |
| Pricing / plans | `pricing-plans.tsx`, Premium dialog | Limits are enforced in `src/server/plans.ts` (Free: 5 members, 20 operations/month, 1 workflow), and actions return `plan_limit`. Billing is not built yet: `companies.plan` is set by hand (`free` / `pro`). |

## Still to build (not in the backend yet)

- **Billing provider** and switching plans.
- **Agent runtime** (Python).
- **Account pages:**
  - Profile/settings: Clerk `<UserProfile>` for the account, plus `updateMyProfile` for the per-company name and title.
  - A company picker when a user belongs to several companies (`listMyCompanies`). after-sign-in opens the first one today.
  - **Realtime with Clerk** needs Clerk added as a Supabase third-party auth provider.
- **HR room:** no tables yet.
- **Automation engine:** a worker that listens to events and runs the flows' actions. The flows are stored; `recordFlowRun` is ready for the engine to call.

## Contracts

The frontend types in each module's `mock.ts` are the API contract. Services map database rows to them (`toMember`, `toBrief`, `toOrder`, …) and add a few extra fields where the backend knows more (for example `role` and `linked` on members, `code` and `category` on runs, and `inviteCode` on clients).
