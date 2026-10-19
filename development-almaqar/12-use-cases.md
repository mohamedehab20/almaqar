# 12 — Use cases (analytics)

Adapted from `Almaqar.pdf` to Al Maqr's real roles: **owner**, roles built in «الصلاحيات» (default «مدير» and «موظف»), and per-person overrides. Requirements: [10-analytics-srs.md](10-analytics-srs.md). Tests: [15-security-qa.md](15-security-qa.md).

## UC-01 — An employee without access opens the room
- **Actor:** employee with the default «موظف» role.
- **Flow:** the sidebar does not show «التحليلات». Typing `/c/<slug>/analytics` shows «مالكش صلاحية» (`RoomGuard`). Calling the query directly returns `forbidden`.
- **Accept:** no analytics data reaches the browser. (ANA-FR-004, SEC-TC-01)

## UC-02 — A manager compares the departments they are allowed to see
- **Actor:** member whose role has `analytics.view` and `analytics.departments` for Sales and Marketing.
- **Flow:**
  1. Opens the room.
  2. The server reads their scopes.
  3. Only Sales and Marketing appear.
  4. The manager picks a month and sees the metrics side by side.
  5. Opening a department shows its bottlenecks.
- **Accept:** adding another department id to the URL or request changes nothing. (ANA-FR-004/005, SEC-TC-02/03)

## UC-03 — The owner investigates a department below target
- **Actor:** owner.
- **Flow:**
  1. Sees all departments.
  2. One shows low timeliness.
  3. Opens «إزاي بنحسب؟» for the formula and sample size.
  4. Opens the department: overdue tasks, waiting approvals, stuck steps, hours vs expected, and members (the owner has every permission).
- **Accept:** every item shows its evidence. No person is labelled. Nothing is triggered automatically. (ANA-FR-008/009, BR-03)

## UC-04 — An analyst imports data (release 2)
Deferred. Will follow the direct signed-upload pattern already used for attachments (`createUploadTarget`), with a job table and status polling.

## UC-05 — A member moves to another department
- **Actor:** owner or a member with `members.edit`.
- **Flow:**
  1. The member's `department_id` changes.
  2. On the next request, scopes and department figures are recalculated, because nothing is cached across requests.
  3. If their role grants `analytics.members` only for the old department, they no longer see its members.
- **Accept:** no stale access. Their tasks now count in the new department (known gap, shown on the page). (SEC-TC-05)

## UC-06 — Access is attempted outside scope, or the room is off
- **Actor:** any signed-in member.
- **Flow:**
  - **A department outside scope:** it is dropped on the server.
  - **The room turned off in «إدارة الأقسام»:** the page shows «القسم مقفول» and the sidebar hides it.
  - **Another company's slug:** `notFound`.
- **Accept:** the error never contains data. (SEC-TC-04/06/07)
