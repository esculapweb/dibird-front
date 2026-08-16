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
# platform, and it contains flows for both (iOS: appId com.dibird.app.dev;
# Android: appId com.dibird.app; the offline-*.yaml flows are Android-only,
# most of the rest carries both tags). Rather than relying on the caller to
# always remember an explicit flow path to avoid running the wrong platform's
# flows against the wrong app, every flow file declares its own `tags: [ios]`/
# `tags: [android]` (or both) in its config header — `--include-tags` below
# filters the directory scan down to just this run's platform, so `npm run
# e2e:ios` and `npm run e2e:android` are both safe to run bare. An explicit
# flow path can be passed as the next argument on either platform to narrow
# further to one specific flow.
#
# A bare Android run drives the flows one `maestro test` invocation at a time
# (see the loop at the bottom) rather than handing Maestro the directory:
# that's the only place airplane mode can be reset *between* flows, without
# which one failure cascades into the next. iOS and explicit single-flow runs
# still go through one plain invocation.
#
# The two platforms sign in as two different accounts (IOS_EMAIL /
# ANDROID_EMAIL in .env.local) so that both batches can run at the same time —
# `npm run e2e:parallel` / .maestro/run-parallel.sh drives exactly that, and it
# only works because no two runs share test data on the backend. See the
# credentials block below.
set -e
cd "$(dirname "$0")/.."

# The platform, but only if it really was named as the first argument. This
# used to take `${1:-ios}` as a whole, and then `npm run e2e --
# .maestro/login.yaml` travelled into `--include-tags` as the platform,
# selecting zero flows.
PLATFORM="ios"
case "$1" in
  ios | android)
    PLATFORM="$1"
    shift
    ;;
esac

# A previous run that was interrupted while Maestro was blocked in a native
# socket read (see the ADB-port note below) can survive the Ctrl-C / closed
# terminal that was meant to kill it. The leftover JVM still holds the iOS
# driver port, so the *next* `npm run e2e` also produces no output — the hang
# outlives the run that caused it. Reap them before starting: nothing else in
# this repo runs `maestro.cli.AppKt`, and two concurrent batches against the
# same device would fight each other anyway.
#
# E2E_NO_REAP is how run-parallel.sh opts out: the two platforms it starts are
# `maestro.cli.AppKt` processes too, and this pgrep cannot tell them from a
# leftover — whichever of the pair started second would kill the first. That
# script does the reap once itself, before starting either.
STALE_PIDS=""
if [ -z "$E2E_NO_REAP" ]; then
  STALE_PIDS=$(pgrep -f "maestro\.cli\.AppKt" 2>/dev/null || true)
fi
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
  echo "Missing $ENV_FILE — fill in IOS_EMAIL/IOS_PASSWORD and ANDROID_EMAIL/ANDROID_PASSWORD with real test accounts." >&2
  exit 1
fi

# One account per platform, not a shared one: iOS and Android run at the same
# time (run-parallel.sh), and the flows check counters ("one more place", "1
# observation in the diary") — with a shared account the neighbouring run would
# be changing those very numbers between `copyTextFrom` and the assertion, and
# failures would be irreproducible. What the two runs diverge on backend-side is
# only the records' owner, so two accounts are enough; nothing else needs
# isolating.
#
# From here on (and in --env) the old names TEST_EMAIL/TEST_PASSWORD are kept:
# the flows don't know which platform they are on, and they shouldn't.
if [ "$PLATFORM" = "android" ]; then
  CRED_PREFIX="ANDROID"
  TEST_EMAIL="$ANDROID_EMAIL"
  TEST_PASSWORD="$ANDROID_PASSWORD"
else
  CRED_PREFIX="IOS"
  TEST_EMAIL="$IOS_EMAIL"
  TEST_PASSWORD="$IOS_PASSWORD"
fi
if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "${CRED_PREFIX}_EMAIL/${CRED_PREFIX}_PASSWORD are not set in $ENV_FILE." >&2
  exit 1
fi
# Exported for reset-state.sh: it reads the same .env.local, but the per-platform
# account choice is made here, and without this the reset would hit the wrong
# account.
export TEST_EMAIL TEST_PASSWORD

if [ "$PLATFORM" = "android" ]; then
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

  # Serve the JS bundle over the adb tunnel instead of the host's LAN IP.
  # In a dev-client build the bundle (and the Fast Refresh / HMR socket)
  # lives on Metro, so `toggleAirplaneMode` cuts the app off from its own
  # code, not just from the API: when the dropped HMR socket makes RN
  # re-fetch the bundle, the reload dies on ENETUNREACH and the dev-client
  # replaces the whole app with its "There was a problem loading the
  # project" screen mid-flow — the offline flows' `when: visible: "Reload"`
  # guards exist only to paper over that, and they lose the race whenever
  # the error screen appears a beat later than the guard is evaluated.
  # `adb reverse` makes the emulator's own loopback the Metro address, and
  # loopback (unlike wifi/cellular) stays up in airplane mode, so reloads
  # keep working while offline. Verified with `toybox nc` inside the
  # emulator with airplane mode ON: 127.0.0.1:8081 answers 200, while
  # 192.168.0.103:8081 and the API on :8000 both give "Network is
  # unreachable" — i.e. only Metro moves off the radio, the offline test
  # semantics (EXPO_PUBLIC_BASE_URL is a LAN address) are untouched.
  # Paired with the localhost URL in common/android-bootstrap.yaml.
  adb -s "$TARGET" reverse tcp:8081 tcp:8081 >/dev/null

  # Disable animations: every screen transition, and the explicit
  # waitForAnimationToEnd waits gating them throughout the flows, otherwise
  # ride out the real (short but nonzero) transition time on every single
  # navigation. Pure test-speed win — nothing in these flows asserts on
  # animation timing itself.
  adb -s "$TARGET" shell settings put global window_animation_scale 0
  adb -s "$TARGET" shell settings put global transition_animation_scale 0
  adb -s "$TARGET" shell settings put global animator_duration_scale 0

  # A deterministic start: clean test-account data on the backend plus a
  # `pm clear` of the app. Not the default — the reset costs an extra login in
  # bootstrap, and when debugging a single flow the accumulated account is
  # often exactly what's wanted. Enabled with `RESET=1 npm run e2e:android` or
  # the `--reset` flag (see RELEASE_CHECKLIST.md). Worth it before a full
  # batch, where the neighbouring flows' count assertions otherwise break on
  # leftovers from an earlier failure.
  if [ "$1" = "--reset" ]; then
    RESET=1
    shift
  fi
  if [ -n "$RESET" ] && [ "$RESET" != "0" ]; then
    bash .maestro/reset-state.sh
  fi

  TARGET_PATH="${1:-.maestro}"
