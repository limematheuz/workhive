#!/bin/sh
set -e

echo "Running WorkHive database migrations..."
exec alembic upgrade head
