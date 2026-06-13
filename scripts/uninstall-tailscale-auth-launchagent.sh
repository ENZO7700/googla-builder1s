#!/usr/bin/env bash

set -euo pipefail

PLIST_PATH="${HOME}/Library/LaunchAgents/sk.larsenevans.wpbox.tailscale-auth.plist"
LABEL="sk.larsenevans.wpbox.tailscale-auth"
GUI_DOMAIN="gui/$(id -u)"

launchctl bootout "${GUI_DOMAIN}" "${PLIST_PATH}" >/dev/null 2>&1 || true
rm -f "${PLIST_PATH}"
launchctl disable "${GUI_DOMAIN}/${LABEL}" >/dev/null 2>&1 || true

echo "Removed LaunchAgent: ${PLIST_PATH}"
