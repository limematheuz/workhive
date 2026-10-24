#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

# Start FastAPI application using Uvicorn.
echo "Starting application with ${WEB_CONCURRENCY:-1} worker(s)..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-1}" \
    --timeout-graceful-shutdown 5 \
    --proxy-headers \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1,172.16.0.0/12}" \
    --no-access-log
