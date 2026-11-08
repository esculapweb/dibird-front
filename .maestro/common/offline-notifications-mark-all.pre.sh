#!/bin/bash
# Pre-flow seed for offline-notifications-mark-all.yaml (see run_maestro in
# run.sh for how it gets called): leaves the test account with exactly two
# unread notifications on the local backend.
#
# A shell hook rather than a runScript step, because the API cannot do this:
# notifications are only created server-side, /notifications/app-update/ is
# deduplicated per profile and release, and /notifications/test-push/ is gated
# by profile id. Same `docker compose exec` route as reset-state.sh.
#
# Anything already unread is marked read instead of deleted, so the expected
# count stays exact without destroying a notification the flow did not create.
# Earlier seeds are deleted by title: a failed run must not pile up rows.
set -e
cd "$(dirname "$0")/../.."

BACKEND_DIR="${BACKEND_DIR:-/Users/esculapweb/Py/dibird/docker/dibird_local}"

if [ -z "$TEST_EMAIL" ]; then
  echo "TEST_EMAIL is not set — this hook is meant to be called from run.sh." >&2
  exit 1
fi

(cd "$BACKEND_DIR" && docker compose exec -T \
  -e TEST_EMAIL="$TEST_EMAIL" web python manage.py shell) <<'PY'
import os

from myapi.models import Notification, Profile

profile = Profile.objects.get(user__email__iexact=os.environ["TEST_EMAIL"])
mine = Notification.objects.filter(profile=profile)

mine.filter(title__startswith="E2E mark-all").delete()
mine.filter(is_read=False).update(is_read=True)

for n in (1, 2):
    Notification.objects.create(
        profile=profile,
        type=Notification.Type.SYSTEM,
        title=f"E2E mark-all {n}",
        body="Seeded by offline-notifications-mark-all.pre.sh",
    )

print("Unread after seeding:", mine.filter(is_read=False).count())
PY
