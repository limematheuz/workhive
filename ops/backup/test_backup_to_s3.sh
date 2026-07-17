#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_under_test="${repository_root}/ops/backup/backup_to_s3.sh"
temporary_root="$(mktemp -d)"
trap 'rm -rf "${temporary_root}"' EXIT

workhive_dir="${temporary_root}/workhive"
backup_root="${temporary_root}/backups"
fake_bin="${temporary_root}/bin"
fake_appdata="${temporary_root}/appdata"
aws_log="${temporary_root}/aws.log"
mkdir -p "${workhive_dir}" "${fake_bin}" "${fake_appdata}/media"
touch "${workhive_dir}/docker-compose.yml" "${workhive_dir}/.env"
printf 'test-media\n' > "${fake_appdata}/media/report.txt"

cat > "${fake_bin}/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
arguments=" $* "
if [[ "${arguments}" == *" exec -T db sh -c "* ]]; then
    printf 'fake-postgresql-custom-dump\n'
elif [[ "${arguments}" == *" exec -T backend tar "* ]]; then
    tar -C "${FAKE_APPDATA_DIR}" -czf - .
elif [[ "${arguments}" == *" exec -T db pg_restore --list "* ]]; then
    cat >/dev/null
else
    echo "Unexpected docker invocation: $*" >&2
    exit 1
fi
EOF

cat > "${fake_bin}/aws" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${FAKE_AWS_LOG}"
if [[ "$1 $2" == "s3 cp" ]]; then
    exit 0
fi
if [[ "$1 $2" == "s3api list-objects-v2" ]]; then
    printf '2\n'
    exit 0
fi
echo "Unexpected AWS invocation: $*" >&2
exit 1
EOF

chmod +x "${fake_bin}/docker" "${fake_bin}/aws" "${script_under_test}"

cat > "${fake_bin}/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${fake_bin}/flock"

if BACKUP_BUCKET= \
    WORKHIVE_DIR="${workhive_dir}" \
    COMPOSE_ENV_FILE="${workhive_dir}/.env" \
    LOCAL_BACKUP_ROOT="${backup_root}" \
    AWS_BIN="${fake_bin}/aws" \
    DOCKER_BIN="${fake_bin}/docker" \
    "${script_under_test}" >/dev/null 2>&1; then
    echo "Expected an empty BACKUP_BUCKET to be rejected" >&2
    exit 1
fi

FAKE_APPDATA_DIR="${fake_appdata}" \
FAKE_AWS_LOG="${aws_log}" \
BACKUP_BUCKET="example-private-backup-bucket" \
WORKHIVE_DIR="${workhive_dir}" \
COMPOSE_FILE="${workhive_dir}/docker-compose.yml" \
COMPOSE_ENV_FILE="${workhive_dir}/.env" \
LOCAL_BACKUP_ROOT="${backup_root}" \
BACKUP_LOCK_FILE="${temporary_root}/backup.lock" \
AWS_BIN="${fake_bin}/aws" \
DOCKER_BIN="${fake_bin}/docker" \
FLOCK_BIN="${fake_bin}/flock" \
"${script_under_test}" >/dev/null

archive="$(find "${backup_root}" -maxdepth 1 -name 'workhive-*.tar.gz' -print -quit)"
test -s "${archive}"
test -s "${archive}.sha256"
(
    cd "${backup_root}"
    sha256sum -c "$(basename "${archive}.sha256")" >/dev/null
)
test "$(grep -c '^s3 cp ' "${aws_log}")" -eq 2
grep -q 's3://example-private-backup-bucket/production/' "${aws_log}"
grep -q '^s3api list-objects-v2 ' "${aws_log}"

echo "Backup automation test passed"
