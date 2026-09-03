#!/bin/sh
set -eu

# Local development must use the same schema contract as the containerized
# application. Running Uvicorn directly bypasses migrations and can otherwise
# leave new authorization rules running against stale profiles or tables.
echo "Running local database migrations..."
alembic upgrade head

echo "Starting local application..."
exec uvicorn app.main:app --reload
