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
| `npm run test:db` | All backend tests (`tests/**/*.test.ts`): RLS policies and every service on an in-memory Postgres (PGlite), plus the action layer. No Supabase needed. |
| `npm run db:generate` | Create a migration in `drizzle/` after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the database in `DATABASE_URL` |
| `npm run db:seed -- --owner you@example.com` | Load the demo data into a `demo` company (add `--reset` to replace it) |
| `npm run db:studio` | Browse the database (Drizzle Studio) |
| `npm run db:seed-sql -- <email> <out.sql>` | Same demo data as `db:seed`, written as one SQL script, for when there is no `DATABASE_URL` (run it with MCP `execute_sql` or the SQL editor) |
| `npm run check:routes` | With the app running on port 3123 (or `BASE_URL`): checks every page in both languages, the auth-confirm redirect, 404s and broken-cookie handling |
| `npm run db:simulate -- <out.sql>` | Runs a simulated working day through the real services as real users, and writes the resulting `simulation` company as SQL |
| `tests/db/smoke-supabase.sql` | Paste into the Supabase SQL editor (or run with MCP `execute_sql`) to check RLS on the live database. Success = error message `SMOKE OK …`; everything is rolled back. |

## Repository and deployment

- **GitHub:** https://github.com/mohamedehab20/almaqar (branch `main`, public).
- **Vercel** deploys automatically on every push to `main`. Deployment Protection is on, so preview URLs ask for a Vercel login. Note that `almaqar.vercel.app` is **not** this project.
- Environment variables: see "Backend setup" below. Without them the site runs on mock data, as before.

## Backend setup (Supabase)

Everything below is needed only to run against a real database. Without it every screen keeps working on mock data.

1. **Create a Supabase project**, or use the one in `.mcp.json`.
2. **Copy `.env.example` to `.env.local`** and fill in the values from the dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API).
   - `DATABASE_URL`: the *Transaction pooler* string, port 6543 (Connect → ORMs).
   - Optional: `SUPABASE_SECRET_KEY`, so invited members get an email.
3. **Run `npm run db:migrate`.** This creates the tables, RLS policies, functions, the `attachments` storage bucket and the realtime publication. On the project in `.mcp.json` this is already done (task A1 in [08-backend-tasks.md](08-backend-tasks.md)), so the command only applies newer migrations.
4. **Run `npm run db:seed -- --owner you@example.com`** to get the demo company. Sign up with that email and you are its owner (company code `DEMO01`).
5. **Set up Auth in the dashboard:**
   - Email provider: on. Email OTP length: 6.
   - **Emails reach only your Supabase team** until a custom SMTP is set (Authentication → Emails → SMTP). The built-in sender also allows only a few messages an hour. To test with real employees before that, turn off **Confirm email** (Authentication → Sign In / Providers → Email): sign-up then signs in straight away.
   - Change the email templates (Confirm signup, Invite, Magic link, Reset password) to link to `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=<signup|invite|magiclink|recovery>`.
   - Site URL: the Vercel URL. Add `http://localhost:3000` to the redirect URLs.
   - **SMS (visitor OTP by phone):** enable the Phone provider with an SMS provider such as Twilio. Until then visitors use the email channel.
6. **On Vercel**, add the same environment variables (Production + Preview), then redeploy.

## AI tooling (Supabase MCP + skills)

- `.mcp.json` registers the **Supabase MCP server** (project ref `rosifnxvdpwkvpqzguzj`) for Claude Code at project scope.
  - It needs a one-time sign-in from a regular terminal (not the IDE extension): run `claude`, then `/mcp`, pick `supabase`, then **Authenticate**.
  - Easier alternative (no OAuth or approval prompt): create a personal access token at supabase.com/dashboard/account/tokens. Then run `claude mcp add --scope local --transport http supabase "<url from .mcp.json>" --header "Authorization: Bearer sbp_…"`. The token stays in `~/.claude.json` on that machine only and is never committed.
- `.agents/skills/` holds the Supabase agent skills (`supabase`, `supabase-postgres-best-practices`), pinned in `skills-lock.json`.
  - `.claude/skills/` symlinks to them with absolute paths, so it is git-ignored. On a new machine, run `npx skills add supabase/agent-skills` to recreate it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A page 404s or shows stale code after deleting/renaming a file | Stop the server, delete `.next/`, start again. |
| `tsc` complains about `PageProps<"/[locale]/new-route">` | Route types are generated when the dev server first compiles that route. Open the page once, then re-run `tsc`. |
| The browser shows the old static design | You opened a file from the sibling `programming/` folder (old HTML mockups). Those now redirect to `localhost:3000`, so the dev server must be running. |
| "Failed to load page" / connection refused | The dev server stopped. Restart it (`npm run dev` or `run-local.bat`). |
