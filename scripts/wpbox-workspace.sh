#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_ROOT="/Users/erikbabcan/builder1s-wordpressdashboard"
readonly WORDPRESS_PORT="18090"
readonly OLD_WORDPRESS_PORT="8090"
readonly LOCAL_ADMIN_USER="admin"
readonly LOCAL_ADMIN_PASSWORD="admin123"
readonly LOCAL_ADMIN_EMAIL="admin@example.test"
readonly SITE_TITLE="wpBOX Local WordPress"
readonly IOS_PROJECT="ios/LarsenEvansWpBox/LarsenEvansWpBox.xcodeproj"
readonly IOS_SCHEME="LarsenEvansWpBox"
readonly IOS_BUNDLE_ID="sk.larsenevans.wpbox.erik"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/local-wordpress/docker-compose.yml"
WORDPRESS_URL="http://localhost:${WORDPRESS_PORT}"
IOS_DERIVED_DATA="${ROOT_DIR}/.wpbox/ios-derived-data"

die() {
  printf 'wpBOX workspace guard: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '==> %s\n' "$*"
}

usage() {
  cat <<USAGE
wpBOX closed workspace helper

Usage:
  scripts/wpbox-workspace.sh start
  scripts/wpbox-workspace.sh stop
  scripts/wpbox-workspace.sh status
  scripts/wpbox-workspace.sh check
  scripts/wpbox-workspace.sh ios-sim
  scripts/wpbox-workspace.sh shell
  scripts/wpbox-workspace.sh reset --confirm-delete-local-wpbox-volumes

Pinned workspace:
  ${EXPECTED_ROOT}

Pinned local WordPress:
  ${WORDPRESS_URL}

Safe defaults:
  - uses only local-wordpress/docker-compose.yml from this repo
  - keeps wpBOX on port ${WORDPRESS_PORT}
  - runs WordPress on the Mac and the iOS app in Simulator
  - refuses to run from another checkout/path
  - never deletes volumes unless the long reset confirmation flag is supplied

Simulator options:
  WPBOX_SIMULATOR_ID=<udid> scripts/wpbox-workspace.sh ios-sim
  WPBOX_SIMULATOR_NAME="iPhone 17" scripts/wpbox-workspace.sh ios-sim
USAGE
}

guard_workspace() {
  [[ "${ROOT_DIR}" == "${EXPECTED_ROOT}" ]] ||
    die "wrong workspace: ${ROOT_DIR}. Expected ${EXPECTED_ROOT}"
  [[ -f "${ROOT_DIR}/package.json" ]] || die "package.json missing"
  [[ -f "${COMPOSE_FILE}" ]] || die "compose file missing: ${COMPOSE_FILE}"
  [[ -d "${ROOT_DIR}/ios/LarsenEvansWpBox" ]] || die "iOS wpBOX project missing"
  [[ -d "${ROOT_DIR}/${IOS_PROJECT}" ]] || die "iOS Xcode project missing: ${IOS_PROJECT}"
}

compose() {
  docker compose --project-directory "${ROOT_DIR}/local-wordpress" -f "${COMPOSE_FILE}" "$@"
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed or not on PATH"
  docker compose version >/dev/null 2>&1 || die "Docker Compose is not available"
}

require_xcode_tools() {
  command -v xcodebuild >/dev/null 2>&1 || die "xcodebuild is not installed or not on PATH"
  command -v xcrun >/dev/null 2>&1 || die "xcrun is not installed or not on PATH"
}

port_owner() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

wpbox_container_uses_port() {
  docker ps \
    --filter "name=^/wpbox-local-wordpress$" \
    --format '{{.Ports}}' |
    grep -q ":${WORDPRESS_PORT}->"
}

guard_port() {
  local owner
  owner="$(port_owner "${WORDPRESS_PORT}")"
  if [[ -n "${owner}" ]] && ! wpbox_container_uses_port; then
    printf '%s\n' "${owner}" >&2
    docker ps --format 'Docker container: {{.Names}} {{.Ports}}' |
      grep ":${WORDPRESS_PORT}->" >&2 || true
    die "port ${WORDPRESS_PORT} is already used by another process"
  fi
}

