# 06 — Backend handoff

Everything the frontend still fakes. **The backend for every row now exists.** What is left is wiring each screen to it: replace the mock with the query/action listed, then delete the row and its `TODO(backend)` comment.

Find the remaining places with:

```bash
grep -rn "TODO(backend)" src
```

## Wiring checklist

| Area | Where (UI) | Backend ready |
|---|---|---|
| Company + membership | `src/app/[locale]/(app)/c/[companySlug]/layout.tsx` | `hq/queries.ts` `getCompanyBySlug(slug)` → `{ company, me }`, or `null` → `notFound()`. Redirect to `/login` when not signed in (catch `unauthorized`). |
| Company login | `modules/auth/components/company-login-form.tsx` | `auth/actions.ts` `signInWithCompanyCode({ companyCode, email, password })` → `{ slug }` |
| Employee login | `modules/auth/components/login-form.tsx` | Same action. The form's `identifier` field is the email. |
| Signup | `modules/auth/components/signup-form.tsx` | `signUp(...)` → `{ needsEmailConfirmation, slug }`. Show "check your email" when confirmation is on. |
| Visitor login | `modules/auth/components/visitor-login-form.tsx` | `sendVisitorOtp` then `verifyVisitorOtp`, with `channel: "email"` or `"sms"` (SMS needs a provider; see 01). The form currently asks for a phone number only. |
| Signed-in client | `modules/marketing/components/client-home.tsx` (`DEMO_CLIENT_ID`) | `marketing/queries.ts` `getMyClients()` |
| Briefs | `modules/marketing/briefs-store.ts`, `client-portal.tsx` | `listBriefs` / `listClientBriefs`, plus `sendBrief`, `setBriefStatus`, `replyToBrief`. Realtime: subscribe to `briefs` with the browser client. A `brief.received` event is logged automatically. |
| Marketing ideas | `marketing-view.tsx` | `listIdeas`, `createIdea` (from a brief: pass `briefId`), `updateIdea` (stage, ratings, versions, delivery) |
| Operations | `operations-view.tsx` | `operations/queries.ts` `listOperations`, and the `startOperation` action (returns OP-####). The UI row shape (`WorkflowRow`) is built from the run plus its members. |
| Operations notes | `notes-section.tsx` | `listNotes(companyId, departmentId?)`, `createNote`, `setNotePinned`, `deleteNote`. Notify the audience from `note.created` events (realtime). |
| Automation flows | `automation-view.tsx` | `automation/actions.ts`: `createWorkflow`, `createWorkflowFromTemplate`, `startRun`, `actOnRun` |
| Workflow attachments | `workflow-builder-dialog.tsx` | `files/actions.ts` `uploadAttachment` (folder `workflows`) → pass the result in `attachments`; open with `getAttachmentUrl` |
| Sales orders | `sales-view.tsx` | `listOrders`, `listSuppliers`, `createOrder` (number from DB; pass `workflowId` to require approval), `setOrderStatus`, `createSupplier`. An order with a workflow shows its run (`runId`) and is approved by the run, not by a button. |
| Events | `modules/events/api.ts` | Done: `fetchEvents(companyId)` reads the table when signed in. Callers still need to pass `companyId`. |
| AI agents | `modules/agents/components/agents-view.tsx` | `listAgents`, `queueTask`, `setAgentStatus`, `createAgent`. Running tasks needs the agent runtime (future Python service), which consumes `agent.task_queued` events and calls `completeTask`. |
| Academy progress | `modules/academy/components/academy-view.tsx` | `getMyProgress`, `setLessonDone` (lesson content stays in `mock.ts`) |
| Activity panel | `hq/mock.ts` `activity`, `hq-view.tsx` | `hq/queries.ts` `listActivity(companyId)` → items with ISO `time` (format it in the UI) and bilingual `text` |
| Operations KPIs | `operations/mock.ts` `kpis`, `categoryCounts` | `operations/queries.ts` `getOperationsStats(companyId)` |
| Presence | `src/modules/hq/mock.ts`, `hq-view.tsx` | `listMembers`, `setMyStatus`; realtime on `members`. The floor plan comes from `getFloorPlan` and is saved with `saveFloorPlan`. |
| Pricing / plans | `pricing-plans.tsx`, Premium dialog | Limits are enforced in `src/server/plans.ts` (Free: 5 members, 20 operations/month, 1 workflow), and actions return `plan_limit`. Billing is not built yet: `companies.plan` is set by hand (`free` / `pro`). |

## Still to build (not in the backend yet)

- **Billing provider** and switching plans.
- **Agent runtime** (Python).
- **Account self-service:** profile, password reset, and choosing a company when a user belongs to several (`listMyCompanies` exists).
- **Marketing sections:** accounts, campaigns, budgets and channels have no tables yet.
- **HR room:** no tables yet.
- **Automated flows** (`automation/mock.ts` `flows`): still static. Approval workflows are real.

## Contracts

The frontend types in each module's `mock.ts` are the API contract. Services map database rows to them (`toMember`, `toBrief`, `toOrder`, …) and add a few extra fields where the backend knows more (for example `role` and `linked` on members, `code` and `category` on runs, and `inviteCode` on clients).
