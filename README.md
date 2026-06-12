# LarsenEvans wpBOX

WordPress workspace dashboard with Supabase-backed content tools, Firebase Google Sign-In, GitHub PR review, launch audit, and an iOS companion app.

## Quick start

```bash
cp .env.example .env   # fill in Supabase + Firebase keys
npm install
npm run dev            # http://localhost:8080
```

## Elite dev workflow

This repo is configured for Cursor **elite developer mode**:

- `AGENTS.md` — full project context for AI agents
- `.cursor/rules/` — architecture, React/TS, Supabase, WordPress/iOS rules
- `npm run ci` — lint + test + build (same gate as GitHub Actions)
- `npm run test:schemas` — WordPress REST contract tests (Zod fixtures)

## CI/CD Golden Standard

```
Push/PR ─┬─ quality-gate: lint → typecheck → test (12) → schemas → audit → build → bundle budget
         │
         └─ (PR + migrations) supabase-migrations: local db reset

main ──── integration: + live WP contract (4 tests) + healthcheck (28 checks)

Vercel deploy success ─── deployment_status ─┬─ smoke:preview (HTTP 200 + timing + brand)
                                             └─ healthcheck:write (Supabase + WP proxy + draft create/delete)

Daily 06:00 UTC ─── healthcheck:write ─── auto GitHub issue on failure
```

### Workflows

| File | Trigger | Čo robí |
|------|---------|---------|
| `wpbox-ci.yml` | PR + push `main` | lint → typecheck → test → schemas → build → bundle budget |
| `wpbox-ci.yml` integration | push `main` | + live WP contract tests + `npm run healthcheck` |
| `wpbox-deploy-smoke.yml` | Vercel `deployment_status`, daily cron, manual | smoke:preview + healthcheck:write |
| `wpbox-supabase-migrations.yml` | PR (migrations changed) | `supabase db reset` on local DB |

### GitHub Secrets (Settings → Secrets → Actions)

| Secret | Popis |
|--------|-------|
| `VITE_SUPABASE_URL` | `https://qytsiddrksybwpqldjfj.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key |
| `VITE_SUPABASE_PROJECT_ID` | `qytsiddrksybwpqldjfj` |
| `VITE_SUPABASE_JWKS_URL` | `https://qytsiddrksybwpqldjfj.supabase.co/auth/v1/.well-known/jwks.json` |
| `WPBOX_EMAIL` | Supabase test user (nie WP user) |
| `WPBOX_PASSWORD` | heslo test usera |
| `WP_APP_USER` | WordPress user (`magnusevans`) — live API contract |
| `WP_APP_PASSWORD` | WP Application Password (nie Supabase) |

Voliteľné **Variables**: `WPBOX_PROD_URL`, `WP_HEALTH_WEB24`, `WP_HEALTH_ROOT`.

## GitHub

**Repo:** https://github.com/ENZO7700/googla-builder1s

```bash
git clone https://github.com/ENZO7700/googla-builder1s.git
cd googla-builder1s
cp .env.example .env   # Supabase keys + optional WPBOX_EMAIL for healthcheck
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (:8080) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run test:schemas` | WordPress API Zod contract tests |
| `npm run ci` | Lint + test + build (CI gate) |
| `npm run healthcheck` | Full-stack smoke test (Supabase + WP + Vercel) |
| `npm run healthcheck:write` | Healthcheck + draft post create/delete |
| `npm run smoke:preview [url]` | Quick HTTP/timing/brand smoke on deployed URL |
| `npm run test:live` | Live WP contract tests (needs `WP_APP_*` env) |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `scripts/wpbox-workspace.sh start` | Local WordPress (:18090) |
| `scripts/wpbox-workspace.sh ios-sim` | iOS Simulator + local WP |

See `local-wordpress/README.md` for Docker WordPress details.

## Produkcia & sync

| Služba | URL / ref |
|--------|-----------|
| wpBOX (Vercel) | https://larsenevans-wpbox.vercel.app |
| Supabase | `qytsiddrksybwpqldjfj` |
| JWKS URL | `https://qytsiddrksybwpqldjfj.supabase.co/auth/v1/.well-known/jwks.json` |
| JWKS Key ID | `098f705a-44d5-4d28-9fd1-f8f2618465b6` |
| WordPress web24 | https://larsenevans.com/web24 |

**Po zmene kódu:**

```bash
# 1. Supabase (ak meníš SQL alebo edge functions)
supabase link --project-ref qytsiddrksybwpqldjfj
supabase db push
supabase functions deploy wordpress-connection --project-ref qytsiddrksybwpqldjfj
supabase functions deploy wordpress-proxy --project-ref qytsiddrksybwpqldjfj
supabase functions deploy wordpress-sync --project-ref qytsiddrksybwpqldjfj

# 2. GitHub
git add -A && git commit -m "popis" && git push origin main

# 3. Frontend — Vercel auto-deploy po prepojení GitHubu, alebo:
vercel deploy --prod

# 4. Overenie
WPBOX_EMAIL=you@mail.com WPBOX_PASSWORD='...' npm run healthcheck
```

**Vercel ↔ GitHub:** Vercel Dashboard → Project `larsenevans-wpbox` → Settings → Git → Connect `ENZO7700/googla-builder1s` (vyžaduje Vercel GitHub App na účte ENZO7700).

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **Auth**: Firebase
- **Backend**: Supabase (Postgres, Edge Functions, Storage)
- **Mobile**: Swift iOS app (`ios/LarsenEvansWpBox/`)

## Environment

All frontend secrets use `VITE_` prefix. See `.env.example`. Never commit `.env`.

Edge function secrets are configured in the Supabase project dashboard.
