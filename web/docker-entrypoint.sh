#!/bin/sh
set -e

echo "Waiting for database..."
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "prisma migrate deploy failed after retries."
    echo "If you see P3019, the image still has a SQLite migration_lock — use the Postgres branch image (provider=postgresql)."
    exit 1
  fi
  echo "Database not ready (attempt $i/30); retrying in 2s..."
  sleep 2
done
echo "Migrations applied."

# Optional one-shot seed (demo admin/member + published day). Safe to re-run (upserts).
# Enable with RUN_SEED=true in compose/environment. Prefer: docker compose exec app npm run db:seed
if [ "${RUN_SEED:-}" = "true" ]; then
  echo "RUN_SEED=true — seeding database via npx tsx..."
  npx tsx prisma/seed.ts
  echo "Seed complete."
fi

exec "$@"
