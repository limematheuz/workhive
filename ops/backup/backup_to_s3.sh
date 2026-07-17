#!/usr/bin/env bash
set -euo pipefail

umask 077

: "${BACKUP_BUCKET:?Set BACKUP_BUCKET in the systemd environment file}"

workhive_dir="${WORKHIVE_DIR:-/home/ubuntu/workhive}"
compose_file="${COMPOSE_FILE:-${workhive_dir}/docker-compose.yml}"
compose_env_file="${COMPOSE_ENV_FILE:-${workhive_dir}/.env}"
backup_root="${LOCAL_BACKUP_ROOT:-/home/ubuntu/workhive-backups}"
s3_prefix="${S3_PREFIX:-production}"
aws_region="${AWS_REGION:-eu-west-1}"
retention_days="${LOCAL_RETENTION_DAYS:-8}"
lock_file="${BACKUP_LOCK_FILE:-/tmp/workhive-backup.lock}"

aws_bin="${AWS_BIN:-/snap/bin/aws}"
docker_bin="${DOCKER_BIN:-docker}"
tar_bin="${TAR_BIN:-tar}"
sha256_bin="${SHA256_BIN:-sha256sum}"
flock_bin="${FLOCK_BIN:-flock}"

if [[ "${backup_root}" == "/" || -z "${backup_root}" ]]; then
    echo "LOCAL_BACKUP_ROOT cannot be empty or /" >&2
    exit 1
fi

if [[ ! "${retention_days}" =~ ^[0-9]+$ ]]; then
    echo "LOCAL_RETENTION_DAYS must be a non-negative integer" >&2
    exit 1
fi

if [[ "${s3_prefix}" == /* || "${s3_prefix}" == *".."* ]]; then
    echo "S3_PREFIX must be a relative, traversal-free prefix" >&2
    exit 1
fi
s3_prefix="${s3_prefix%/}"

for required_file in "${compose_file}" "${compose_env_file}"; do
    if [[ ! -f "${required_file}" ]]; then
        echo "Required file not found: ${required_file}" >&2
        exit 1
    fi
done

for required_command in \
    "${aws_bin}" \
    "${docker_bin}" \
    "${tar_bin}" \
    "${sha256_bin}" \
    "${flock_bin}"; do
    if ! command -v "${required_command}" >/dev/null 2>&1; then
        echo "Required command not found: ${required_command}" >&2
        exit 1
    fi
done

mkdir -p "${backup_root}"
exec 9>"${lock_file}"
if ! "${flock_bin}" -n 9; then
    echo "Another WorkHive backup is already running; exiting safely"
    exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${backup_root}/${timestamp}"
archive="${backup_root}/workhive-${timestamp}.tar.gz"
archive_checksum="${archive}.sha256"
s3_destination="s3://${BACKUP_BUCKET}/${s3_prefix}/${timestamp}"
compose=(
    "${docker_bin}"
    compose
    -f "${compose_file}"
    --env-file "${compose_env_file}"
)

mkdir -p "${destination}"

echo "Creating PostgreSQL backup"
"${compose[@]}" exec -T db sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
    > "${destination}/database.dump"
test -s "${destination}/database.dump"

echo "Archiving persistent application files"
"${compose[@]}" exec -T backend \
    tar -C /data -czf - . \
    > "${destination}/appdata.tar.gz"
test -s "${destination}/appdata.tar.gz"

(
    cd "${destination}"
    "${sha256_bin}" database.dump appdata.tar.gz > SHA256SUMS
    "${sha256_bin}" -c SHA256SUMS >/dev/null
)

echo "Validating backup formats"
"${compose[@]}" exec -T db pg_restore --list \
    < "${destination}/database.dump" \
    >/dev/null
"${tar_bin}" -tzf "${destination}/appdata.tar.gz" >/dev/null

"${tar_bin}" -C "${destination}" -czf "${archive}" \
    database.dump \
    appdata.tar.gz \
    SHA256SUMS
test -s "${archive}"
(
    cd "${backup_root}"
    "${sha256_bin}" "$(basename "${archive}")" \
        > "$(basename "${archive_checksum}")"
)

echo "Uploading encrypted backup to S3"
"${aws_bin}" s3 cp \
    "${archive}" \
    "${s3_destination}/workhive-backup.tar.gz" \
    --region "${aws_region}" \
    --sse AES256 \
    --only-show-errors
"${aws_bin}" s3 cp \
    "${archive_checksum}" \
    "${s3_destination}/workhive-backup.tar.gz.sha256" \
    --region "${aws_region}" \
    --sse AES256 \
    --only-show-errors

uploaded_count="$(
    "${aws_bin}" s3api list-objects-v2 \
        --bucket "${BACKUP_BUCKET}" \
        --prefix "${s3_prefix}/${timestamp}/" \
        --max-keys 10 \
        --query 'length(Contents)' \
        --output text \
        --region "${aws_region}"
)"
if [[ "${uploaded_count}" != "2" ]]; then
    echo "S3 upload verification expected 2 objects, found ${uploaded_count}" >&2
    exit 1
fi

rm -rf -- "${destination}"
find "${backup_root}" \
    -maxdepth 1 \
    -type f \
    \( -name 'workhive-*.tar.gz' -o -name 'workhive-*.tar.gz.sha256' \) \
    -mtime "+${retention_days}" \
    -delete

echo "Backup completed and verified: ${s3_prefix}/${timestamp}/"
