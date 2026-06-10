#!/usr/bin/env bash
# Uloží vzdialený WordPress site cez wordpress-connection edge function.
# Použitie:
#   WP_BASE_URL=https://example.com WP_USER=admin WP_APP_PASSWORD='xxxx xxxx' \
#   WPBOX_EMAIL=you@gmail.com WPBOX_PASSWORD='your-supabase-password' \
#   scripts/save-wp-site.sh
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${VITE_SUPABASE_URL:?Chýba VITE_SUPABASE_URL v .env}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?Chýba VITE_SUPABASE_PUBLISHABLE_KEY v .env}"
: "${WP_BASE_URL:?Nastav WP_BASE_URL (napr. https://tvoj-web.sk)}"
: "${WP_USER:?Nastav WP_USER}"
: "${WP_APP_PASSWORD:?Nastav WP_APP_PASSWORD (Application Password)}"
: "${WPBOX_EMAIL:?Nastav WPBOX_EMAIL (Supabase účet)}"
: "${WPBOX_PASSWORD:?Nastav WPBOX_PASSWORD (Supabase heslo)}"

LABEL="${WP_LABEL:-Remote WordPress}"
BASE_URL="${WP_BASE_URL%/}"

TOKEN_JSON=$(curl -sS -X POST "${VITE_SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${WPBOX_EMAIL}\",\"password\":\"${WPBOX_PASSWORD}\"}")

ACCESS=$(printf '%s' "$TOKEN_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))")
if [[ -z "$ACCESS" ]]; then
  echo "Prihlásenie do Supabase zlyhalo:" >&2
  printf '%s\n' "$TOKEN_JSON" >&2
  exit 1
fi

export LABEL BASE_URL="$BASE_URL" WP_USER WP_APP_PASSWORD
PAYLOAD=$(python3 -c "import json,os; print(json.dumps({
  'action': 'save',
  'label': os.environ['LABEL'],
  'baseUrl': os.environ['BASE_URL'],
  'username': os.environ['WP_USER'],
  'appPassword': os.environ['WP_APP_PASSWORD'],
}))")

RESP=$(curl -sS -w "\nHTTP:%{http_code}" -X POST "${VITE_SUPABASE_URL}/functions/v1/wordpress-connection" \
  -H "Authorization: Bearer ${ACCESS}" \
  -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP=$(printf '%s' "$RESP" | tail -1)
BODY=$(printf '%s' "$RESP" | sed '$d')

echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo "$HTTP"

if printf '%s' "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)" 2>/dev/null; then
  SITE_ID=$(printf '%s' "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['site']['id'])")
  echo "OK — site_id: ${SITE_ID}"
  exit 0
fi
exit 1
