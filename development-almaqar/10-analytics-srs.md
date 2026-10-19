# 10 — Analytics: requirements (SRS)

Source: `Almaqar.pdf` (proposed design, 2026-10-19), reconciled with the real code. Where the PDF says "team", Al Maqr has **departments** (`departments`); there is no separate team table. Where the PDF says "organization", Al Maqr has **companies**.

Related: [11-erd.md](11-erd.md) (data), [12-use-cases.md](12-use-cases.md) (UC-xx), [13-analytics-architecture.md](13-analytics-architecture.md), [14-api-contracts.md](14-api-contracts.md) (API-xx), [15-security-qa.md](15-security-qa.md) (SEC-TC-xx, QA-xxx).

## 1. Scope

**Release 1 (being built):** a new room «التحليلات» (`/c/<slug>/analytics`) that compares departments and shows bottlenecks, computed live from data Al Maqr already stores: tasks, working hours, leave, approvals, and approval-workflow runs.

**Release 2 (deferred, decided 2026-10-19):** importing CSV/Excel datasets, background analysis jobs, saved dashboards and sharing, generated reports and downloads, scheduled reports, AI explanations.

## 2. Functional requirements

| ID | Requirement | Priority | Release | Acceptance criteria | Use case / tests |
|---|---|---|---|---|---|
| ANA-FR-001 | Import CSV and Excel data | P0 in the PDF | 2 | Valid files are previewed and processed; invalid files return useful errors | UC-04 |
| ANA-FR-002 | Profile dataset quality | P0 in the PDF | 2 | Missing values, duplicates, invalid types are reported | UC-04 |
| ANA-FR-003 | Show department KPIs for a chosen month | P0 | 1 | Each value equals the reference calculation in `calc.ts` tests | UC-02, UC-03 · QA tests in `tests/db/analytics.test.ts` |
| ANA-FR-004 | Scoped authorization | P0 | 1 | Without `analytics.view` → `forbidden`. Departments outside `analytics.departments` never appear, even if requested by id. Member rows appear only with `analytics.members` for that department | UC-01, UC-05, UC-06 · SEC-TC-01…07 |
| ANA-FR-005 | Compare several departments | P0 | 1 | Only authorized departments; same period and same metric definitions for all | UC-02 |
| ANA-FR-006 | Generate and download reports | P0 in the PDF | 2 | Report values match the filters and data version | — |
| ANA-FR-007 | Record security-sensitive actions | P0 | 1 (partly) | Permission and role changes already write `events`. Release 1 adds no new writes (read-only room). Release 2 adds imports, exports, shares | SEC-TC-08 |
| ANA-FR-008 | Explain each metric | P1 | 1 | «إزاي بنحسب؟» shows the formula, period, and sample size of every metric | UC-03 |
| ANA-FR-009 | Detect bottlenecks with evidence | P1 | 1 | Each item names the measurable fact (for example "6 tasks overdue, oldest 9 days") and links to where it is | UC-03 |
| ANA-FR-010 | Scheduled reports | P2 | 2 | Authorization is re-checked at run and delivery time | — |
| ANA-FR-011 | Room can be turned off | P1 | 1 | «إدارة الأقسام» can close the room for the company, like any other room | UC-06 |

## 3. Metrics (release 1)

All metrics are per department, for one calendar month in the company time zone (`work_settings.time_zone`). A task belongs to the department of its **assignee at the time of the query** (tasks have no department column; see the gap in [11-erd.md](11-erd.md#gaps)).

| ID | Dimension | Formula | Sample shown |
|---|---|---|---|
| KPI-01 | Delivery | tasks done in the month ÷ tasks due in the month | tasks due |
| KPI-02 | Timeliness | tasks done on or before `due_date` ÷ tasks done in the month that had a `due_date` | tasks done with a date |
| KPI-03 | Overdue | open tasks with `due_date` < today; count and age of the oldest | — |
| KPI-04 | Flow | median days from `created_at` to `completed_at`; open tasks per member | tasks done |
| KPI-05 | Capacity | hours logged in `work_sessions` ÷ expected hours (working days × (day_end − day_start − break) − approved leave days) | members |
| KPI-06 | Waiting approvals | `approval_requests` pending at an approver in the department; age | — |
| KPI-07 | Stuck operations | `workflow_runs` in progress or `changes_requested` whose current step has not moved for N days (from `history`) | — |

## 4. Business rules (fairness)

- **BR-01:** No single "score" ranks departments. Each dimension is shown on its own with its sample size.
- **BR-02:** If a ratio is based on fewer than 5 items, show «بيانات غير كافية» instead of a percentage.
- **BR-03:** The room points at measurable gaps and their evidence. It never labels a person (no "lazy", no ranking of employees) and starts no disciplinary action. Wording suggests checking workload, dependencies and approvals first.
- **BR-04:** Department heads can see department totals without seeing individual members (`analytics.departments` without `analytics.members`).
- **BR-05:** The page always shows the period, when the data was read, and how each metric is computed.

## 5. Non-functional requirements (initial targets, to be revised with real volume)

| ID | Area | Target |
|---|---|---|
| ANA-NFR-01 | Performance | Room loads in under 2 s for a company with 50 members and 5,000 tasks (server time) |
| ANA-NFR-02 | Security | Company isolation through RLS; department scope decided on the server only; no service-role key in analytics code |
| ANA-NFR-03 | Freshness | Data is read live on every visit (no stale cache across users); `cache()` is per request only |
| ANA-NFR-04 | Auditability | Every metric formula lives in `src/modules/analytics/calc.ts` with tests; changing a formula is a reviewed code change |
| ANA-NFR-05 | Accessibility | Keyboard reachable, bars have text values, RTL and LTR both correct |
| ANA-NFR-06 | Maintainability | Same module pattern as other rooms (`service`, `queries`, `calc`, `demo`, `components`) |
