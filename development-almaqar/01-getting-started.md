# 01 — Getting started

## Requirements

- Node.js 20+ and npm
- Windows is the main development machine (paths with Arabic characters, Git Bash and PowerShell); macOS and Linux also work.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000  (webpack dev server)
```

On Windows you can double-click `run-local.bat`. It installs packages on first run, starts the server and opens the browser.

| URL | Page |
|---|---|
| `/` | Landing (Arabic, RTL) |
| `/en` | Landing (English, LTR) — every route works with the `/en` prefix |
| `/login`, `/employee-login`, `/visitor-login`, `/signup` | Auth screens (any input is accepted) |
| `/c/demo` | Main hall of the demo company |
| `/client-portal` | Client portal (reached from visitor login) |

All forms use `noValidate` and skip real checks, so you can click through every screen with empty fields.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (`next dev --webpack`) |
| `npm run build` | Production build (`next build --webpack`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next + react-hooks rules) |
| `npx tsc --noEmit` | Type check |

## Repository and deployment

- **GitHub:** https://github.com/mohamedehab20/almaqar (branch `main`, public).
- **Vercel** deploys automatically on every push to `main`. Deployment Protection is on, so preview URLs ask for a Vercel login. Note that `almaqar.vercel.app` is **not** this project.
- There are no environment variables yet.

## AI tooling (Supabase MCP + skills)

- `.mcp.json` registers the **Supabase MCP server** (project ref `rosifnxvdpwkvpqzguzj`) for Claude Code at project scope.
  - It needs a one-time sign-in from a regular terminal (not the IDE extension): run `claude`, then `/mcp`, pick `supabase`, then **Authenticate**.
- `.agents/skills/` holds the Supabase agent skills (`supabase`, `supabase-postgres-best-practices`), pinned in `skills-lock.json`.
  - `.claude/skills/` symlinks to them with absolute paths, so it is git-ignored. On a new machine, run `npx skills add supabase/agent-skills` to recreate it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A page 404s or shows stale code after deleting/renaming a file | Stop the server, delete `.next/`, start again. |
| `tsc` complains about `PageProps<"/[locale]/new-route">` | Route types are generated when the dev server first compiles that route. Open the page once, then re-run `tsc`. |
| The browser shows the old static design | You opened a file from the sibling `programming/` folder (old HTML mockups). Those now redirect to `localhost:3000`, so the dev server must be running. |
| "Failed to load page" / connection refused | The dev server stopped. Restart it (`npm run dev` or `run-local.bat`). |
