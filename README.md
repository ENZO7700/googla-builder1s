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
- `npm run lint && npm run test && npm run build` — pre-ship gate

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
| `npm run healthcheck` | Full-stack smoke test (Supabase + WP + Vercel) |
| `npm run healthcheck:write` | Healthcheck + draft post create/delete |
| `scripts/wpbox-workspace.sh start` | Local WordPress (:18090) |
| `scripts/wpbox-workspace.sh ios-sim` | iOS Simulator + local WP |

See `local-wordpress/README.md` for Docker WordPress details.

## Produkcia & sync

| Služba | URL / ref |
|--------|-----------|
| wpBOX (Vercel) | https://larsenevans-wpbox.vercel.app |
| Supabase | `qytsiddrksybwpqldjfj` |
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
