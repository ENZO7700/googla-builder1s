#!/usr/bin/env bash
# Fail CI when main JS chunk grows beyond budget (+20% over ~2.26 MB baseline).
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${BUNDLE_BUDGET_BYTES:=2700000}"

if [[ ! -d dist/assets ]]; then
  echo "dist/assets missing — run npm run build first"
  exit 1
fi

largest=0
largest_file=""
while IFS= read -r -d '' file; do
  size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  if (( size > largest )); then
    largest=$size
    largest_file=$file
  fi
done < <(find dist/assets -name 'index-*.js' -print0)

if [[ -z "$largest_file" ]]; then
  echo "No index-*.js chunk found in dist/assets"
  exit 1
fi

kb=$((largest / 1024))
budget_kb=$((BUNDLE_BUDGET_BYTES / 1024))
printf 'Main chunk: %s (%s KB) — budget %s KB\n' "$largest_file" "$kb" "$budget_kb"

if (( largest > BUNDLE_BUDGET_BYTES )); then
  echo "Bundle budget exceeded"
  exit 1
fi

echo "Bundle budget OK"
