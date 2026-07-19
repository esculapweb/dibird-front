#!/bin/bash
# Wraps `maestro test` so `npm run e2e` needs no extra manual steps:
# loads real test credentials from .maestro/.env.local (gitignored, not
# committed) and auto-picks a running device, working around a Maestro quirk
# where device auto-detection can hang forever if a stale/unrelated Android
# adb server happens to be running (see RELEASE_CHECKLIST.md).
#
# Defaults to iOS. Pass `android` as the first argument to target a booted
# Android emulator/device instead — this is how the offline-*.yaml flows are
# run, since Maestro's `toggleAirplaneMode` command (a real OS-level
# airplane-mode toggle, needed to exercise offline sync for real) only works
# on Android; iOS Simulators have no radio stack for it to switch.
#
# Maestro itself always scans the whole .maestro/ directory regardless of
# platform, and it contains flows for both (iOS: appId com.dibird.app.dev —
# login.yaml/create-observation.yaml; Android: appId com.dibird.app — every
# other flow). Rather than relying on the caller to always remember an
# explicit flow path to avoid running the wrong platform's flows against the
# wrong app, every flow file declares its own `tags: [ios]`/`tags:
# [android]` in its config header — `--include-tags` below filters the
# directory scan down to just this run's platform, so both `npm run e2e` and
# `npm run e2e:android` are safe to run bare. An explicit flow path can still
# be passed as a second argument (Android only, see below) to narrow further
# to one specific flow.
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

  # A prior run that crashed mid-offline-cycle (toggleAirplaneMode flips it
  # on, then a failed assertion aborts the flow before the matching
  # reconnect toggle) leaves the device stuck in airplane mode — every
  # offline-*.yaml flow assumes it starts OFF (toggleAirplaneMode only flips
  # whatever the current state is, it can't be set directly), so an
  # undetected leftover ON state doesn't just fail that one flow again, it
  # cascades into every *other* flow afterward too (login/Metro can't reach
  # the network either) — observed taking down 6/6 flows in one
  # `npm run e2e:android` batch. Force it off unconditionally before every
  # invocation: harmless if it's already off. Only guards the *start* of this
  # invocation — a crash mid-batch, between two flows in the same `maestro
  # test` process, still isn't covered by this alone.
  adb -s "$TARGET" shell cmd connectivity airplane-mode disable

  # Disable animations: every screen transition, and the explicit
  # waitForAnimationToEnd waits gating them throughout the flows, otherwise
  # ride out the real (short but nonzero) transition time on every single
  # navigation. Pure test-speed win — nothing in these flows asserts on
  # animation timing itself.
  adb -s "$TARGET" shell settings put global window_animation_scale 0
  adb -s "$TARGET" shell settings put global transition_animation_scale 0
  adb -s "$TARGET" shell settings put global animator_duration_scale 0

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
  --include-tags "$PLATFORM" \
  --env TEST_EMAIL="$TEST_EMAIL" \
  --env TEST_PASSWORD="$TEST_PASSWORD" \
  "$TARGET_PATH"
