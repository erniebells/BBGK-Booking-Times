#!/bin/sh
set -e

echo "Waiting for database..."
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "prisma migrate deploy failed after retries."
    exit 1
  fi
  echo "Database not ready (attempt $i/30); retrying in 2s..."
  sleep 2
done
echo "Migrations applied."
exec "$@"
