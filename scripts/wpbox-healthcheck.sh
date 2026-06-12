#!/usr/bin/env bash
# wpBOX full-stack healthcheck — spusti keď niečo prestane fungovať.
#
#   npm run healthcheck
#   WPBOX_EMAIL=you@mail.com WPBOX_PASSWORD='secret' npm run healthcheck
#   WP_WRITE_TEST=1 npm run healthcheck   # draft post create+delete (web24)
#
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

WPBOX_PROD_URL="${WPBOX_PROD_URL:-https://larsenevans-wpbox.vercel.app}"
WP_HEALTH_WEB24="${WP_HEALTH_WEB24:-https://larsenevans.com/web24}"
WP_HEALTH_ROOT="${WP_HEALTH_ROOT:-https://larsenevans.com}"
WPBOX_EMAIL="${WPBOX_EMAIL:-}"
WPBOX_PASSWORD="${WPBOX_PASSWORD:-}"
WP_WRITE_TEST="${WP_WRITE_TEST:-0}"

PASS=0
FAIL=0
WARN=0
SKIP=0
REPORT_JSON="[]"

pass() { PASS=$((PASS + 1)); printf '\033[32m✓ PASS\033[0m %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '\033[31m✗ FAIL\033[0m %s\n' "$1"; }
warn() { WARN=$((WARN + 1)); printf '\033[33m! WARN\033[0m %s\n' "$1"; }
skip() { SKIP=$((SKIP + 1)); printf '\033[90m- SKIP\033[0m %s\n' "$1"; }
section() { printf '\n\033[1;36m━━ %s ━━\033[0m\n' "$1"; }

http_code() {
  curl -sS -o /dev/null -w "%{http_code}" "$@"
}

proxy_call() {
  local token="$1" site_id="$2" path="$3" query="${4:-}"
  local body
  if [[ -n "$query" ]]; then
    body=$(python3 -c "import json,sys; print(json.dumps({'siteId':sys.argv[1],'method':'GET','path':sys.argv[2],'query':json.loads(sys.argv[3])}))" \
      "$site_id" "$path" "$query")
  else
    body=$(python3 -c "import json,sys; print(json.dumps({'siteId':sys.argv[1],'method':'GET','path':sys.argv[2]}))" \
      "$site_id" "$path")
  fi
  curl -sS -w $'\nHTTP:%{http_code}' -X POST "${VITE_SUPABASE_URL}/functions/v1/wordpress-proxy" \
    -H "Authorization: Bearer ${token}" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

section "1. Env & konfigurácia"
if [[ -n "${VITE_SUPABASE_PROJECT_ID:-}" ]]; then
  if [[ -f supabase/config.toml ]] && grep -q "project_id = \"${VITE_SUPABASE_PROJECT_ID}\"" supabase/config.toml; then
    pass "VITE_SUPABASE_PROJECT_ID sedí s supabase/config.toml (${VITE_SUPABASE_PROJECT_ID})"
  else
    warn "VITE_SUPABASE_PROJECT_ID (${VITE_SUPABASE_PROJECT_ID}) sa nezhoduje s config.toml"
  fi
else
  warn "VITE_SUPABASE_PROJECT_ID nie je nastavený"
fi

if [[ "$VITE_SUPABASE_URL" == *"qytsiddrksybwpqldjfj"* ]]; then
  pass "Supabase URL → nový projekt qytsiddrksybwpqldjfj"
else
  warn "Supabase URL neukazuje na qytsiddrksybwpqldjfj: ${VITE_SUPABASE_URL}"
fi

section "2. Supabase platforma"
code=$(http_code "${VITE_SUPABASE_URL}/auth/v1/health" -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}")
if [[ "$code" == "200" ]]; then pass "Auth health HTTP 200"; else fail "Auth health HTTP ${code}"; fi

REQUIRED_TABLES=(wp_sites wp_audit_log)
OPTIONAL_TABLES=(wp_company_info wp_about wp_services wp_sync_outbox wp_blueprint_instances)

for t in "${REQUIRED_TABLES[@]}"; do
  code=$(http_code \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    "${VITE_SUPABASE_URL}/rest/v1/${t}?select=id&limit=0")
  if [[ "$code" == "200" ]]; then pass "Tabuľka ${t} dostupná"; else fail "Tabuľka ${t} HTTP ${code}"; fi
done

for t in "${OPTIONAL_TABLES[@]}"; do
  code=$(http_code \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    "${VITE_SUPABASE_URL}/rest/v1/${t}?select=id&limit=0")
  if [[ "$code" == "200" ]]; then pass "Tabuľka ${t} dostupná"; else warn "Tabuľka ${t} HTTP ${code} (voliteľná)"; fi
done

REQUIRED_FNS=(wordpress-proxy wordpress-sync wordpress-cli)
OPTIONAL_FNS=(wordpress-connection)

for fn in "${REQUIRED_FNS[@]}"; do
  code=$(http_code -X OPTIONS "${VITE_SUPABASE_URL}/functions/v1/${fn}")
  if [[ "$code" == "200" || "$code" == "204" ]]; then pass "Edge fn ${fn} OPTIONS"; else fail "Edge fn ${fn} OPTIONS HTTP ${code}"; fi
done

for fn in "${OPTIONAL_FNS[@]}"; do
  code=$(http_code -X OPTIONS "${VITE_SUPABASE_URL}/functions/v1/${fn}")
  if [[ "$code" == "200" || "$code" == "204" ]]; then pass "Edge fn ${fn} OPTIONS"; else warn "Edge fn ${fn} OPTIONS HTTP ${code} (nedeploynutá?)"; fi
done

code=$(http_code -X POST "${VITE_SUPABASE_URL}/functions/v1/wordpress-proxy" \
  -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" -H "Content-Type: application/json" -d '{}')
if [[ "$code" == "401" ]]; then pass "wordpress-proxy vyžaduje JWT (401 bez tokenu)"; else warn "wordpress-proxy bez JWT → HTTP ${code} (očakávané 401)"; fi

section "3. Produkcia wpBOX (Vercel)"
code=$(http_code "${WPBOX_PROD_URL}/")
if [[ "$code" == "200" ]]; then pass "Produkcia ${WPBOX_PROD_URL} HTTP 200"; else fail "Produkcia ${WPBOX_PROD_URL} HTTP ${code}"; fi

section "4. WordPress verejné REST"
for label in WEB24 ROOT; do
  base="${WP_HEALTH_WEB24}"
  [[ "$label" == "ROOT" ]] && base="${WP_HEALTH_ROOT}"
  code=$(http_code "${base%/}/wp-json/")
  if [[ "$code" == "200" ]]; then
    name=$(curl -sS "${base%/}/wp-json/" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','?'))" 2>/dev/null || echo "?")
    pass "${label} ${base} → ${name} (HTTP 200)"
  else
    fail "${label} ${base}/wp-json/ HTTP ${code}"
  fi
done

cors=$(curl -sS -I -H "Origin: ${WPBOX_PROD_URL}" "${WP_HEALTH_WEB24%/}/wp-json/" 2>/dev/null | grep -i "access-control-allow-origin" || true)
if [[ -n "$cors" ]]; then pass "CORS web24 pre ${WPBOX_PROD_URL}"; else warn "CORS hlavička pre web24 + wpBOX produkciu nenájdená"; fi

section "5. Supabase Auth + wp_sites"
ACCESS=""
if [[ -z "$WPBOX_EMAIL" || -z "$WPBOX_PASSWORD" ]]; then
  skip "JWT login — nastav WPBOX_EMAIL a WPBOX_PASSWORD (GitHub Actions secrets) pre plný test proxy"
else
  LOGIN_BODY=$(python3 -c 'import json,os; print(json.dumps({"email":os.environ["WPBOX_EMAIL"],"password":os.environ["WPBOX_PASSWORD"].strip()}))')
  TOKEN_JSON=$(curl -sS -X POST "${VITE_SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_BODY")
  ACCESS=$(printf '%s' "$TOKEN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
  if [[ -n "$ACCESS" ]]; then
    pass "JWT login ${WPBOX_EMAIL}"
    SITES_JSON=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/wp_sites?select=id,label,base_url,site_type" \
      -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
      -H "Authorization: Bearer ${ACCESS}")
    count=$(printf '%s' "$SITES_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null || echo 0)
    if [[ "$count" -gt 0 ]]; then
      pass "wp_sites pre používateľa: ${count} záznam(ov)"
      printf '%s' "$SITES_JSON" | python3 -c "
import sys,json
for s in json.load(sys.stdin):
    print(f\"    • {s.get('label')} → {s.get('base_url')} ({s.get('id')})\")
" 2>/dev/null || true
    else
      warn "Žiadne wp_sites — pripoj WordPress v dashboarde"
    fi
  else
    fail "JWT login zlyhal: WPBOX_EMAIL/WPBOX_PASSWORD are present but invalid. Update GitHub Actions secrets."
  fi
fi

section "6. wordpress-proxy (read)"
if [[ -z "$ACCESS" ]]; then
  skip "Proxy testy — chýba JWT"
else
  WEB24_ID=$(curl -sS "${VITE_SUPABASE_URL}/rest/v1/wp_sites?select=id&base_url=eq.${WP_HEALTH_WEB24}" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${ACCESS}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null || true)

  if [[ -z "$WEB24_ID" ]]; then
    warn "Site ${WP_HEALTH_WEB24} nie je v wp_sites — preskočím proxy testy web24"
  else
    for spec in "posts|{\"per_page\":\"5\",\"_fields\":\"id,slug,title,status\"}" "settings|" "plugins|"; do
      path="${spec%%|*}"
      query="${spec#*|}"
      resp=$(proxy_call "$ACCESS" "$WEB24_ID" "$path" "${query:-}")
      http="${resp##*HTTP:}"
      body="${resp%HTTP:*}"
      if [[ "$http" == "200" ]]; then
        detail=$(printf '%s' "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,list): print(f'{len(d)} položiek')
elif isinstance(d,dict) and 'title' in d: print(d.get('title','settings OK'))
else: print('OK')
" 2>/dev/null || echo "OK")
        pass "proxy GET ${path} web24 → ${detail}"
      else
        fail "proxy GET ${path} web24 HTTP ${http}"
        printf '%s\n' "$body" | head -2
      fi
    done

    resp=$(proxy_call "$ACCESS" "$WEB24_ID" "users/me" '{"context":"edit"}')
    http="${resp##*HTTP:}"
    if [[ "$http" == "200" ]]; then
      roles=$(printf '%s' "${resp%HTTP:*}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(','.join(d.get('roles') or []) or 'no-roles')" 2>/dev/null || echo "?")
      pass "proxy users/me web24 (roles: ${roles})"
    else
      fail "proxy users/me web24 HTTP ${http}"
    fi
  fi
fi

section "7. Zápis (voliteľné WP_WRITE_TEST=1)"
if [[ "$WP_WRITE_TEST" != "1" ]]; then
  skip "Write test — nastav WP_WRITE_TEST=1 pre draft create+delete"
elif [[ -z "$ACCESS" || -z "$WEB24_ID" ]]; then
  skip "Write test — chýba JWT alebo web24 site_id"
else
  CREATE_BODY=$(python3 -c "import json; print(json.dumps({
    'siteId': '$WEB24_ID',
    'method': 'POST',
    'path': 'posts',
    'body': {'title': 'wpBOX healthcheck draft', 'status': 'draft', 'content': 'auto test'}
  }))")
  resp=$(curl -sS -w $'\nHTTP:%{http_code}' -X POST "${VITE_SUPABASE_URL}/functions/v1/wordpress-proxy" \
    -H "Authorization: Bearer ${ACCESS}" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$CREATE_BODY")
  http="${resp##*HTTP:}"
  body="${resp%HTTP:*}"
  post_id=$(printf '%s' "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  if [[ "$http" == "200" || "$http" == "201" ]] && [[ -n "$post_id" ]]; then
    pass "proxy POST draft post id=${post_id}"
    DEL_BODY=$(python3 -c "import json; print(json.dumps({'siteId':'$WEB24_ID','method':'DELETE','path':'posts/${post_id}','query':{'force':'true'}}))")
    del_http=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${VITE_SUPABASE_URL}/functions/v1/wordpress-proxy" \
      -H "Authorization: Bearer ${ACCESS}" \
      -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "$DEL_BODY")
    if [[ "$del_http" == "200" ]]; then pass "proxy DELETE draft post id=${post_id}"; else fail "proxy DELETE HTTP ${del_http}"; fi
  else
    fail "proxy POST draft HTTP ${http}"
  fi
fi

section "8. Vitest — WordPress schémy"
if npm run test -- --run src/lib/wordpress/schemas.test.ts 2>/dev/null; then
  pass "Vitest schemas.test.ts"
else
  fail "Vitest schemas.test.ts — spusti: npm run test -- src/lib/wordpress/schemas.test.ts"
fi

section "Súhrn"
printf '\n\033[1mPASS: %s  FAIL: %s  WARN: %s  SKIP: %s\033[0m\n' "$PASS" "$FAIL" "$WARN" "$SKIP"

if [[ "$FAIL" -gt 0 ]]; then
  printf '\n\033[31mHealthcheck ZLYHAL — oprav FAIL položky vyššie.\033[0m\n'
  exit 1
fi

printf '\n\033[32mHealthcheck OK\033[0m'
if [[ "$WARN" -gt 0 ]]; then printf ' (s %s varovaniami)' "$WARN"; fi
printf '\n'
exit 0
