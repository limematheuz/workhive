#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_under_test="${repository_root}/ops/maintenance/docker_maintenance.sh"
temporary_root="$(mktemp -d)"
trap 'rm -rf "${temporary_root}"' EXIT

fake_bin="${temporary_root}/bin"
command_log="${temporary_root}/docker.log"
mkdir -p "${fake_bin}"

cat > "${fake_bin}/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${FAKE_DOCKER_LOG}"
EOF
cat > "${fake_bin}/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${fake_bin}/docker" "${fake_bin}/flock" "${script_under_test}"

bash -n "${script_under_test}"

FAKE_DOCKER_LOG="${command_log}" \
REQUIRE_ROOT=false \
DOCKER_BIN="${fake_bin}/docker" \
FLOCK_BIN="${fake_bin}/flock" \
MAINTENANCE_LOCK_FILE="${temporary_root}/maintenance.lock" \
"${script_under_test}" >/dev/null

grep -Fxq 'builder prune --all --force' "${command_log}"
grep -Fxq 'image prune --all --force' "${command_log}"
grep -Fxq 'container prune --force' "${command_log}"
grep -Fxq 'system df' "${command_log}"
if grep -q 'volume' "${command_log}"; then
    echo 'Maintenance must never prune Docker volumes.' >&2
    exit 1
fi

echo 'Docker maintenance contract passed'
