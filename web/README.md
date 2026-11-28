# Golf Tee Booking (app)

Postgres + Docker is the supported path on this branch. Do **not** use SQLite or the old `file:./dev.db` migrations — `prisma migrate deploy` will fail with **P3019** against Postgres.

## Docker Compose (recommended)

```bash
cd web
cp .env.example .env
# Set a stable AUTH_SECRET (never hardcode it in docker-compose.yml).
# Changing AUTH_SECRET requires clearing browser cookies for localhost.

docker compose down -v   # only if you need a fresh DB volume
docker compose up -d --build

# Wait until app is up, then seed (tsx is a production dependency; works in the image):
docker compose exec app npm run db:seed
# equivalent: docker compose exec app npx tsx prisma/seed.ts
# or:         docker compose exec app npx prisma db seed

curl -I http://localhost:3000
```

Optional auto-seed on boot: set `RUN_SEED=true` in `.env` (entrypoint runs `npx tsx prisma/seed.ts` after migrate).

### Seed accounts

| Role   | Email             | Password    |
|--------|-------------------|-------------|
| Admin  | admin@demo.golf   | admin123!   |
| Member | member@demo.golf  | member123!  |

### Post-login Application error (digest)

Local logs for digest crashes often show:

1. **`P2021` RateLimitBucket missing** — migrations never applied (wrong/old SQLite tree, or P3019). Fix: rebuild **this** Postgres branch image; entrypoint runs `prisma migrate deploy` (creates `RateLimitBucket`).
2. **`JWTSessionError` no matching decryption secret** — `AUTH_SECRET` changed or cookies from another secret. Fix: keep one stable `AUTH_SECRET` in `.env`, then clear cookies for `localhost:3000` (or use a private window).

Tee sheets for members live at **`/days`** (not `/dates`).

## Host-side Node (without Compose app)

```bash
# Point at published Postgres on localhost
DATABASE_URL="postgresql://golf:golf@localhost:5432/golf_tee" npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

See the repository [README](../README.md) for product context.
