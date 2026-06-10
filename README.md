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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (:8080) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `scripts/wpbox-workspace.sh start` | Local WordPress (:18090) |
| `scripts/wpbox-workspace.sh ios-sim` | iOS Simulator + local WP |

See `local-wordpress/README.md` for Docker WordPress details.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **Auth**: Firebase
- **Backend**: Supabase (Postgres, Edge Functions, Storage)
- **Mobile**: Swift iOS app (`ios/LarsenEvansWpBox/`)

## Environment

All frontend secrets use `VITE_` prefix. See `.env.example`. Never commit `.env`.

Edge function secrets are configured in the Supabase project dashboard.
