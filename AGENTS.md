# LarsenEvans wpBOX — Agent Guide

WordPress workspace dashboard: React 18 + Vite + Supabase + Firebase Auth + local WordPress + iOS companion app.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query |
| Auth | Firebase Google Sign-In |
| Backend | Supabase (Postgres, RLS, Edge Functions, Storage) |
| WordPress | REST API via `wordpress-proxy` edge function; local Docker on port `18090` |
| Mobile | Swift iOS app in `ios/LarsenEvansWpBox/` |
| Tests | Vitest (unit), Playwright (e2e) |

## Key directories

```
src/
  pages/              Route-level screens
  components/
    workspace/        Main dashboard shell (chat, generator, analyzer, …)
    wordpress/        WP site management + content editors
    ui/               shadcn primitives — extend, don't fork
  lib/wordpress/      WP client, connection, content hooks
    registry/         Blueprint manifests + entity registry (v4.0)
  integrations/       supabase, firebase, lovable clients
supabase/
  migrations/         SQL migrations (append-only, timestamped)
  functions/          Deno edge functions (deploy per function)
local-wordpress/      Isolated Docker WordPress for dev
ios/                  Native iOS wpBOX client
scripts/              wpbox-workspace.sh — local WP + iOS sim orchestration
public/               Static assets + inquiry-embed.js
```

## Routes

- `/` — main workspace
- `/dashboard/wordpress` — WordPress control center
- `/dashboard/github` — GitHub PR review integration
- `/dashboard/launch` — launch audit scanner
- `/reset-password` — Firebase password reset

## Data Blueprint registry (v4.0)

- Entity definitions: `src/lib/wordpress/registry/entities.ts` (`BASE_ENTITIES`).
- Blueprint manifests: `src/lib/wordpress/registry/manifests/*.json` (e.g. `business-web`).
- Shared embedded types (`SeoMeta`, `SyncMeta`, `CtaButton`): `registry/types.ts`.
- Content row types + table maps: `src/lib/wordpress/content/types.ts`.
- Resolve entities for a blueprint: `getEntitiesForBlueprint('business-web')` from `@/lib/wordpress/registry`.

## Edge functions

| Function | Purpose |
|----------|---------|
| `wordpress-proxy` | Authenticated WP REST proxy |
| `wordpress-connection` | Site credential linking |
| `wordpress-sync` | Content sync |
| `wordpress-cli` | Remote WP-CLI |
| `inquiries-submit` | Public inquiry form submit + file upload |
| `chat` | Workspace AI assistant |
| `github-pr-review` | GitHub webhook PR review |
| `launch-audit` | Site launch readiness audit |

All functions live under `supabase/functions/<name>/index.ts`. Shared code in `supabase/functions/_shared/`.

## Environment variables

Copy `.env.example` → `.env`. Required for frontend:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `VITE_FIREBASE_*` (6 keys)

Never commit `.env`. Edge function secrets are set in Supabase dashboard, not in `.env`.

## Local development

```bash
npm install
npm run dev          # Vite on :8080
npm run lint
npm run test
npm run build

scripts/wpbox-workspace.sh start    # local WordPress :18090
scripts/wpbox-workspace.sh ios-sim  # iOS Simulator + WP
```

## Conventions

1. **Imports**: use `@/` alias (`@/components/ui/button`).
2. **Data fetching**: TanStack Query hooks in `lib/` or `use*.ts` files; avoid fetch in components.
3. **Supabase types**: regenerate from `integrations/supabase/types.ts` after schema changes.
4. **UI**: compose shadcn primitives; match existing Tailwind tokens in `tailwind.config.ts`.
5. **Migrations**: one concern per file; name `YYYYMMDDHHMMSS_description.sql`.
6. **Edge functions**: validate input, return structured `{ ok, error?, data? }`; rate-limit public endpoints.
7. **WordPress paths**: site-scoped; credentials never touch the browser — always via edge functions.
8. **Scope**: minimal diffs; no drive-by refactors; no new markdown unless asked.

## Security

- RLS on all Supabase tables; service role only in edge functions.
- Private storage buckets; signed URLs for downloads.
- Honeypot + rate limits on public inquiry endpoints.
- Local WP credentials (`admin`/`admin123`) are dev-only placeholders.

## Before shipping

- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Edge function tested locally or against staging
- [ ] No secrets in diff
