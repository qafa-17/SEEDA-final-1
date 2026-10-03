# Content Operations (SEEDA · EPCMst)

A tool for EPCMst's non-technical publishers. It takes a finished article from Google Drive, checks its metadata against the Knowledge Hub rules, sends it through approval, and publishes it as a GitHub pull request on the Astro site. Then it confirms the page is live and listed in the sitemap.

Built for ENTR 3360 (Mount Royal University, Fall 2026).

## Stack

| Layer | Tool |
|---|---|
| App | Next.js 16 (App Router, TypeScript), Tailwind CSS 4 |
| Database, auth | Supabase (PostgreSQL + Row Level Security), from stage 2 |
| Hosting | Vercel |
| Domain | Cloudflare, from stage 9 |

## Build stages

1. **App shell and navigation** ✅
2. **Sign up / sign in, roles** ✅
3. **Database schema + Row Level Security** ✅
4. **Synthetic data** ✅
5. **Board, article page, live validation, approval flow** ✅
6. **Google Drive import and conversion** ✅
7. AI metadata suggestions
8. Publish as a pull request + live verification
9. Polish, states, Cloudflare domain

## Database

SQL migrations live in `supabase/migrations/` and are run in order in the Supabase SQL Editor.
`supabase/tests/` holds checks that prove the Row Level Security rules hold (run against a local Postgres with `supabase_stub.sql` loaded first).

## Synthetic data

`npm run seed:generate` (or `ARTICLES=300 npm run seed:generate`) writes `supabase/seed/seed_part*.sql`: fictional articles in every status, with history, guideline checks and publish attempts, plus a small fictional team (`@example.com`, cannot sign in). Run the parts in order in the Supabase SQL Editor. `supabase/seed/remove_seed.sql` removes only the synthetic rows. The output is the same every run (fixed random seed).

## Environment variables

Copy `.env.example` to `.env.local`. In Vercel → Settings → Environment Variables:

| Name | Secret? | What |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | Supabase publishable key (data is protected by Row Level Security) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **yes** | Full JSON key of the read-only Drive service account |
| `DRIVE_FOLDER_ID` | no | The shared Knowledge Hub folder |

## Tests

`npm test` runs the Markdown converter tests, the content-rule tests (the front-matter schema and the plain-language rules must agree) and the Drive client tests (against a fake Google API, no network).

`supabase/tests/run.sh` runs every SQL test suite against a local Postgres, each in a fresh database: `PSQL="psql -h <socket dir> -p <port> -U postgres" supabase/tests/run.sh`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Security notes

- Security headers (no framing, no MIME sniffing, strict referrer, HSTS) are set in `next.config.ts`.
- Fonts are self-hosted, so the app makes no third-party requests.
- Secrets live only in environment variables and are never committed (`.env*` is git-ignored).