start_wordpress() {
  require_docker
  guard_port
  info "Starting isolated local WordPress on ${WORDPRESS_URL}"
  compose up -d db wordpress
  info "Ensuring WordPress is installed and pinned to ${WORDPRESS_URL}"
  compose --profile tools run --rm wpcli sh -lc \
    "until wp db check --allow-root >/dev/null 2>&1; do sleep 2; done; \
     if wp core is-installed --allow-root >/dev/null 2>&1; then \
       wp option update home '${WORDPRESS_URL}' --allow-root >/dev/null; \
       wp option update siteurl '${WORDPRESS_URL}' --allow-root >/dev/null; \
       if wp user get '${LOCAL_ADMIN_USER}' --allow-root >/dev/null 2>&1; then \
         wp user update '${LOCAL_ADMIN_USER}' --user_pass='${LOCAL_ADMIN_PASSWORD}' --user_email='${LOCAL_ADMIN_EMAIL}' --role=administrator --allow-root >/dev/null; \
       else \
         wp user create '${LOCAL_ADMIN_USER}' '${LOCAL_ADMIN_EMAIL}' --user_pass='${LOCAL_ADMIN_PASSWORD}' --role=administrator --allow-root >/dev/null; \
       fi; \
       wp rewrite flush --hard --allow-root >/dev/null; \
     else \
       wp core install --allow-root \
         --url='${WORDPRESS_URL}' \
         --title='${SITE_TITLE}' \
         --admin_user='${LOCAL_ADMIN_USER}' \
         --admin_password='${LOCAL_ADMIN_PASSWORD}' \
         --admin_email='${LOCAL_ADMIN_EMAIL}' \
         --skip-email >/dev/null; \
       wp rewrite structure '/%postname%/' --allow-root >/dev/null; \
       wp rewrite flush --hard --allow-root >/dev/null; \
     fi"
  info "Ready: ${WORDPRESS_URL}/wp-json"
}

stop_wordpress() {
  require_docker
  info "Stopping wpBOX local WordPress without deleting volumes"
  compose down
}

status_wordpress() {
  require_docker
  compose ps
  printf '\nREST check:\n'
  curl -sS -w '\nHTTP %{http_code} %{content_type}\n' \
    "${WORDPRESS_URL}/wp-json/wp/v2/posts/?per_page=1&_fields=id,slug,title,link" || true
}

wait_for_wordpress_rest() {
  local attempt
  for attempt in {1..30}; do
    if curl -fsS "${WORDPRESS_URL}/wp-json/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  die "WordPress REST did not become ready at ${WORDPRESS_URL}/wp-json"
}

check_workspace() {
  require_docker
  guard_port
  info "Workspace: ${ROOT_DIR}"
  info "WordPress URL: ${WORDPRESS_URL}"
  info "Checking old port ${OLD_WORDPRESS_PORT} is not this wpBOX target"
  if curl --max-time 2 -sS "http://localhost:${OLD_WORDPRESS_PORT}/wp-json/" >/dev/null 2>&1; then
    info "Old port ${OLD_WORDPRESS_PORT} responds. Leave it for the other project; wpBOX uses ${WORDPRESS_PORT}."
  else
    info "Old port ${OLD_WORDPRESS_PORT} is not responding."
  fi
  status_wordpress
}

open_shell() {
  cd "${ROOT_DIR}"
  export WPBOX_WORKSPACE_ROOT="${ROOT_DIR}"
  export WPBOX_WORDPRESS_URL="${WORDPRESS_URL}"
  export WPBOX_WORDPRESS_PORT="${WORDPRESS_PORT}"
  export WPBOX_COMPOSE_FILE="${COMPOSE_FILE}"
  info "Opening guarded shell in ${ROOT_DIR}"
  info "WPBOX_WORDPRESS_URL=${WPBOX_WORDPRESS_URL}"
  exec "${SHELL:-/bin/bash}" -l
}

