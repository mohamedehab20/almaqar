# 02 — Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3.8**, App Router, TypeScript | Webpack dev/build. Read `node_modules/next/dist/docs/` before using an API — v16 differs from older Next.js (see below). |
| UI | **React 19.2** | Server Components by default; `"use client"` only where there is state or interaction. |
| Styling | **Tailwind CSS v4** | Design tokens as CSS variables in `src/styles/globals.css`. Logical properties (`ms-`, `pe-`, `start-`, `end-`) everywhere for RTL. |
| i18n | **next-intl 4** | Arabic default (RTL) at `/`, English (LTR) at `/en`. |
| Icons | **lucide-react** | |
| Class helpers | `clsx` + `tailwind-merge` via `cn()` in `src/lib/utils.ts`; `class-variance-authority` for button variants | |
| Data | **Supabase** (Postgres + Auth + Realtime + Storage), **Drizzle ORM** for schema, migrations and queries | Backend layer is complete (see below); screens still render mock data until they are wired to it. |
| Validation | **Zod 4** | Every Server Action input. |
| Tests | **node:test + tsx + PGlite** | `npm run test:db` runs migrations and services on an in-memory Postgres. |

### Next.js 16 differences that matter here

- `src/proxy.ts` replaces `middleware.ts`. Today it only runs next-intl locale routing; auth checks for `(app)` routes will go there.
- `params` is a **Promise**. Type pages with the generated globals `PageProps<"/[locale]/route">` and `LayoutProps<"/[locale]">`, then `await params` (or `use(params)` in a sync server component).
- Route types are generated when the dev server compiles a route, so a brand-new route fails `tsc` until it has been opened once.

## Folder layout

```
src/
  proxy.ts                     locale routing (next-intl) + Supabase session refresh
  app/
    icon.png                   favicon (from the logo)
    [locale]/
      layout.tsx               <html lang dir>, Cairo + Inter fonts, NextIntlClientProvider
      (marketing)/             public site: landing, pricing, compass
      (auth)/                  login, employee-login, visitor-login, signup
      (app)/c/[companySlug]/   the company app (main hall + rooms), wrapped in AppShell
      (client)/client-portal/  the client's portal
    api/auth/confirm/route.ts  target of Supabase email links (confirm signup, invites)
  db/
    schema.ts                  all tables (Drizzle); shapes follow the frontend types
    index.ts                   db(): owner connection — bypasses RLS, trusted code only
    seed.ts                    loads the mock data into a "demo" company
  server/
    context.ts                 runAsUser(): transaction as the user (role authenticated + JWT claims) → RLS applies
    session.ts                 withUser(): runAsUser with the signed-in user's verified claims
    action.ts                  action(schema, handler): Zod-validated Server Action → ActionResult
    errors.ts                  AppError + stable error codes (forbidden, plan_limit, ...)
    membership.ts, plans.ts, validation.ts
  lib/supabase/                client.ts (browser), server.ts (RSC/actions), proxy.ts, admin.ts (secret key), env.ts
  components/
    layout/                    AppShell, AppSidebar, AppTopbar, Logo, LocaleSwitcher
    marketing/                 MarketingHeader, ExploreMenu (side drawer), RoleCards, WhySection, PricingPlans, MarketingFooter
    shared/                    Avatar (+ statusColor)
    ui/                        Button (buttonVariants), Input, Field, Select, PasswordInput, OtpInput, Divider, FormStatus
  modules/<feature>/
    mock.ts                    demo data + types for the feature
    components/                feature views and dialogs
    service.ts                 backend logic: functions of (ctx, input), no Next.js imports (testable)
    queries.ts                 reads for Server Components ("server-only", cached per request)
    actions.ts                 Server Actions ("use server"), Zod-validated, return ActionResult
  i18n/
    routing.ts                 locales, default, localePrefix "as-needed", localeDetection false
    navigation.ts              locale-aware Link / useRouter / usePathname — always import from here
    request.ts                 loads messages per request
    messages/ar.json, en.json  all UI text
  styles/globals.css           Tailwind v4 theme tokens and utilities
  lib/utils.ts                 cn()
public/
  brand/logo.png               trimmed logo
  landing/*.jpg, auth/diwan.png  page imagery
drizzle/                       SQL migrations: 0000 tables (generated), 0001 RLS, 0002 numbering/storage/realtime, 0003 auth functions
scripts/seed.ts                npm run db:seed
tests/db/                      PGlite setup, RLS tests, service tests
development-almaqar/           this documentation
```

Route groups in parentheses only organize files; they do not appear in URLs.

## Feature modules

Each feature lives in `src/modules/<feature>/` and owns its types, mock data and components. Pages in `src/app` stay thin: they set the locale, set metadata, and render one view component from the module.

