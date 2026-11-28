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

### Passwords / exact login fields

| Who | Email field | Password field | Goes to |
|-----|-------------|----------------|---------|
| **Admin** | `admin@demo.golf` (must match seed) | `ADMIN_PASSWORD` from `web/.env` (default `admin123!`) | `/admin` |
| Player (first) | *(leave blank)* | `INITIAL_MEMBER_PASSWORD` (e.g. `BBGK2026`) | My Details (view-only) |
| Player (ongoing) | your email | last **4** digits of SA ID | `/days` |

**Admin email must be `admin@demo.golf`** — that is the seeded `ADMIN` row. Env `ADMIN_PASSWORD` always works for that user (even if the DB bcrypt hash is stale). Seeded bcrypt still works as a fallback. Prefer unquoted values in `.env` (`ADMIN_PASSWORD=admin123!`). Use **http://localhost:3000** (not https) so the session cookie is not Secure-only.

#### Ernest — exact test after pull (PR #6)

```bash
cd web
git pull
# Confirm web/.env has (unquoted):
#   AUTH_URL=http://localhost:3000
#   ADMIN_PASSWORD=admin123!
#   AUTH_SECRET=<same stable secret as before>
docker compose up -d --build
# optional if you changed ADMIN_PASSWORD and want hash in sync:
# docker compose exec app npm run db:seed
```

1. Open **http://localhost:3000/login** (http, not https).
2. Email: `admin@demo.golf`
3. Password: exact value of `ADMIN_PASSWORD` in `web/.env` (default `admin123!`).
4. Submit → should land on **`/admin`** (not “invalid club password/email/ID”).
5. DevTools → Application → Cookies → `authjs.session-token` must **not** have the Secure flag on localhost.

If login still fails: `docker compose logs app --tail 80` and look for `[auth] secureCookies=false ADMIN_PASSWORD_set=true` and any `Admin email matched but password rejected`.

Seed demo player: `member@demo.golf` / last 4 of SA ID `8001015009087` → **9087**.

### Admin create sheets

- **Type of play**: Tee Times (normal) or Shotgun. Sheet shows **Format of play** label + Notes under the date with the sheet name.
- **Tee Times**: Date, Sponsor, first start + slot count (10 min, Tee 1). Grid: TIME \| Player 1–4.
- **Shotgun**: Date, Sponsor, one shared start time. Auto slots: Tee 1×3 (start/+10/+20), Tees 2–9×2 (start/+10). Rows ordered **tee then time** (19 rows). Grid: TIME \| TEE \| Player 1–4.
- Chosen **Date** is stored as a club calendar day (noon UTC anchor) so it displays as the same day after save.

**Clone / Delete / Closed / Cancelled:** Admin list and day detail. Clone opens the create form prefilled (Date / Sponsor / Type of play editable) as a new **draft** (no bookings copied).

Players book **empty cells** with **any player name**. After booking, **Finished** emails + WhatsApps the full day sheet summary to the player’s profile contacts (console log + status when SMTP / WhatsApp env unset). Admin can clear any name. Reset a player under Admin → Accounts.

Tee sheets: **`/days`**.

See the repository [README](../README.md) for product context.