else
  TARGET=$(xcrun simctl list devices 2>/dev/null | grep -i booted | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
  if [ -z "$TARGET" ]; then
    echo "No booted iOS simulator found — open Simulator.app (or 'xcrun simctl boot <name>') first." >&2
    exit 1
  fi
  # Same as on Android: a path to a single flow can be passed as an argument
  # (`npm run e2e:ios -- .maestro/guest-browse.yaml`). The iOS branch used to
  # ignore it, and debugging one flow meant calling `maestro test` by hand,
  # bypassing the device pick and the credentials.
  TARGET_PATH="${1:-.maestro}"
fi

# The package differs per platform (iOS runs on the dev-client build), and
# flows tagged for both declare `appId: ${APP_ID}` — Maestro substitutes the
# --env value here before the app is even launched. Flows that live on one
# platform only still spell their appId out literally: substitution buys
# nothing there and reads worse.
if [ "$PLATFORM" = "android" ]; then
  APP_ID="com.dibird.app"
else
  APP_ID="com.dibird.app.dev"
fi

# On Android, keep the app's own log for a flow that fails. Maestro's report
# says which step went red; it cannot say why, and the answer is usually already
# printed by the app — the login that looked like a hang was an
# `[AUTH API ERROR] {"code": "TIMEOUT"}` in logcat, and finding that by hand cost
# an afternoon. Cleared before each flow so the dump belongs to that flow alone,
# and written only on failure so a green batch leaves nothing behind.
run_maestro() {
  local flow="$1"
  local status=0

  if [ "$PLATFORM" = "android" ]; then
    adb -s "$TARGET" logcat -c >/dev/null 2>&1 || true
  fi

  MAESTRO_CLI_NO_ANALYTICS=1 maestro test \
    --device "$TARGET" \
    --include-tags "$PLATFORM" \
    --env APP_ID="$APP_ID" \
    --env TEST_EMAIL="$TEST_EMAIL" \
    --env TEST_PASSWORD="$TEST_PASSWORD" \
    "$flow" || status=$?

  if [ "$status" -ne 0 ] && [ "$PLATFORM" = "android" ]; then
    mkdir -p .maestro/.logs
    local log=".maestro/.logs/$(basename "$flow" .yaml).logcat"
    # ReactNativeJS carries the app's own console output; AndroidRuntime and
    # ExpoModules catch the crashes that never reach it.
    adb -s "$TARGET" logcat -d 2>/dev/null \
      | grep -E "ReactNativeJS|AndroidRuntime|ExpoModules" > "$log" || true
    echo "App log: $log ($(wc -l < "$log" | tr -d ' ') lines)" >&2
  fi

  return $status
}

# One `maestro test` per flow instead of one for the whole directory, so a
# failure can't cascade into the next flow. `toggleAirplaneMode` can only flip
# the current state, never set it: a flow that dies mid-offline-cycle leaves
# airplane mode ON, and then the *next* offline flow spends its own "go
# offline" toggle turning it back off — it runs online, its pending-sync
# assertions fail, and the report blames a flow that was never broken (seen
# twice in a row: offline-nested-observation-in-diary failing took
# offline-create-observation down with it). Forcing airplane mode off between
# flows contains the damage to the flow that actually broke.
#
# Only for a whole-directory Android run: a single explicit flow path has
# nothing to cascade into, and iOS has no airplane-mode toggle to begin with.
if [ "$PLATFORM" != "android" ] || [ "$TARGET_PATH" != ".maestro" ]; then
  exec_status=0
  run_maestro "$TARGET_PATH" || exec_status=$?
  exit $exec_status
fi

# Same tag filter as --include-tags, applied up front so the loop doesn't
# start an app-launching run per iOS flow just to have Maestro skip it.
FLOWS=$(grep -lE "^[[:space:]]*-[[:space:]]*$PLATFORM[[:space:]]*$" .maestro/*.yaml | sort)
if [ -z "$FLOWS" ]; then
  echo "No .maestro/*.yaml flows tagged '$PLATFORM' — nothing to run." >&2
  exit 1
fi

FAILED=""
for flow in $FLOWS; do
  echo ""
  echo "=== $(basename "$flow") ==="
  adb -s "$TARGET" shell cmd connectivity airplane-mode disable || true
  run_maestro "$flow" || FAILED="$FAILED $(basename "$flow")"
done

# The last flow's own crash can leave the device offline for whatever runs
# next (a manual re-run, another script) — same reasoning as the pre-flow
# reset above, and harmless when it's already off.
adb -s "$TARGET" shell cmd connectivity airplane-mode disable || true

echo ""
if [ -n "$FAILED" ]; then
  echo "FAILED flows:$FAILED" >&2
  exit 1
fi
echo "All flows passed."
