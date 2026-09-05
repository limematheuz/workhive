#!/usr/bin/env bash
set -euo pipefail

# Reclaim only Docker artefacts that are not used by a running container.
# Persistent volumes contain WorkHive data and are deliberately never pruned.

if [[ "${REQUIRE_ROOT:-true}" == "true" && "${EUID}" -ne 0 ]]; then
    echo "Run this maintenance command as root." >&2
    exit 1
fi

docker_bin="${DOCKER_BIN:-docker}"
lock_file="${MAINTENANCE_LOCK_FILE:-/run/lock/workhive-docker-maintenance.lock}"
flock_bin="${FLOCK_BIN:-flock}"

for required_command in "${docker_bin}" "${flock_bin}"; do
    if ! command -v "${required_command}" >/dev/null 2>&1; then
        echo "Required command not found: ${required_command}" >&2
        exit 1
    fi
done

mkdir -p "$(dirname "${lock_file}")"
exec 9>"${lock_file}"
if ! "${flock_bin}" -n 9; then
    echo "WorkHive Docker maintenance is already running; exiting safely." >&2
    exit 1
fi

"${docker_bin}" builder prune --all --force
"${docker_bin}" image prune --all --force
"${docker_bin}" container prune --force
"${docker_bin}" system df
