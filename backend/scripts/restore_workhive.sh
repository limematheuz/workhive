#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set the target DATABASE_URL}"

backup_directory="${1:?Usage: restore_workhive.sh BACKUP_DIRECTORY}"
confirmation="${CONFIRM_RESTORE:-}"

if [[ "${confirmation}" != "RESTORE_WORKHIVE" ]]; then
    echo "Set CONFIRM_RESTORE=RESTORE_WORKHIVE to allow a destructive restore" >&2
    exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
    echo "pg_restore is required" >&2
    exit 1
fi

"$(dirname "$0")/verify_backup.sh" "${backup_directory}"

pg_restore \
    --dbname="${DATABASE_URL}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "${backup_directory}/database.dump"

pdf_storage="${INVOICE_PDF_STORAGE_PATH:-$HOME/.local/share/workhive/invoices}"
mkdir -p "${pdf_storage}"
tar -xzf "${backup_directory}/invoice-pdfs.tar.gz" -C "${pdf_storage}"

electronic_invoice_storage="${ELECTRONIC_INVOICE_STORAGE_PATH:-$HOME/.local/share/workhive/electronic-invoices}"
mkdir -p "${electronic_invoice_storage}"
tar -xzf \
    "${backup_directory}/electronic-invoices.tar.gz" \
    -C "${electronic_invoice_storage}"

if [[ "${MEDIA_STORAGE_BACKEND:-local}" == "local" ]]; then
    media_storage="${MEDIA_STORAGE_PATH:-$HOME/.local/share/workhive/media}"
    mkdir -p "${media_storage}"
    tar -xzf "${backup_directory}/media.tar.gz" -C "${media_storage}"
elif [[ -f "${backup_directory}/S3_OBJECT_STORAGE_BACKUP_REQUIRED.txt" ]]; then
    cat "${backup_directory}/S3_OBJECT_STORAGE_BACKUP_REQUIRED.txt"
elif [[ -f "${backup_directory}/S3_MEDIA_BACKUP_REQUIRED.txt" ]]; then
    # Backups created before object-stored fiscal documents used this filename.
    cat "${backup_directory}/S3_MEDIA_BACKUP_REQUIRED.txt"
fi

echo "Restore completed"
