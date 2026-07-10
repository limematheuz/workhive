#!/usr/bin/env bash
set -euo pipefail

backup_directory="${1:?Usage: verify_backup.sh BACKUP_DIRECTORY}"

for required_file in \
    database.dump \
    invoice-pdfs.tar.gz \
    electronic-invoices.tar.gz \
    media.tar.gz \
    SHA256SUMS; do
    if [[ ! -f "${backup_directory}/${required_file}" ]]; then
        echo "Missing ${required_file}" >&2
        exit 1
    fi
done

(
    cd "${backup_directory}"
    shasum -a 256 -c SHA256SUMS
)

if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "${backup_directory}/database.dump" >/dev/null
fi

for archive in \
    invoice-pdfs.tar.gz \
    electronic-invoices.tar.gz \
    media.tar.gz; do
    if tar -tzf "${backup_directory}/${archive}" \
        | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
        echo "Unsafe path found in ${archive}" >&2
        exit 1
    fi

    tar -tzf "${backup_directory}/${archive}" >/dev/null
done
echo "Backup verification passed"
