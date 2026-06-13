#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

cd "${ROOT_DIR}"

if [[ -f .env.local ]]; then
  set -a
  source ./.env.local
  set +a
fi

if [[ -f .env ]]; then
  set -a
  source ./.env
  set +a
fi

BRIDGE_PORT="${TAILSCALE_AUTH_BRIDGE_PORT:-8787}"
BIND_HOST="${TAILSCALE_AUTH_BIND_HOST:-127.0.0.1}"
SERVE_PATH="${TAILSCALE_AUTH_SERVE_PATH:-/session}"

if [[ "${SERVE_PATH}" != /* ]]; then
  SERVE_PATH="/${SERVE_PATH}"
fi

for _ in {1..30}; do
  if tailscale status --json >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if tailscale status --json >/dev/null 2>&1; then
  tailscale serve --bg --set-path "${SERVE_PATH}" "http://${BIND_HOST}:${BRIDGE_PORT}" >/dev/null 2>&1 || true
fi

exec node scripts/tailscale-auth-bridge.mjs
