#!/bin/bash
# A deterministic reset before an e2e run: clears the test account's data on
# the local backend and the app's local state on the emulator.
#
# Why: the flows check counters ("1 observation in the diary", "one more
# place"), and every failure leaves half-created or extra records behind. The
# next run then starts from a spoiled account, the count assertions in
# neighbouring flows break — and the report fills up with failures that have
# nothing to do with the real cause. The reset removes that source of false
# signals.
#
# NOT called from run.sh by default (`pm clear` costs one extra login in
# bootstrap): run it by hand, or via `npm run e2e:android -- --reset` (see
# RESET in run.sh).
#
# `pm clear` is safe for bootstrap: the SecureStore session is gone, but
# common/android-bootstrap.yaml can sign in by email/password, and onboarding
# does not pop up after the wipe — isOnboardingPending() (util/storageHelper.ts)
# returns false when the onboarding_pending key is missing, and only sign-up
# ever sets it.
set -e
cd "$(dirname "$0")/.."

APP_ID="${APP_ID:-com.dibird.app}"
BACKEND_DIR="${BACKEND_DIR:-/Users/esculapweb/Py/dibird/docker/dibird_local}"

# The account: run.sh has already picked it per platform and exported it into
# TEST_EMAIL — that choice is respected here. On a manual run there is none, and
# the Android account is used: what this clears includes `pm clear`, so the
# script is about Android anyway. The wrong account is more dangerous here than
# no account at all — this is a `delete()` over someone's observations — hence a
# deliberate fallback rather than "whichever comes first".
ENV_FILE=".maestro/.env.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi
TEST_EMAIL="${TEST_EMAIL:-$ANDROID_EMAIL}"
if [ -z "$TEST_EMAIL" ]; then
  echo "No account resolved — set ANDROID_EMAIL in $ENV_FILE (the same file run.sh reads)." >&2
  exit 1
fi

# --- 1. The test account's data on the backend ------------------------------
# Observation goes first: it references Diary/Place, and although the cascade
# would handle it by itself, the explicit order makes the printed counts honest.
if [ -d "$BACKEND_DIR" ]; then
  echo "Resetting $TEST_EMAIL's data on the local backend…"
  (cd "$BACKEND_DIR" && docker compose exec -T \
    -e TEST_EMAIL="$TEST_EMAIL" web python manage.py shell) <<'PY'
import os

from myapi.models import Diary, Observation, Place

email = os.environ["TEST_EMAIL"]
by_user = {"profile__user__email__iexact": email}

for model in (Observation, Diary, Place):
    deleted, _ = model.objects.filter(**by_user).delete()
    print(f"{model.__name__}: deleted {deleted}")

for model in (Observation, Diary, Place):
    print(f"{model.__name__}: left {model.objects.filter(**by_user).count()}")
PY
else
  echo "Backend directory $BACKEND_DIR not found — skipping the data cleanup." >&2
fi

# --- 2. The app's local state -----------------------------------------------
# adb may not be on PATH — the same candidates as in run.sh.
if ! command -v adb >/dev/null 2>&1; then
  for candidate in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -n "$candidate" ] && [ -x "$candidate/platform-tools/adb" ]; then
      export PATH="$PATH:$candidate/platform-tools"
      break
    fi
  done
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found — the app's local state was not cleared." >&2
  exit 1
fi

TARGET=$(adb devices 2>/dev/null | grep -E "^(emulator-[0-9]+|[A-Za-z0-9]+)\s+device$" | head -1 | cut -f1)
if [ -z "$TARGET" ]; then
  echo "No running Android emulator/device — the app's local state was not cleared." >&2
  exit 1
fi

echo "Clearing $APP_ID data on $TARGET (SQLite mirror, AsyncStorage, SecureStore)…"
adb -s "$TARGET" shell pm clear "$APP_ID"

echo "Done: the account and the app are back to their initial state."
