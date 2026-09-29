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
2. Sign up / sign in, roles
3. Database schema + Row Level Security
4. Synthetic data
5. Board, article page, live validation, approval flow
6. Google Drive import and conversion
7. AI metadata suggestions
8. Publish as a pull request + live verification
9. Polish, states, Cloudflare domain

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
