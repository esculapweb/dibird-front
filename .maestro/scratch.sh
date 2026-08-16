#!/bin/bash
# Runs a throwaway flow from .maestro/scratch/ — the fast loop for building a
# real flow, or for probing one hypothesis about the app.
#
# Why a separate directory: `.maestro/` is the suite. Anything dropped there is
# picked up by a bare `npm run e2e:android` (which globs `.maestro/*.yaml`) and
# by `npm run e2e:lint`, so a half-written probe becomes a red flow in somebody
# else's batch. `.maestro/scratch/` is in .gitignore and is not globbed by the
# batch — the run.sh single-flow path takes an explicit file, and that is what
# this passes it.
#
# The point of the loop is that a scratch flow does not have to start from
# scratch. Omit `launchApp` and it runs against whatever is on screen right now:
# checking one step then costs seconds instead of the ~90s a cold start and
# bootstrap take. Pair it with `.maestro/ui.sh`, which prints the ids actually
# on that screen.
#
# Usage:
#   .maestro/scratch.sh probe          # runs .maestro/scratch/probe.yaml
#   .maestro/scratch.sh probe.yaml     # same
#   .maestro/scratch.sh path/to/x.yaml # any explicit path still works
#   npm run e2e:scratch -- probe
#
# The flow still needs `appId:` and an `android` tag in its header — run.sh
# filters by tag, and an untagged flow silently matches nothing.
set -e
cd "$(dirname "$0")/.."

NAME="$1"
if [ -z "$NAME" ]; then
  echo "Usage: $(basename "$0") <name|path>   (flows live in .maestro/scratch/)" >&2
  if [ -d .maestro/scratch ]; then
    echo "Available:" >&2
    ls .maestro/scratch/*.yaml 2>/dev/null | sed 's|.*/|  |; s|\.yaml$||' >&2
  fi
  exit 1
fi
shift

if [ -f "$NAME" ]; then
  FLOW="$NAME"
else
  FLOW=".maestro/scratch/${NAME%.yaml}.yaml"
fi

if [ ! -f "$FLOW" ]; then
  echo "No such flow: $FLOW" >&2
  exit 1
fi

exec bash .maestro/run.sh android "$FLOW" "$@"
