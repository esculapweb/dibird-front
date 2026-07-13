#!/bin/bash
# Wraps `maestro test` so `npm run e2e` needs no extra manual steps:
# loads real test credentials from .maestro/.env.local (gitignored, not
# committed) and auto-picks the currently booted iOS simulator, working
# around a Maestro quirk where device auto-detection can hang forever if a
# stale/unrelated Android adb server happens to be running (see
# RELEASE_CHECKLIST.md).
set -e
cd "$(dirname "$0")/.."

ENV_FILE=".maestro/.env.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
else
  echo "Missing $ENV_FILE — copy the TEST_EMAIL/TEST_PASSWORD template and fill in a real test account." >&2
  exit 1
fi

if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "TEST_EMAIL/TEST_PASSWORD are not set in $ENV_FILE." >&2
  exit 1
fi

UDID=$(xcrun simctl list devices 2>/dev/null | grep -i booted | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
if [ -z "$UDID" ]; then
  echo "No booted iOS simulator found — open Simulator.app (or 'xcrun simctl boot <name>') first." >&2
  exit 1
fi

MAESTRO_CLI_NO_ANALYTICS=1 exec maestro test \
  --device "$UDID" \
  --env TEST_EMAIL="$TEST_EMAIL" \
  --env TEST_PASSWORD="$TEST_PASSWORD" \
  .maestro
