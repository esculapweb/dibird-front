#!/bin/bash
# Pre-flow setup for offline-avatar.yaml: the same non-empty gallery the
# observation photo flow needs, see the script this delegates to.
exec bash "$(dirname "$0")/offline-observation-photo.pre.sh"
