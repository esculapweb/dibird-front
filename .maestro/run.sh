#!/bin/bash
# Wraps `maestro test` so `npm run e2e` needs no extra manual steps:
# loads real test credentials from .maestro/.env.local (gitignored, not
# committed) and auto-picks a running device, working around a Maestro quirk
# where device auto-detection can hang forever — silently, before any output —
# if something unrelated is listening on an emulator ADB port (see the
# port-squatter note below, and RELEASE_CHECKLIST.md).
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

# A previous run that was interrupted while Maestro was blocked in a native
# socket read (see the ADB-port note below) can survive the Ctrl-C / closed
# terminal that was meant to kill it. The leftover JVM still holds the iOS
# driver port, so the *next* `npm run e2e` also produces no output — the hang
# outlives the run that caused it. Reap them before starting: nothing else in
# this repo runs `maestro.cli.AppKt`, and two concurrent batches against the
# same device would fight each other anyway.
STALE_PIDS=$(pgrep -f "maestro\.cli\.AppKt" 2>/dev/null || true)
if [ -n "$STALE_PIDS" ]; then
  echo "Killing leftover Maestro process(es) from an earlier run: $(echo "$STALE_PIDS" | tr '\n' ' ')" >&2
  # shellcheck disable=SC2086
  kill $STALE_PIDS 2>/dev/null || true
  sleep 2
  STILL=$(pgrep -f "maestro\.cli\.AppKt" 2>/dev/null || true)
  # shellcheck disable=SC2086
  [ -n "$STILL" ] && kill -9 $STILL 2>/dev/null || true
fi

# Maestro finds devices by probing the Android emulator ADB ports on localhost
# itself — it opens a socket on every port in 5555..5683 and waits for an ADB
# handshake with *no read timeout*, instead of asking the adb server. Any
# unrelated process listening on one of those ports accepts the connection and
# never answers, so `maestro test` blocks forever having printed nothing: the
# "npm run e2e does nothing at all" hang, with no error to go on. This is not
# an Android-only concern — the scan runs before `--device` is even looked at
# (TestCommand.getDeviceCount → DeviceService.listAndroidDevices), so it takes
# down iOS runs just as dead. Our own backend stack used to be the culprit:
# Flower's default port is 5555, exactly the first emulator's adb port — hence
# `15555:5555` in dibird_local/docker-compose.yml. Fail fast and name whatever
# else lands there next, rather than hanging again.
if command -v lsof >/dev/null 2>&1; then
  SQUATTERS=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '
    { n = split($9, a, ":"); port = a[n] + 0 }
    port >= 5555 && port <= 5683 && $1 !~ /^(adb|emulator|qemu)/ {
      print "  port " port " — " $1 " (pid " $2 ")"
    }' | sort -u)
  if [ -n "$SQUATTERS" ]; then
    echo "Emulator ADB port(s) 5555-5683 held by unrelated process(es):" >&2
    echo "$SQUATTERS" >&2
    echo "Maestro's device scan hangs forever on these. Free the port(s) and re-run." >&2
    exit 1
  fi
else
  # Skipping silently would hand back exactly the symptom this check exists to
  # explain: a run that prints nothing and never finishes. Say it out loud, but
  # don't block — lsof missing is not itself a reason not to try.
  echo "Note: lsof not found, skipping the ADB port 5555-5683 check." >&2
  echo "      If this run hangs with no output, a process on one of those ports is why." >&2
fi

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
