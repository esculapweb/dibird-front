#!/bin/bash
# Pre-flow setup for offline-observation-photo.yaml (see run_maestro in run.sh):
# makes sure the emulator's gallery has at least one image for the system photo
# picker to show. A wiped AVD has none, and the flow would fail inside the
# picker with nothing pointing at the real cause.
#
# Idempotent: the same file is pushed to the same path every time.
set -e
cd "$(dirname "$0")/../.."

if [ -z "$TARGET" ]; then
  echo "TARGET is not set — this hook is meant to be called from run.sh." >&2
  exit 1
fi

REMOTE=/sdcard/Pictures/e2e/e2e-observation.png

adb -s "$TARGET" shell mkdir -p /sdcard/Pictures/e2e
adb -s "$TARGET" push assets/icon.png "$REMOTE" >/dev/null
adb -s "$TARGET" shell am broadcast \
  -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d "file://$REMOTE" >/dev/null
