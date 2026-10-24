#!/bin/sh
set -eu

rewrite_host_database_url() {
    printf '%s' "$1" | sed \
        -e 's#@localhost:#@host.docker.internal:#' \
        -e 's#@127\\.0\\.0\\.1:#@host.docker.internal:#'
}

app_dir=$(pwd)

DATABASE_URL="$(rewrite_host_database_url "${DATABASE_URL:?DATABASE_URL must be configured in backend/.env}")"
MIGRATION_DATABASE_URL="$(rewrite_host_database_url "${MIGRATION_DATABASE_URL:-$DATABASE_URL}")"
export DATABASE_URL MIGRATION_DATABASE_URL

requirements_fingerprint() {
    sha256sum "$app_dir/requirements.txt" "$app_dir/requirements-dev.txt" | sha256sum | cut -d ' ' -f 1
}

current_fingerprint="$(requirements_fingerprint)"
if [ ! -f /opt/venv/.requirements.sha256 ] \
    || [ "$(cat /opt/venv/.requirements.sha256)" != "$current_fingerprint" ]; then
    echo "Installing updated backend dependencies..."
    pip install --no-cache-dir -r "$app_dir/requirements-dev.txt"
    printf '%s' "$current_fingerprint" > /opt/venv/.requirements.sha256
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting local application with reload..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --timeout-graceful-shutdown 5 \
    --reload-dir "$app_dir"
