# Golf Tee Booking (app)

Postgres + Docker is the supported path. Do **not** use SQLite — `prisma migrate deploy` fails with **P3019** against Postgres if the old lock is present.

## Docker Compose (recommended)

```bash
cd web
cp .env.example .env
# Set stable AUTH_SECRET, INITIAL_MEMBER_PASSWORD, ADMIN_PASSWORD
# (never hardcode AUTH_SECRET in docker-compose.yml).

docker compose up -d --build
docker compose exec app npm run db:seed
curl -I http://localhost:3000
```

### Passwords

| Who | How |
|-----|-----|
| Player (first) | `INITIAL_MEMBER_PASSWORD` only → view-only → **My Details** |
| Player (ongoing) | email + **last 4 of SA ID** |
| Admin | `admin@demo.golf` + `ADMIN_PASSWORD` |

Seed demo player: `member@demo.golf` / last 4 of seeded SA ID `8001015009087` → **9087**.

### Admin create sheets

- **Tee Times (normal)**: Date, Sponsor, first start + slot count (10 min, Tee 1). Grid: TIME \| Player 1–4.
- **Shotgun**: Date, Sponsor, one shared start time. Auto slots: Tee 1×3 (start/+10/+20), Tees 2–9×2 (start/+10). Grid: TIME \| TEE \| Player 1–4.
- Chosen **Date** is stored as a club calendar day (noon UTC anchor) so it displays as the same day after save.

Players book **empty cells only**; admin can clear any name. Reset a player under Admin → Accounts.

Tee sheets: **`/days`**.

See the repository [README](../README.md) for product context.
