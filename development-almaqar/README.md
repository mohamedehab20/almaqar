# Al Maqr — Development Reference

This folder is the running engineering record of **Al Maqr (المقر)**, a "digital HQ" SaaS web app. Read it before you touch the code; update it whenever a milestone lands.

> Status (2026-10-12): **the backend and database are built** (Supabase + Drizzle + RLS, tested with `npm run test:db`). The screens still run on mock data until they are wired to it. See [06-backend-handoff.md](06-backend-handoff.md). Without Supabase keys the app behaves exactly as before.

## Contents

| File | What it answers |
|---|---|
| [01-getting-started.md](01-getting-started.md) | How do I run, build and deploy it? |
| [02-architecture.md](02-architecture.md) | How is the code organized, and why? |
| [03-routes-and-modules.md](03-routes-and-modules.md) | What does every page do, and which files own it? |
| [04-milestones.md](04-milestones.md) | What was built, in what order? (the changelog) |
| [05-decisions.md](05-decisions.md) | Which choices were made on purpose, and what were the alternatives? |
| [06-backend-handoff.md](06-backend-handoff.md) | What is mocked today, and what must the backend replace? |
| [07-conventions.md](07-conventions.md) | Coding rules, verification steps and known gotchas |
| [08-backend-tasks.md](08-backend-tasks.md) | What is left of the backend plan, as tasks for two engineers |
| [09-test-report.md](09-test-report.md) | Full test runs across frontend, backend and the live database, with findings |
| [10-analytics-srs.md](10-analytics-srs.md) | Analytics: requirements (ANA-FR-xxx), metrics (KPI-xx), fairness rules, targets |
| [11-erd.md](11-erd.md) | The real schema as an ERD, data dictionary, and known data gaps |
| [12-use-cases.md](12-use-cases.md) | Analytics use cases (UC-xx) |
| [13-analytics-architecture.md](13-analytics-architecture.md) | How the Analytics room is built and where authorization happens |
| [14-api-contracts.md](14-api-contracts.md) | Proposed REST endpoints mapped to Al Maqr's queries and actions (API-xx), error codes |
| [15-security-qa.md](15-security-qa.md) | Access matrix, security test cases (SEC-TC-xx), regression steps, issue template |

## Keeping this folder current

Every change that ships (one commit pushed to `main`) is a milestone. In the **same commit** as the code:

1. Add an entry at the top of the current phase in [04-milestones.md](04-milestones.md): date, short title, what changed for the user, and the main files.
2. If you added or changed a route or module, update [03-routes-and-modules.md](03-routes-and-modules.md).
3. If you made a choice someone might later question (library, data shape, UX rule, price), add it to [05-decisions.md](05-decisions.md).
4. If you added a `TODO(backend)` or mocked something new, list it in [06-backend-handoff.md](06-backend-handoff.md).
5. Bump the status line above if the phase changed.

Keep entries short and factual. Link to files with paths relative to the repo root (for example `src/modules/hq/components/hq-view.tsx`).

## Product in one paragraph

Al Maqr gives a company a virtual headquarters: a live floor plan of the office showing who is present, rooms for each department (HR, operations, automation, sales, marketing), approval workflows that route work between employees, a "bag" of AI agents (الجراب), a client portal where clients hand in briefs, and a learning academy (بوصلة المقر). It is Arabic-first (RTL) with full English support. The original product definition and MVP plan live outside this repo, in `programming/IMPLEMENTATION_PLAN.md`.
