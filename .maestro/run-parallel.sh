#!/bin/bash
# Runs the iOS and Android batches at the same time: two `run.sh` in the
# background, one log per platform, a combined verdict at the end. A full run
# is ~15 flows on each side, and sequentially it takes twice as long as it has
# to: the simulator and the emulator wait for nothing but us.
#
# What makes a parallel run possible (and why this is not "just two
# terminals"):
#  - Separate accounts. run.sh takes IOS_EMAIL/ANDROID_EMAIL from .env.local,
#    so the two runs never meet on the backend. With a shared account the
#    neighbouring run would be changing the same counters between
#    `copyTextFrom` and the assertion — failures would be irreproducible.
#  - One reap for both. On startup run.sh kills leftover `maestro.cli.AppKt`
#    processes from earlier runs (see the comment there), but it cannot tell
#    them from a live sibling — whichever started second would kill the first.
#    So the reap is done here, once, before either starts, and run.sh itself
#    has it turned off via E2E_NO_REAP.
#  - One Metro. Both platforms talk to localhost:8081 (iOS shares the host's
#    network stack, Android goes through `adb reverse` from run.sh), and a
#    single dev server serves the bundle to two clients without trouble.
#
# Arguments are passed through to both platforms as is: `npm run e2e:parallel
# -- .maestro/onboarding.yaml` runs that one flow on both.
set -e
cd "$(dirname "$0")/.."

LOG_DIR=".maestro/.logs"
mkdir -p "$LOG_DIR"
IOS_LOG="$LOG_DIR/ios.log"
ANDROID_LOG="$LOG_DIR/android.log"

# The very reap that E2E_NO_REAP was added to run.sh for — here it is still
# safe: none of our own processes have been started yet.
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

# Maestro's own debug logs (not ours from $LOG_DIR) all go into a shared
# ~/Library/Logs/maestro, and on startup Maestro prunes the old directories
# there, keeping the last few. When the two halves start at the same moment,
# the second one manages to delete the directory the first has just created —
# and the first then dies on its own final step, having already printed the
# results of every flow:
#
#   Exception in thread "main" java.nio.file.NoSuchFileException:
#     ~/Library/Logs/maestro/<timestamp>_<pid>
#     at maestro.debuglog.DebugLogStore.finalizeRun
#
# Worse than mere noise in the output: after that exception the JVM never
# exits (a live non-daemon driver thread), the run hangs forever, and the
# `wait` below never returns. So the directory is cleared here, up front —
# then neither half has anything to delete on startup. Nothing is lost by it:
# these are debug logs of earlier runs, Maestro rotates them itself anyway, and
# a specific run's artifacts (screenshots, hierarchies) live separately, in
# ~/.maestro/tests/.
rm -rf "$HOME/Library/Logs/maestro"

IOS_PID=""
ANDROID_PID=""
# Without this, Ctrl-C only kills the script itself: both halves stay in the
# background, keep holding the devices, and the next run meets exactly the
# stuck JVM described above.
cleanup() {
  trap - INT TERM
  [ -n "$IOS_PID" ] && kill "$IOS_PID" 2>/dev/null || true
  [ -n "$ANDROID_PID" ] && kill "$ANDROID_PID" 2>/dev/null || true
  pkill -f "maestro\.cli\.AppKt" 2>/dev/null || true
  exit 130
}
trap cleanup INT TERM

echo "iOS     -> $IOS_LOG"
echo "Android -> $ANDROID_LOG"
echo "Live output: tail -f $IOS_LOG $ANDROID_LOG"
echo ""

# The output is not mixed into the terminal but split across the logs: Maestro
# draws its progress with ANSI escapes on top of what it already printed, and
# two such streams into one tty give unreadable mush instead of a report. The
# logs are printed in full at the end.
E2E_NO_REAP=1 bash .maestro/run.sh ios "$@" >"$IOS_LOG" 2>&1 &
IOS_PID=$!
E2E_NO_REAP=1 bash .maestro/run.sh android "$@" >"$ANDROID_LOG" 2>&1 &
ANDROID_PID=$!

# `wait` returns the exit code of the half that failed, and `set -e` would quit
# right there — without waiting for the other one and without printing a single
# log.
IOS_STATUS=0
wait "$IOS_PID" || IOS_STATUS=$?
ANDROID_STATUS=0
wait "$ANDROID_PID" || ANDROID_STATUS=$?
trap - INT TERM

echo ""
echo "================ iOS ($IOS_LOG) ================"
cat "$IOS_LOG"
echo ""
echo "================ Android ($ANDROID_LOG) ================"
cat "$ANDROID_LOG"

echo ""
echo "================ Summary ================"
[ "$IOS_STATUS" -eq 0 ] && echo "iOS:     OK" || echo "iOS:     FAILED (exit $IOS_STATUS)"
[ "$ANDROID_STATUS" -eq 0 ] && echo "Android: OK" || echo "Android: FAILED (exit $ANDROID_STATUS)"

[ "$IOS_STATUS" -eq 0 ] && [ "$ANDROID_STATUS" -eq 0 ]
