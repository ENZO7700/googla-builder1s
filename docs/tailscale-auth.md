# Tailscale Auto-Login

This project can auto-sign users into wpBOX when their browser can reach a trusted Tailscale-only auth bridge.

## Why there is a bridge

The public Vercel app cannot directly know whether the browser is connected to your tailnet. Tailscale only exposes user identity to backends that sit behind `tailscale serve` or another tailnet-aware proxy.

This project solves that by using:

1. `VITE_TAILSCALE_AUTH_URL` in the frontend.
2. `scripts/tailscale-auth-bridge.mjs` as a localhost-only bridge.
3. `tailscale serve` to expose that bridge on a `*.ts.net` HTTPS URL.

When wpBOX opens without a Supabase session, it quietly calls the bridge first. If the bridge sees a trusted Tailscale user, it signs into Supabase server-side and returns session tokens to the browser. The browser then calls `supabase.auth.setSession(...)`.

## Required environment variables

The bridge automatically reads local `.env` / `.env.local`, so if you already have `VITE_SUPABASE_*`, `WPBOX_EMAIL`, `WPBOX_PASSWORD`, and `WPBOX_PROD_URL` there, you usually only need to add the explicitly Tailscale-specific overrides below when you want custom behavior.

Set these where the bridge runs when you want to override defaults:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
TAILSCALE_AUTH_ALLOWED_ORIGINS=https://larsenevans-wpbox-prod.vercel.app,http://localhost:8080
TAILSCALE_ALLOWED_LOGINS=larsenevans@proton.me
TAILSCALE_SUPABASE_EMAIL=larsenevans@proton.me
TAILSCALE_SUPABASE_PASSWORD=your-supabase-password
TAILSCALE_AUTH_BRIDGE_PORT=8787
TAILSCALE_AUTH_BIND_HOST=127.0.0.1
TAILSCALE_AUTH_SERVE_PATH=/session
```

Default behavior when the vars above are omitted:

- `SUPABASE_URL` falls back to `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` falls back to `VITE_SUPABASE_PUBLISHABLE_KEY`
- `TAILSCALE_SUPABASE_EMAIL` falls back to `WPBOX_EMAIL`
- `TAILSCALE_SUPABASE_PASSWORD` falls back to `WPBOX_PASSWORD`
- `TAILSCALE_AUTH_ALLOWED_ORIGINS` falls back to `WPBOX_PROD_URL`, the current device `https://<device>.<tailnet>.ts.net`, and local dev origins
- `TAILSCALE_ALLOWED_LOGINS` falls back to the current local Tailscale login if it can be detected

Set this in the frontend app:

```bash
VITE_TAILSCALE_AUTH_URL=https://your-device.your-tailnet.ts.net/session
VITE_TAILSCALE_AUTH_TIMEOUT_MS=2500
```

## Start the bridge

From the project root:

```bash
npm run tailscale:auth-bridge
```

The bridge only listens on `127.0.0.1`. That is intentional. Tailscale's docs recommend localhost-only listeners when trusting `Tailscale-User-*` headers.

## Expose it to the tailnet

Use the helper on the same machine:

```bash
npm run tailscale:auth-serve
```

This adds the auth bridge under `/session` and keeps any existing root `/` handler intact. That matters when you already serve wpBOX or other tools from the same device URL.

You should get a tailnet HTTPS URL like:

```text
https://your-device.your-tailnet.ts.net
```

Use this value for `VITE_TAILSCALE_AUTH_URL`, plus `/session`.

Example:

```text
VITE_TAILSCALE_AUTH_URL=https://your-device.your-tailnet.ts.net/session
```

## Behavior notes

- Auto-login only runs when no Supabase session already exists.
- If the bridge is unreachable, wpBOX falls back to the normal email/password login.
- If Tailscale becomes available after the page already loaded, wpBOX retries on focus / reconnect without forcing the user to refresh immediately.
- Clicking logout suppresses Tailscale auto-login for the current tab so sign-out actually stays signed out.
- The bridge currently logs every allowed Tailscale user into the single Supabase account configured in `TAILSCALE_SUPABASE_EMAIL`.

## Auto-start on macOS

To keep the bridge and `/session` mapping alive automatically after you log into your Mac, install the bundled LaunchAgent:

```bash
npm run tailscale:auth-install
```

This creates:

- `~/Library/LaunchAgents/sk.larsenevans.wpbox.tailscale-auth.plist`
- `~/Library/Logs/wpbox-tailscale-auth.out.log`
- `~/Library/Logs/wpbox-tailscale-auth.err.log`

What it does on each login:

1. loads `.env.local` and `.env`
2. waits for Tailscale to become ready
3. reapplies `tailscale serve --bg --set-path /session http://127.0.0.1:<port>`
4. starts `scripts/tailscale-auth-bridge.mjs`

To remove it later:

```bash
npm run tailscale:auth-uninstall
```
