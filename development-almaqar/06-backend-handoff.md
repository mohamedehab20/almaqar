# 06 — Backend handoff

Everything the frontend currently fakes. When the backend phase starts, work through this list; remove an item once it is real.

Find them all with:

```bash
grep -rn "TODO(backend)" src
```

## Mocked behaviour

| Area | Where | Replace with |
|---|---|---|
| Company + membership | `src/app/[locale]/(app)/c/[companySlug]/layout.tsx` | Load the company by slug and the signed-in member; 404 / redirect when not a member. |
| Company login | `src/modules/auth/components/company-login-form.tsx` | Resolve company by code, sign in (Supabase Auth), open that company. |
| Employee login | `src/modules/auth/components/login-form.tsx` | Sign in, open the employee's company. |
| Signup | `src/modules/auth/components/signup-form.tsx` | Create user + company, then the "establish your company" steps. |
| Visitor login | `src/modules/auth/components/visitor-login-form.tsx` | Verify invite code + OTP, open that client's portal. |
| Signed-in client | `src/modules/marketing/components/client-home.tsx` (`DEMO_CLIENT_ID = "c1"`) | Resolve from invite code / session. |
| Briefs | `src/modules/marketing/briefs-store.ts`, `client-portal.tsx` | API + realtime subscription; keep the `useBriefs` / `updateBriefs` API. Notify the account manager. |
| Marketing ideas | `marketing-view.tsx` | Save ideas. |
| Operations | `operations-view.tsx` | Create workflow instances on the server. |
| Operations notes | `notes-section.tsx` | Save notes and notify their audience (company / departments / members). |
| Automation flows | `automation-view.tsx` | Save flows in the automation engine. |
| Workflow attachments | `workflow-builder-dialog.tsx` | Upload to storage (today: local object URLs, 10 MB limit per file). |
| Sales orders | `sales-view.tsx` | Save orders and start their approval workflow; server-side numbering (SO-/PO-). |
| Events | `src/modules/events/api.ts` | Real events source (append-only table + realtime). |
| AI agents | `src/modules/agents/components/agents-view.tsx` | Send tasks to an agent runtime, track queue and progress; creating custom agents. |
| Academy progress | `src/modules/academy/components/academy-view.tsx` | Persist lesson progress per user; real lesson content. |
| Presence | `src/modules/hq/mock.ts`, `hq-view.tsx` | Realtime presence and status per member. |
| Pricing / plans | `pricing-plans.tsx`, Premium dialog | Billing provider, plan limits enforced on the server (Free: 5 employees, 20 operations/month, 1 workflow). |

## Planned stack

From `programming/IMPLEMENTATION_PLAN.md` (outside this repo):

- Supabase: Postgres, Auth (email/password + OTP), Realtime, Storage.
- Drizzle ORM with migrations.
- Row Level Security on `company_id` for multi-tenancy.
- Server Actions / Server Components for server logic.
- Zod + react-hook-form for validation.
- Hosting: Vercel + Supabase.

## Contracts already shaped in the frontend

These types are a good starting point for tables and APIs:

- `src/modules/hq/mock.ts`: `Member`, `Department`, `Room`, `FurnitureItem`, `Zone`, `PresenceStatus`, `ActivityItem`.
- `src/modules/operations/notes.ts`: `Note`, `NoteAudience`.
- `src/modules/automation/workflows.ts`: `Workflow`, `WorkflowRun`, `applyRunAction`.
- `src/modules/sales/mock.ts`: `Order`, `OrderStatus`, `OrderType`.
- `src/modules/marketing/briefs-mock.ts`: `Brief`.
- `src/modules/events/types.ts`: `Event`, `EventType`, `EventSource`, `EventSeverity`.
- `src/modules/agents/mock.ts`: `Agent`, `AgentKind`, `AgentStatus`.
- `src/modules/academy/mock.ts`: `Course`, `Lesson`, `Track`, `Level`.