| Module | Purpose |
|---|---|
| `hq` | Main hall: floor plan, presence, status, activity. Also the shared demo company, members, departments (`mock.ts`) used by other modules. |
| `operations` | Operations room: KPIs, operations log, add-operation dialog, team notes with audiences (`notes.ts`). |
| `automation` | Automation room: automated flows, templates, and approval workflows (`workflows.ts` holds the run state machine). |
| `sales` | Sale and purchase orders, suppliers, order dialog. |
| `marketing` | Marketing department (idea bank, lab, delivery), sections (clients, accounts, campaigns, budgets, channels), briefs, client portal. |
| `hr` | HR home. |
| `agents` | Al Jarab — AI agents (general and specialist) with task assignment. |
| `academy` | Al Maqr Compass — learning tracks, courses, lessons, hands-on guides. |
| `auth` | Login, employee login, visitor login (QR + OTP) and signup forms. |
| `events` | Event model (types, constants, helpers, mock source). `api.ts` `fetchEvents()` reads the `events` table when signed in, mock data otherwise. |
| `files` | Backend only: upload / signed URL / delete for the `attachments` storage bucket. |

## Backend

Request path for anything done on a user's behalf:

```
Server Component → modules/<f>/queries.ts ─┐
Client form      → modules/<f>/actions.ts ─┴→ withUser(ctx → service.fn(ctx, input))
                                               └ one Postgres transaction: SET LOCAL ROLE authenticated
                                                 + request.jwt.claims → every RLS policy applies
```

- **Security lives in the database.** RLS on every table scopes rows to companies the user is a member of (`private.is_member`). Client-portal users see only their client and its briefs. Services add business rules on top: admin-only actions, step assignee, plan limits.
- **`db()` bypasses RLS.** Use it only for migrations, the seed and future background jobs.
- **Auth:**
  - Sign-up keeps the company on the auth user (`pending_company`). `finishSignIn()` in `modules/auth/session.ts` creates it on first sign-in, through the `create_company` RPC, and links pending member invites (`claim_invites`).
  - Company login checks the company code with `company_slug_for_code`.
  - Visitors: invite code + OTP (email or SMS), then `redeem_client_invite`.
- **Numbers** (SO-/PO-/OP-####) come from database triggers, per company, and never change.
- **Events:** services call `emitEvent()`. A trigger logs `brief.received`, because portal users cannot write events.
- **Realtime** publication: members, briefs, notes, events, workflow_runs, orders, marketing_ideas.
- **Storage:** private bucket `attachments`, paths `<company_id>/<folder>/...`, 10 MB. Brief files go under `<company_id>/briefs/<client_id>/`.

## Data and state

- **Localized text in data:** mock records use `{ ar: string; en: string }` and are read with the current locale (`useLocale()`).
- **Demo identity:** company slug `demo` (`DEMO_COMPANY_SLUG`), current user `m1` (خالد منصور, CEO). The company layout returns 404 for any other slug.
- **Page state** is plain `useState` seeded from mock data. It resets on reload.
- **Cross-page state** (briefs shared between the marketing room and the client portal) uses a small localStorage store with `useSyncExternalStore` — `src/modules/marketing/briefs-store.ts` (key `almaqr.briefs.v1`). It syncs across tabs through the `storage` event.

## Internationalization

- All visible text is in `src/i18n/messages/{ar,en}.json`, grouped by namespace (`landing`, `auth`, `app`, `hq`, `ops`, `automation`, `sales`, `marketing`, `clientPortal`, `pricing`, `agents`, `compass`, `common`, …).
- Add every key to **both** files. Edits to these large JSON files are easiest with a small Node script (parse, set keys, `JSON.stringify(m, null, 2)`).
- Use `Link`, `useRouter` and `usePathname` from `@/i18n/navigation` so links keep the `/en` prefix.
- Direction comes from the locale (`localeDirection`) on `<html dir>`. Use logical utilities, and `rtl:` / `ltr:` variants for icons that must flip (arrows, send icons).

## Design system

Tokens in `src/styles/globals.css` (Tailwind v4 `@theme`):

- **Colors:** `primary`, `primary-container`, `primary-fixed`, `on-primary`, `secondary-container` (gold), `secondary-fixed`, `on-secondary-container`, `tertiary` (#8a5d00), `tertiary-fixed`, `on-tertiary`, `surface`, `surface-container-{lowest,low,}`, `surface-variant`, `inverse-surface`, `inverse-on-surface`, `on-surface`, `on-surface-variant`, `muted`, `outline-variant`, `success(-container)`, `danger(-container)`.
- **Utilities:** `bg-brand-gradient`, `ghost-border`, `glass`; shadows `shadow-ambient`, `shadow-ambient-lg`.
- **Fonts:** Cairo (Arabic + Latin) and Inter.
- **Buttons:** `buttonVariants({ variant: "primary" | "secondary" | "tertiary" | "gold" | "icon", size: "sm" | "md" | "lg" | "icon" })`.

Note: `glass` uses `backdrop-filter`, which makes fixed-position children position against the header instead of the viewport. The Explore drawer is portaled to `<body>` for that reason.
