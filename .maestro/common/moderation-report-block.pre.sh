#!/bin/bash
# Pre-flow seed for moderation-report-block.yaml (see run_maestro in run.sh):
# a dedicated author with three fresh public observations on the local backend,
# and no block or report of the test account left against them.
#
# Why seeded instead of using the feed as it is: almost every local community
# row belongs to one service profile, so blocking a "real" author would empty
# the test account's feed for every flow that runs after a failure here. A
# report also cannot be withdrawn through the API; deleting the author's
# observations cascades to the reports on them, which is what keeps the flow
# repeatable.
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
from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.gis.geos import Point
from django.utils import timezone

from myapi.models import Observation, Place, Profile, UserBlock

me = Profile.objects.get(user__email__iexact=os.environ["TEST_EMAIL"])

# RFC 2606 domain, same as cypress_seed: mail can never reach a real person.
user, _ = User.objects.update_or_create(
    username="e2e_feed_author",
    defaults={
        "email": "e2e-feed-author@dibird.test",
        "first_name": "E2E",
        "last_name": "Author",
        "is_active": True,
    },
)
author, _ = Profile.objects.get_or_create(user=user)
author.territory = me.territory
author.private = False
author.registration_ip = "127.0.0.1"
author.save()

UserBlock.objects.filter(blocker=me, blocked=author).delete()
Observation.objects.filter(profile=author).delete()

place, _ = Place.objects.get_or_create(
    profile=author,
    name="E2E feed place",
    defaults={"location": Point(2.35, 48.85), "territory": me.territory},
)

species = (
    Observation.objects.filter(private=False, species__active=True)
    .exclude(profile=author)
    .first()
    .species
)

now = timezone.now()
for offset, letter in enumerate("ABC"):
    Observation.objects.create(
        profile=author,
        species=species,
        place=place,
        territory=me.territory,
        date_time=now - timedelta(minutes=offset),
        private=False,
        notes=f"E2E feed {letter}",
    )

print("Seeded:", Observation.objects.filter(profile=author).count())
PY
