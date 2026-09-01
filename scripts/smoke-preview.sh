#!/usr/bin/env bash
# Smoke-test a deployed wpBOX preview URL.
#
#   npm run smoke:preview -- https://my-preview-url.vercel.app
#   WPBOX_PROD_URL=https://preview.vercel.app npm run smoke:preview
#
# Checks: HTTP 200 on root, response time < 5s, HTML title contains wpBOX.
# Falls back to WPBOX_PROD_URL when no argument given.
set -Eeuo pipefail

URL="${1:-${WPBOX_PROD_URL:-https://larsenevans-wpbox-prod.vercel.app}}"
URL="${URL%/}"

printf 'Smoke-testing %s\n' "$URL"

FAIL=0
pass() { printf '\033[32m✓ PASS\033[0m %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '\033[31m✗ FAIL\033[0m %s\n' "$1"; }

# Health / ready probes (Vercel serverless routes)
for probe in health ready; do
  probe_code=$(curl -sS -o /dev/null -w '%{http_code}' "${URL}/${probe}")
  if [[ "$probe_code" == "200" ]]; then
    pass "GET /${probe} → HTTP 200"
  else
    fail "GET /${probe} → HTTP ${probe_code} (expected 200)"
  fi
done

start_ms=$(($(date +%s%N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1e9))') / 1000000))

resp=$(curl -sS -w '\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}' "$URL/")
http_code=$(printf '%s' "$resp" | grep '^HTTP_CODE:' | cut -d: -f2)
time_total=$(printf '%s' "$resp" | grep '^TIME_TOTAL:' | cut -d: -f2)
body=$(printf '%s' "$resp" | grep -v '^HTTP_CODE:\|^TIME_TOTAL:')

end_ms=$(($(date +%s%N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1e9))') / 1000000))
dur_ms=$((end_ms - start_ms))

if [[ "$http_code" == "200" ]]; then
  pass "HTTP 200 (${time_total}s)"
else
  fail "HTTP $http_code (expected 200)"
fi

time_ms=$(python3 -c "print(int(float('${time_total}') * 1000))" 2>/dev/null || echo 0)
if (( time_ms < 5000 )); then
  pass "Response time ${time_ms}ms (< 5000ms)"
else
  fail "Response time ${time_ms}ms (> 5000ms budget)"
fi

if printf '%s' "$body" | grep -qi 'wpbox\|larsenevans\|workspace'; then
  pass "HTML contains expected brand marker"
else
  fail "HTML missing brand marker (wpbox/larsenevans/workspace)"
fi

printf '\nSmoke test %s — %s in %sms\n' "$URL" \
  "$( [[ $FAIL -eq 0 ]] && echo 'PASSED' || echo 'FAILED')" "$dur_ms"

exit "$FAIL"