reset_wordpress() {
  [[ "${1:-}" == "--confirm-delete-local-wpbox-volumes" ]] ||
    die "reset deletes local wpBOX WordPress volumes. Re-run with --confirm-delete-local-wpbox-volumes"
  require_docker
  info "Deleting only wpBOX local WordPress containers and volumes"
  compose down -v
}

first_booted_simulator_id() {
  xcrun simctl list devices booted available |
    awk -F'[()]' '/iPhone|iPad/ { print $2; exit }'
}

simulator_id_for_name() {
  local simulator_name="${WPBOX_SIMULATOR_NAME:-iPhone 17}"
  xcrun simctl list devices available |
    awk -v name="${simulator_name}" -F'[()]' \
      '$0 ~ "^[[:space:]]*" name " \\(" { id=$2 } END { if (id != "") print id }'
}

select_simulator_id() {
  if [[ -n "${WPBOX_SIMULATOR_ID:-}" ]]; then
    printf '%s\n' "${WPBOX_SIMULATOR_ID}"
    return 0
  fi

  local booted_id
  booted_id="$(first_booted_simulator_id)"
  if [[ -n "${booted_id}" ]]; then
    printf '%s\n' "${booted_id}"
    return 0
  fi

  local named_id
  named_id="$(simulator_id_for_name)"
  [[ -n "${named_id}" ]] || die "No available simulator found. Set WPBOX_SIMULATOR_ID or WPBOX_SIMULATOR_NAME."
  printf '%s\n' "${named_id}"
}

boot_simulator() {
  local simulator_id="$1"
  local state
  state="$(xcrun simctl list devices | awk -v id="${simulator_id}" '$0 ~ id { if ($0 ~ /Booted/) print "Booted"; else print "Shutdown"; exit }')"
  if [[ "${state}" != "Booted" ]]; then
    info "Booting simulator ${simulator_id}"
    xcrun simctl boot "${simulator_id}" >/dev/null
  fi
  xcrun simctl bootstatus "${simulator_id}" -b >/dev/null
  open -a Simulator >/dev/null 2>&1 || true
}

run_ios_simulator() {
  require_xcode_tools
  start_wordpress
  wait_for_wordpress_rest

  local simulator_id
  simulator_id="$(select_simulator_id)"
  boot_simulator "${simulator_id}"

  mkdir -p "${IOS_DERIVED_DATA}"
  local build_log="${ROOT_DIR}/.wpbox/ios-build.log"
  info "Building ${IOS_SCHEME} for simulator ${simulator_id}"
  if ! xcodebuild \
    -project "${ROOT_DIR}/${IOS_PROJECT}" \
    -scheme "${IOS_SCHEME}" \
    -configuration Debug \
    -destination "platform=iOS Simulator,id=${simulator_id}" \
    -derivedDataPath "${IOS_DERIVED_DATA}" \
    CODE_SIGNING_ALLOWED=NO \
    build >"${build_log}" 2>&1; then
    tail -n 120 "${build_log}" >&2 || true
    die "iOS build failed. Full log: ${build_log}"
  fi
  info "Build succeeded. Log: ${build_log}"

  local app_path
  app_path="$(find "${IOS_DERIVED_DATA}/Build/Products/Debug-iphonesimulator" -maxdepth 2 -name "${IOS_SCHEME}.app" -type d | head -n 1)"
  [[ -n "${app_path}" ]] || die "Built app not found in ${IOS_DERIVED_DATA}"

  info "Installing ${app_path}"
  xcrun simctl install "${simulator_id}" "${app_path}"
  info "Launching ${IOS_BUNDLE_ID}"
  xcrun simctl launch "${simulator_id}" "${IOS_BUNDLE_ID}"
  info "Simulator app is running against ${WORDPRESS_URL}"
}

main() {
  guard_workspace
  cd "${ROOT_DIR}"

  case "${1:-}" in
    start)
      start_wordpress
      ;;
    stop)
      stop_wordpress
      ;;
    status)
      status_wordpress
      ;;
    check)
      check_workspace
      ;;
    ios-sim)
      run_ios_simulator
      ;;
    shell)
      open_shell
      ;;
    reset)
      reset_wordpress "${2:-}"
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
