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
3. Open the changed pages in the browser (Arabic and, for layout changes, mobile width), click through the new behaviour.
4. Update this folder (see the checklist in [README.md](README.md)).

## Git

- Work on `main`; every finished change is committed and pushed (`git push origin main`), which deploys to Vercel.
- One change per commit, imperative subject in English, for example `Main hall: pin status chips in a fixed strip above the floor plan`.
- Git identity for this repo: `mohamedehab20 <mohamed.ehab8999@gmail.com>`.
