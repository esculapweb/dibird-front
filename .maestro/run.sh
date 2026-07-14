#!/bin/bash
# Wraps `maestro test` so `npm run e2e` needs no extra manual steps:
# loads real test credentials from .maestro/.env.local (gitignored, not
# committed) and auto-picks a running device, working around a Maestro quirk
# where device auto-detection can hang forever if a stale/unrelated Android
# adb server happens to be running (see RELEASE_CHECKLIST.md).
#
# Defaults to iOS (the only platform with real flows historically). Pass
# `android` as the first argument to target a booted Android emulator/device
# instead — this is how the offline-*.yaml flows are run, since Maestro's
# `toggleAirplaneMode` command (a real OS-level airplane-mode toggle,
# needed to exercise offline sync for real) only works on Android; iOS
# Simulators have no radio stack for it to switch. Maestro itself scans this
# whole .maestro/ directory regardless of platform, so running against
# Android here would also try to run the iOS-only login.yaml/
# create-observation.yaml (appId: com.dibird.app.dev, an iOS bundle id) —
# pass an explicit flow path as the second argument when targeting Android.
set -e
cd "$(dirname "$0")/.."

PLATFORM="${1:-ios}"

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

if [ "$PLATFORM" = "android" ]; then
  shift
  # `adb` isn't on PATH in a plain shell unless the Android SDK's
  # platform-tools dir was added manually — try the usual install locations
  # (ANDROID_HOME/ANDROID_SDK_ROOT if already set, else Android Studio's
  # default macOS path) before giving up, so `npm run e2e:android` works
  # standalone instead of requiring `export PATH=...` first every time.
  if ! command -v adb >/dev/null 2>&1; then
    for candidate in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
      if [ -n "$candidate" ] && [ -x "$candidate/platform-tools/adb" ]; then
        export PATH="$PATH:$candidate/platform-tools"
        break
      fi
    done
  fi
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found — install Android SDK platform-tools, or set ANDROID_HOME/ANDROID_SDK_ROOT to your SDK location." >&2
    exit 1
  fi
  TARGET=$(adb devices 2>/dev/null | grep -E "^(emulator-[0-9]+|[A-Za-z0-9]+)\s+device$" | head -1 | cut -f1)
  if [ -z "$TARGET" ]; then
    echo "No running Android emulator/device found — boot an AVD (or connect a device) first, and make sure a dev-client build is installed on it (see RELEASE_CHECKLIST.md)." >&2
    exit 1
  fi
  TARGET_PATH="${1:-.maestro}"
else
  TARGET=$(xcrun simctl list devices 2>/dev/null | grep -i booted | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
  if [ -z "$TARGET" ]; then
    echo "No booted iOS simulator found — open Simulator.app (or 'xcrun simctl boot <name>') first." >&2
    exit 1
  fi
  TARGET_PATH=".maestro"
fi

MAESTRO_CLI_NO_ANALYTICS=1 exec maestro test \
  --device "$TARGET" \
  --env TEST_EMAIL="$TEST_EMAIL" \
  --env TEST_PASSWORD="$TEST_PASSWORD" \
  "$TARGET_PATH"
