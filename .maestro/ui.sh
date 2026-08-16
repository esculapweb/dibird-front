#!/bin/bash
# Prints what is on the device *right now*, as selectors rather than pixels:
# every element that carries an id, a text or an accessibility label, one per
# line, with its bounds and an OFFSCREEN marker.
#
# Why this exists: a screenshot shows what is drawn, not what a flow can reach.
# Writing a selector from a screenshot means guessing, and a wrong guess costs a
# full run (~90s) to discover. The two failure modes this makes obvious in one
# glance are the ones that actually happen: the id is spelled differently than
# assumed, and the element exists but sits below the fold (`tapOn` does not
# scroll — that needs `scrollUntilVisible`, see
# offline-orphaned-observation-fails.yaml).
#
# `maestro hierarchy` dumps the raw tree as JSON — around 50KB even for a plain
# screen, mostly framework noise. This filters it down to the handful of lines
# worth reading.
#
# Usage:
#   .maestro/ui.sh              # app elements only
#   .maestro/ui.sh --all        # keep system UI (status bar, dialogs) too
#   .maestro/ui.sh --raw        # the untouched JSON, for grepping
set -e
cd "$(dirname "$0")/.."

MODE="app"
case "$1" in
  --all) MODE="all" ;;
  --raw) MODE="raw" ;;
esac

for cmd in jq maestro; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found — required by $(basename "$0")." >&2
    exit 1
  fi
done

# Same adb lookup as run.sh: the SDK is not on PATH in a plain shell.
if ! command -v adb >/dev/null 2>&1; then
  for candidate in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -n "$candidate" ] && [ -x "$candidate/platform-tools/adb" ]; then
      export PATH="$PATH:$candidate/platform-tools"
      break
    fi
  done
fi

TARGET=""
if command -v adb >/dev/null 2>&1; then
  TARGET=$(adb devices 2>/dev/null | grep -E "^(emulator-[0-9]+|[A-Za-z0-9]+)\s+device$" | head -1 | cut -f1)
fi

# The screen height, so "exists but is off-screen" can be told apart from
# "exists and is tappable". 0 disables the check rather than guessing wrong.
SCREEN_H=0
if [ -n "$TARGET" ]; then
  SCREEN_H=$(adb -s "$TARGET" shell wm size 2>/dev/null | grep -oE '[0-9]+x[0-9]+' | tail -1 | cut -dx -f2)
  SCREEN_H="${SCREEN_H:-0}"
fi

HIERARCHY=$(MAESTRO_CLI_NO_ANALYTICS=1 maestro ${TARGET:+--device "$TARGET"} hierarchy 2>/dev/null)
if [ -z "$HIERARCHY" ]; then
  echo "Empty hierarchy — is a device booted and the app in the foreground?" >&2
  exit 1
fi

if [ "$MODE" = "raw" ]; then
  echo "$HIERARCHY"
  exit 0
fi

# Flattened depth-first, so the printed order is the reading order of the
# screen. `id` is the resource-id RN puts a testID into on Android.
echo "$HIERARCHY" | jq -r --arg mode "$MODE" --argjson screenH "${SCREEN_H:-0}" '
  def walk: ., ((.children // [])[] | walk);
  [ walk
    | (.attributes // {}) as $a
    | { id: ($a["resource-id"] // ""),
        text: ($a.text // ""),
        label: ($a.accessibilityText // ""),
        hint: ($a.hintText // ""),
        bounds: ($a.bounds // "") } ]
  | map(select(.id != "" or .text != "" or .label != "" or .hint != ""))
  | map(select($mode == "all" or (.id | test("^(com\\.android\\.|android:|com\\.google\\.android)") | not)))
  | .[]
  | . as $e
  | ($e.bounds | capture("\\[(?<x1>-?\\d+),(?<y1>-?\\d+)\\]\\[(?<x2>-?\\d+),(?<y2>-?\\d+)\\]") // null) as $b
  | (if $b == null or $screenH == 0 then ""
     elif ($b.y1 | tonumber) >= $screenH or ($b.y2 | tonumber) <= 0 then "  OFFSCREEN"
     else "" end) as $off
  | [ (if $e.id   != "" then "id=" + $e.id else empty end),
      (if $e.text != "" then "text=" + ($e.text | gsub("\n"; " ")) else empty end),
      (if $e.label != "" and $e.label != $e.text then "label=" + $e.label else empty end),
      (if $e.hint != "" then "hint=" + $e.hint else empty end) ]
  | join("  ")
  | . + $off
'
