# 14 — API contracts (PDF endpoints → Al Maqr)

Al Maqr has no REST API for the app. Reads are server functions in `queries.ts` (called from server components), and writes are Server Actions built with `action(zod, handler)` + `withUser` (`src/server/action.ts`). Both run as the signed-in user under RLS. The table maps every endpoint proposed in `Almaqar.pdf` to what exists or is planned.

## Errors

Every action returns `{ ok: true, data } | { ok: false, error }`, where `error` is an `AppError` code.

| Code | Meaning |
|---|---|
| `unauthorized` | Not signed in |
| `forbidden` | Missing permission, or out of scope |
| `not_found` | Not found, or not visible to the caller (no information leak) |
| `invalid` | Validation failed |
| `conflict` | A unique value is already taken |
| `plan_limit`, `overlap`, `insufficient_balance` | Feature-specific (plans, leave) |
| `not_configured` | Supabase or storage keys are missing |
| `auth_failed`, `server_error` | Sign-in failure; unexpected error |

## Mapping

| ID | PDF endpoint | Al Maqr | Status |
|---|---|---|---|
| API-01 | `GET /me/permissions` | `getMyPermissions(companyId)` in `src/server/permissions.ts`, and `getRoomAccess(slug)` for the sidebar | Exists |
| API-02 | `GET /management/performance` | `getAnalyticsData(companyId, { month })` in `analytics/queries.ts`; the scope is resolved on the server | Release 1 |
| API-03 | `GET /teams/{id}/performance` | Same call; the department is a key in the result, not an input | Release 1 |
| API-04 | `GET /admin/roles` | `listRoles`, `getPermissionsOverview` (queries); `createRole`, `renameRole`, `deleteRole`, `setRolePermissions`, `setMemberOverrides` (actions) in `src/modules/permissions` | Exists |
| API-05 | `POST /admin/assignments` | `updateMember` (department, in `hq/actions.ts`), `assignRole` (permissions), `updateDepartment` (manager, active; in `hq/actions.ts`), `setRoom` (room on/off and manager; `departments/actions.ts`) | Exists |
| API-06 | `GET /audit-logs` | `events` table (read by the owner) | Exists, no screen |
| API-07 | `/datasets/*`, `/analysis-jobs/*` | — | Release 2 |
| API-08 | `/dashboards/*`, `/kpis/*`, `/dashboards/{id}/grants` | — (fixed room; KPIs defined in `calc.ts`) | Release 2 |
| API-09 | `/reports/*` (generate, download, share) | — | Release 2 |
| API-10 | `POST /datasets/{id}/uploads` (signed upload) | Pattern exists: `createUploadTarget` + `uploadFile` in `src/modules/files` | Reuse in release 2 |

## API-02 contract

**Input:**

```ts
{ month: "YYYY-MM" }
```

It takes no `departmentIds`.

**Output:**

```ts
type AnalyticsData = {
  period: { month: string; from: string; to: string; timeZone: string };
  readAt: string;                       // ISO, when the data was read
  canSeeMembers: boolean;               // any analytics.members scope
  summary: { onTarget: number; departments: number; overdue: number; timeliness: Ratio; waiting: number };
  departments: DepartmentStats[];       // only allowed departments
  bottlenecks: Bottleneck[];            // with evidence, only allowed departments
};
type Ratio = { value: number | null; sample: number; insufficient: boolean };
type DepartmentStats = {
  id: string; name: Localized; color: string; members: number;
  delivery: Ratio; timeliness: Ratio; overdue: { count: number; oldestDays: number };
  medianCycleDays: number | null; openPerMember: number; capacity: Ratio;
  waitingApprovals: number; stuckRuns: number;
  people?: PersonStats[];               // only when analytics.members covers this department
};
```

The query runs with `company_id = <checked company>`, and the department filter comes from the server (see [13](13-analytics-architecture.md)).
