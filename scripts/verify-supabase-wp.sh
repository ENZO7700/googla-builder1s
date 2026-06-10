#!/usr/bin/env bash
# Smoke test: Supabase qytsiddrksybwpqldjfj + WordPress edge functions
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${VITE_SUPABASE_URL:?Missing VITE_SUPABASE_URL}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?Missing VITE_SUPABASE_PUBLISHABLE_KEY}"

WP_BASE="${WP_TEST_BASE_URL:-https://wordpress.org/news}"

info() { printf '==> %s\n' "$*"; }

info "REST tables"
for t in wp_sites wp_blueprint_instances wp_sync_outbox; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    "${VITE_SUPABASE_URL}/rest/v1/${t}?select=id&limit=0")
  printf '  %s -> HTTP %s\n' "$t" "$code"
done

info "wordpress-proxy OPTIONS"
curl -sS -o /dev/null -w "  HTTP %{http_code}\n" -X OPTIONS \
  "${VITE_SUPABASE_URL}/functions/v1/wordpress-proxy"

info "Public WP REST: ${WP_BASE}"
code=$(curl -sS -o /dev/null -w "%{http_code}" "${WP_BASE%/}/wp-json/")
printf '  wp-json root -> HTTP %s\n' "$code"

if [[ -n "${WP_TEST_EMAIL:-}" && -n "${WP_TEST_PASSWORD:-}" ]]; then
  info "JWT login (${WP_TEST_EMAIL})"
  ACCESS=$(curl -sS -X POST "${VITE_SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${WP_TEST_EMAIL}\",\"password\":\"${WP_TEST_PASSWORD}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
  if [[ -z "$ACCESS" ]]; then
    echo "  JWT login failed"
    exit 1
  fi
  printf '  token length: %s\n' "${#ACCESS}"

  if [[ -n "${WP_TEST_SITE_URL:-}" && -n "${WP_TEST_WP_USER:-}" && -n "${WP_TEST_APP_PASSWORD:-}" ]]; then
    info "wordpress-connection save (${WP_TEST_SITE_URL})"
    curl -sS -X POST "${VITE_SUPABASE_URL}/functions/v1/wordpress-connection" \
      -H "Authorization: Bearer ${ACCESS}" \
      -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"action\":\"save\",\"label\":\"Remote WP\",\"baseUrl\":\"${WP_TEST_SITE_URL}\",\"username\":\"${WP_TEST_WP_USER}\",\"appPassword\":\"${WP_TEST_APP_PASSWORD}\"}"
    echo
  fi
fi

info "Done. Pre plný proxy test nastav WP_TEST_SITE_URL, WP_TEST_WP_USER, WP_TEST_APP_PASSWORD."
