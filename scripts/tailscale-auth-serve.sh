#!/usr/bin/env bash

set -euo pipefail

BRIDGE_PORT="${TAILSCALE_AUTH_BRIDGE_PORT:-8787}"
BIND_HOST="${TAILSCALE_AUTH_BIND_HOST:-127.0.0.1}"
SERVE_PATH="${TAILSCALE_AUTH_SERVE_PATH:-/session}"

if [[ "${SERVE_PATH}" != /* ]]; then
  SERVE_PATH="/${SERVE_PATH}"
fi

TARGET="http://${BIND_HOST}:${BRIDGE_PORT}"

tailscale serve --bg --set-path "${SERVE_PATH}" "${TARGET}"
tailscale serve status

python3 - <<'PY'
import json, subprocess, os

serve_path = os.environ.get("TAILSCALE_AUTH_SERVE_PATH", "/session")
if not serve_path.startswith("/"):
    serve_path = "/" + serve_path

try:
    data = json.loads(subprocess.check_output(["tailscale", "status", "--json"], text=True))
    dns_name = str(data.get("Self", {}).get("DNSName", "")).rstrip(".")
    if dns_name:
        print(f"VITE_TAILSCALE_AUTH_URL=https://{dns_name}{serve_path}")
except Exception:
    pass
PY
