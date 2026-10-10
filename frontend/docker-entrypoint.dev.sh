#!/bin/sh
set -eu

# A named dependency volume can outlive a lockfile update. Refresh it before
# running Next so Docker Compose remains a single reproducible entry point.
CI=true pnpm install --frozen-lockfile --prefer-offline

exec "$@"
