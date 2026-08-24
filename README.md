# wpBOX Elite

wpBOX Elite is a cloud workspace for managing, analyzing, and deploying WordPress projects. Built with React, Supabase, Firebase Auth, and Mistral AI via Supabase Edge Functions.

## Quick start

```bash
git clone https://github.com/ENZO7700/googla-builder1s.git
cd googla-builder1s
npm install
cp .env.example .env   # fill in values locally — never commit .env
npm run dev            # http://localhost:8080
```

### Verify locally

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Environment variables

Copy `.env.example` → `.env`. **Key names only** — set values in Vercel or your local shell; never commit secrets.

| Key | Required | Where used |
|-----|----------|------------|
| `VITE_SUPABASE_URL` | yes | Frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Frontend |
| `VITE_SUPABASE_PROJECT_ID` | yes | Frontend |
| `VITE_SUPABASE_JWKS_URL` | yes | JWT verification |
| `VITE_FIREBASE_API_KEY` | yes | Firebase Auth |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes | Firebase Auth |
| `VITE_FIREBASE_PROJECT_ID` | yes | Firebase Auth |
| `VITE_FIREBASE_STORAGE_BUCKET` | yes | Firebase Auth |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes | Firebase Auth |
| `VITE_FIREBASE_APP_ID` | yes | Firebase Auth |
| `WPBOX_EMAIL` | healthcheck only | `npm run healthcheck` |
| `WPBOX_PASSWORD` | healthcheck only | `npm run healthcheck` |
| `WP_APP_USER` | healthcheck only | WordPress live tests |
| `WP_APP_PASSWORD` | healthcheck only | WordPress live tests |
| `WPBOX_PROD_URL` | optional | Smoke / healthcheck target URL |
| `WP_HEALTH_WEB24` | optional | WordPress healthcheck URL |
| `WP_HEALTH_ROOT` | optional | WordPress healthcheck URL |

Edge function secrets (`MISTRAL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`, etc.) are configured in the **Supabase dashboard**, not in `.env`.

## Health endpoints (Vercel)

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness probe — returns `{ "status": "ok" }` |
| `GET /ready` | Readiness probe — returns `{ "status": "ready" }` |

## Deployment (Vercel)

1. Connect the GitHub repo to a Vercel project.
2. Set all `VITE_*` environment variables in Vercel project settings.
3. Add the production domain to Supabase Auth **Redirect URLs**.
4. Deploy Supabase Edge Functions separately (`supabase functions deploy <name>`).
5. Deploy via Vercel (push to `main` or manual deploy).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui |
| Auth | Firebase Google Sign-In |
| Backend | Supabase (Postgres, RLS, Edge Functions) |
| AI | Mistral API (edge functions only) |
| Tests | Vitest, Playwright |

See [AGENTS.md](./AGENTS.md) for architecture details, routes, and conventions.

## Local WordPress (optional)

```bash
scripts/wpbox-workspace.sh start   # Docker WordPress on :18090
```

Dev credentials (`admin` / `admin123`) are for local use only.

---

## Kľúčové vlastnosti (SK)

1. **WordPress Manager** — REST API, FSE Blueprints, headless setups, WP-CLI over SSH.
2. **Mistral AI** — log analysis, code review, script generation via edge functions.
3. **Deploy Pipeline** — push generated HTML/blocks to WordPress as drafts from chat.
4. **Resilience** — global Error Boundaries, exponential backoff, strict JSON validation.
