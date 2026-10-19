# 15 — Security and QA plan (analytics)

## Who can see what

| Who (example) | Room | Department totals | Member details |
|---|---|---|---|
| Owner | Yes | All | All |
| Role «مدير» (default) | Yes | All | All |
| Role «موظف» (default) | No | — | — |
| Custom role "Head of Sales": `analytics.view` + `analytics.departments`[Sales] | Yes | Sales | No |
| Same role + `analytics.members`[Sales] | Yes | Sales | Sales |
| Any member + override **deny** `analytics.view` | No | — | — |

## Security test cases

| ID | Case | Expected | Where tested |
|---|---|---|---|
| SEC-TC-01 | Member without `analytics.view` calls `getAnalyticsData` | `forbidden` | `tests/db/analytics.test.ts` |
| SEC-TC-02 | Scoped to department A | Result has A only | same |
| SEC-TC-03 | Scoped to A; tries to reach B (no input accepts a department) | B never in the result | same + contract in [14](14-api-contracts.md) |
| SEC-TC-04 | Member of company X asks for company Y | `forbidden` / `not_found` | same |
| SEC-TC-05 | Role scope changed between two calls | The second call reflects the change | same |
| SEC-TC-06 | `analytics.departments` without `analytics.members` | No `people` in any department | same |
| SEC-TC-07 | Room turned off in «إدارة الأقسام» | Page shows «القسم مقفول»; sidebar hides it | browser check |
| SEC-TC-08 | Granting or removing analytics permissions | Logged in `events` (existing permissions actions) | `tests/db/permissions.test.ts` |
| SEC-TC-09 | Catalog and `private.permission_keys()` drift | Test fails | `tests/db/permissions.test.ts` |

## Regression tests

Before every push:

```
npm run test:db
npx tsc --noEmit
npm run lint
npm run build
npm run check:routes
```

`calc.ts` gets reference cases computed by hand: timeliness with and without dates, overdue age, capacity after leave, and the minimum sample.

## Recording problems

Use this template in [09-test-report.md](09-test-report.md). Record only problems you have confirmed; never invent one.

```
Issue ID: QA-001
Page / component:
Type: Functional | UI | Security | Performance | Architecture
Severity: Critical | High | Medium | Low   (security: by impact and exploitability)
Evidence: screenshot / response / log
Steps to reproduce:
Expected:
Actual:
Root cause:
Fix:
Regression test:
Traceability: ANA-FR-xxx, UC-xx, API-xx, SEC-TC-xx
```
