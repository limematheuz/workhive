#!/usr/bin/env bash
set -euo pipefail

umask 077

: "${DATABASE_URL:?Set DATABASE_URL before running the backup}"

if ! command -v pg_dump >/dev/null 2>&1; then
    echo "pg_dump is required" >&2
    exit 1
fi

backup_root="${BACKUP_DIR:-./backups}"
pdf_storage="${INVOICE_PDF_STORAGE_PATH:-$HOME/.local/share/workhive/invoices}"
electronic_invoice_storage="${ELECTRONIC_INVOICE_STORAGE_PATH:-$HOME/.local/share/workhive/electronic-invoices}"
media_storage="${MEDIA_STORAGE_PATH:-$HOME/.local/share/workhive/media}"
media_backend="${MEDIA_STORAGE_BACKEND:-local}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${backup_root}/${timestamp}"

if [[ -z "${backup_root}" || "${backup_root}" == "/" ]]; then
    echo "BACKUP_DIR cannot be empty or /" >&2
    exit 1
fi

mkdir -p "${destination}"

pg_dump \
    --dbname="${DATABASE_URL}" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="${destination}/database.dump"

archive_directory() {
    local source_directory="$1"
    local archive_path="$2"
    if [[ -d "${source_directory}" ]]; then
        tar -C "${source_directory}" -czf "${archive_path}" .
    else
        tar -czf "${archive_path}" --files-from /dev/null
    fi
}

archive_directory "${pdf_storage}" "${destination}/invoice-pdfs.tar.gz"
archive_directory \
    "${electronic_invoice_storage}" \
    "${destination}/electronic-invoices.tar.gz"

if [[ "${media_backend}" == "local" ]]; then
    archive_directory "${media_storage}" "${destination}/media.tar.gz"
else
    tar -czf "${destination}/media.tar.gz" --files-from /dev/null
    echo "Persistent media and fiscal documents use S3; configure bucket versioning and replication separately." \
        > "${destination}/S3_OBJECT_STORAGE_BACKUP_REQUIRED.txt"
fi

(
    cd "${destination}"
    shasum -a 256 \
        database.dump \
        invoice-pdfs.tar.gz \
        electronic-invoices.tar.gz \
        media.tar.gz \
        > SHA256SUMS
)

find "${backup_root}" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -mtime "+${retention_days}" \
    -exec rm -rf {} +

echo "Backup created at ${destination}"
