#!/usr/bin/env bash
# verification script for wpBOX credentials and Supabase connectivity
#
# Usage:
#   bash scripts/test-credentials.sh
#
set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}${BOLD}=== wpBOX Credentials & API Verification ===${NC}\n"

# 1. Check .env file
if [[ ! -f .env ]]; then
  echo -e "${RED}✗ CHYBA: Súbor .env neexistuje.${NC}"
  echo "Vytvorte ho skopírovaním z .env.example."
  exit 1
fi

echo -e "${GREEN}✓ Súbor .env nájdený.${NC}"

# Source .env
set -a
source .env
set +a

# 2. Check required variables
REQUIRED_VARS=(
  VITE_SUPABASE_URL
  VITE_SUPABASE_PUBLISHABLE_KEY
  VITE_SUPABASE_PROJECT_ID
  WPBOX_EMAIL
  WPBOX_PASSWORD
)

missing=0
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}✗ CHYBA: Premenná $var chýba v .env.${NC}"
    missing=1
  fi
done

if [[ $missing -eq 1 ]]; then
  exit 1
fi
echo -e "${GREEN}✓ Všetky potrebné premenné sú definované v .env.${NC}"

# 3. Test Supabase API Connection
echo -e "\n${BLUE}Testujem spojenie so Supabase API...${NC}"
health_url="${VITE_SUPABASE_URL}/auth/v1/health"
status_code=$(curl -s -o /dev/null -w "%{http_code}" -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" "$health_url")

if [[ "$status_code" -eq 200 ]]; then
  echo -e "${GREEN}✓ Spojenie s API úspešné (HTTP 200).${NC}"
else
  echo -e "${RED}✗ CHYBA: Spojenie s API zlyhalo (HTTP $status_code).${NC}"
  echo "Skontrolujte správnosť VITE_SUPABASE_URL a VITE_SUPABASE_PUBLISHABLE_KEY."
  exit 1
fi

# 4. Test Supabase Auth JWT Login
echo -e "\n${BLUE}Testujem JWT login pre ${WPBOX_EMAIL}...${NC}"
login_url="${VITE_SUPABASE_URL}/auth/v1/token?grant_type=password"
login_payload=$(cat <<EOF
{
  "email": "$WPBOX_EMAIL",
  "password": "$WPBOX_PASSWORD"
}
EOF
)

login_response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$login_url" \
  -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$login_payload")

http_status=$(echo "$login_response" | tr -d '\r' | grep "HTTP_STATUS:" | cut -d: -f2)
response_body=$(echo "$login_response" | grep -v "HTTP_STATUS:")

if [[ "$http_status" -eq 200 ]]; then
  echo -e "${GREEN}✓ JWT prihlásenie úspešné (HTTP 200)!${NC}"
  # Extract token (basic extraction)
  access_token=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
  if [[ -n "$access_token" ]]; then
    echo -e "${GREEN}✓ Access Token bol úspešne vygenerovaný.${NC}"
  else
    echo -e "${YELLOW}! UPOZORNENIE: Nepodarilo sa parsovať access_token z odpovede.${NC}"
  fi
else
  echo -e "${RED}✗ CHYBA: JWT prihlásenie zlyhalo (HTTP $http_status).${NC}"
  echo -e "${RED}Odozva zo servera:${NC}"
  echo "$response_body"
  echo -e "\n${YELLOW}Riešenie:${NC}"
  echo "1. Uistite sa, že používateľ '$WPBOX_EMAIL' existuje v Supabase Dashboard -> Authentication -> Users."
  echo "2. Skontrolujte, či je heslo správne v GitHub Secrets alebo v .env."
  echo "3. Overte, či v GitHub Secrets nie sú uložené staré kľúče/heslá."
  exit 1
fi

# 5. Test wordpress-proxy Edge Function with JWT
if [[ -n "$access_token" ]]; then
  echo -e "\n${BLUE}Testujem wordpress-proxy edge funkciu s JWT tokenom...${NC}"
  proxy_url="${VITE_SUPABASE_URL}/functions/v1/wordpress-proxy"
  proxy_status=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$proxy_url" \
    -H "Authorization: Bearer $access_token" \
    -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}")

  if [[ "$proxy_status" -eq 200 || "$proxy_status" -eq 204 ]]; then
    echo -e "${GREEN}✓ Edge funkcia wordpress-proxy je prístupná (HTTP $proxy_status).${NC}"
  else
    echo -e "${RED}✗ CHYBA: Edge funkcia vrátila chybu (HTTP $proxy_status).${NC}"
    echo "Uistite sa, že je funkcia wordpress-proxy deploynutá na Supabase."
  fi
fi

echo -e "\n${GREEN}${BOLD}=== Všetky kontroly prebehli úspešne! ===${NC}"
