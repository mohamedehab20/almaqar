# 07 — Conventions and workflow

## Code

- **Match the surrounding code.** Comment density, naming and idioms follow the file you are in.
- **Server by default.** Add `"use client"` only to components with state, effects or event handlers.
- **Thin pages.** A page sets the locale (`setRequestLocale`), exports `generateMetadata`, and renders one view from `src/modules/<feature>/components`.
- **No hard-coded UI text.** Every string goes in `ar.json` **and** `en.json`.
- **RTL-safe styling.** Use `ms-/me-/ps-/pe-/start-/end-`, never `ml-/mr-/left-/right-` for layout. Flip directional icons with `rtl:-scale-x-100` or by choosing `ArrowLeft`/`ArrowRight` from the locale. Don't put `dir="ltr"` on an absolutely positioned element that uses `start`/`end` — it flips its side.
- **Arabic text** never in `font-mono` (it renders broken). Wrap codes/numbers in `<span dir="ltr">` when they must stay LTR.
- **Links** from `@/i18n/navigation`, not `next/link`.
- **Mark mocks** with `// TODO(backend): …` and list them in [06-backend-handoff.md](06-backend-handoff.md).
- **Dialogs:** `role="dialog"`, `aria-modal`, label from the heading, focus the first control on open, close on Esc and on backdrop click.

## Lint rules that bite

- The react-hooks plugin treats any function named `use…` as a hook. Name helpers `apply…`, `make…`, etc.
- `Date.now()` / `Math.random()` inside render-looking code is flagged as impure. Move ID helpers to module level or call them inside event handlers.
- Avoid `setState` directly inside `useEffect` (the hooks rules may flag it). For "mounted" checks use `useSyncExternalStore(noop, () => true, () => false)`.
- Literal `//` inside JSX text is parsed as a comment. Use `{"// text"}`.

## Before every commit

1. `npm run lint` — no errors or warnings.
2. `npx tsc --noEmit` — clean (open new routes in the dev server first).
   - Backend changes: `npm run test:db` passes.
3. Open the changed pages in the browser (Arabic and, for layout changes, mobile width), click through the new behaviour.
4. Update this folder (see the checklist in [README.md](README.md)). For Claude Code agents this is enforced by `.claude/hooks/require-dev-docs.mjs` (registered in `.claude/settings.json`): a `git commit`, or the end of an agent turn, is blocked while code has changed (uncommitted or unpushed) without any change under `development-almaqar/`. Agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/`) don't count as code.

## Backend

- **Where code goes:**
  - Logic goes in `modules/<f>/service.ts` as `fn(ctx, input)`. Never import Next.js there.
  - Reads for pages go in `queries.ts` (`import "server-only"`, wrapped in `cache()`).
  - Mutations go in `actions.ts` (`"use server"`, every export is `action(zodSchema, input => withUser(ctx => svc.fn(ctx, input)))`).
- **Every company-side mutation checks a permission:** call `requirePermission(ctx, companyId, "<key>", departmentId?)` from `src/server/permissions.ts` before writing.
  - Pass the department of the member the action is about, for scoped keys.
  - Never check `members.role` for anything except "is the owner".
  - **A new permission:** add it to `src/modules/permissions/catalog.ts`, then add a migration that redefines `private.permission_keys()` (and `employee_default_permissions()` if needed). Test "the database knows exactly the catalog's permissions" fails until both match.
- **A new room:** add its `.view` key to `ROOM_VIEW` and a `layout.tsx` with `RoomGuard`.
- **Use `withUser` for all user data, never `db()`.** Only migrations, the seed and background jobs use `db()`.
- **Throw `AppError(code)` for expected failures.** Postgres errors are mapped for you: RLS → `forbidden`, unique → `conflict`, foreign key → `not_found`.
- **Changing the schema:**
  1. Edit `src/db/schema.ts`, then run `npm run db:generate`.
  2. For a new tenant table, add it to the policy loop in a new custom migration (`npx drizzle-kit generate --custom --name <name>`), separating statements with `--> statement-breakpoint`.
  3. Never edit a migration that has already been applied to a real database.
- **The current user in SQL is `private.uid()`** (text, the Clerk user id). Never use `auth.uid()`; it casts to uuid and fails for Clerk ids.
- **New RPC function:** put the body in `private` (with `SECURITY DEFINER` only if it must bypass RLS, always `SET search_path = ''` and an `auth.uid()` check). Then add a `SECURITY INVOKER` wrapper in `public` and grant EXECUTE explicitly. A test fails otherwise.
- **New foreign key:** add an `index()` for it in `schema.ts`, since RLS and joins filter on these columns.
- **After applying a migration to Supabase:** run the advisors (MCP `get_advisors`, security and performance) and fix any warnings.
- **Test it:** add a case to `tests/db/` and run `npm run test:db` before committing backend changes.
- **Secrets:** `DATABASE_URL` and `SUPABASE_SECRET_KEY` are server-only. Only `NEXT_PUBLIC_*` reaches the browser.

## Git

- Work on `main`; every finished change is committed and pushed (`git push origin main`), which deploys to Vercel.
- One change per commit, imperative subject in English, for example `Main hall: pin status chips in a fixed strip above the floor plan`.
- Git identity for this repo: `mohamedehab20 <mohamed.ehab8999@gmail.com>`.
