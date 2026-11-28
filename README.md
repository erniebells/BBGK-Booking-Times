# Small Golf Club Tee-Time Booking

An MVP web app for a South African golf club to publish tee sheets and let approved members and guests book fourball places online.

## Stack

- Next.js App Router (TypeScript) in [`web/`](web/)
- **PostgreSQL** + Prisma (Docker Compose). SQLite is not supported on this line of work.
- Auth.js (credentials)
- Tailwind CSS

## Run with Docker

```bash
cd web
cp .env.example .env          # set a stable AUTH_SECRET (compose loads via env_file)
docker compose up -d --build
docker compose exec app npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000). Tee sheets: `/days`.

Set in `web/.env`: `AUTH_SECRET`, `INITIAL_MEMBER_PASSWORD`, `ADMIN_PASSWORD`.

### Seed accounts (exact login fields)

| Who | Email | Password |
|-----|--------|----------|
| Admin | `admin@demo.golf` | `ADMIN_PASSWORD` in `web/.env` (default `admin123!`) → opens `/admin` |
| Player (demo) | `member@demo.golf` | `9087` (last 4 of demo SA ID) |
| First-time player | *(blank)* | `INITIAL_MEMBER_PASSWORD` (default `BBGK2026`) then My Details |

If admin login fails with “invalid…”, copy `ADMIN_PASSWORD` / `INITIAL_MEMBER_PASSWORD` from `web/.env.example` into `web/.env`, re-seed if needed, and restart Docker.

## Product direction

Admins publish **Shotgun** (9 tees, times-per-tee) and **Tee Times** (start + N slots @ 10 min, Tee 1) sheets with a yellow TIME / TEE / Player grid. Players sign in with the club password (view-only), complete My Details (SA ID → last-4 password), then book empty cells only.

## MVP scope

- Member and guest sign-in with distinct roles and states
- Admin-managed guest approval and account search
- Admin tee sheets with slot preview, publish/close/cancel
- Bookings, cancellations, concurrency-safe capacity
- Audit history; contact details kept off the public sheet
- South African local time (`Africa/Johannesburg`)

## Out of scope

Payments, handicaps, GolfRSA, scoring, leaderboards, SMS delivery, multi-club tenancy.

## Cursor prompts

Step-by-step agent prompts live in [CURSOR_PROMPTS.md](CURSOR_PROMPTS.md).

## Research links

- [Clubmaster](https://clubmaster.africa/)
- [Teesheet.co.za](https://teesheet.co.za/)
- [Parkview Golf Club](https://parkviewgolf.co.za/members-bookings/)
- [MicroGrow Golf](https://microgrow.co.za/)
- [GolfRSA handicap guidelines](https://www.golfrsa.com/wp-content/uploads/2020/10/GolfRSA-Handicap-Related-Guidelines-for-Clubs.pdf)
- [Information Regulator guidance](https://inforegulator.org.za/wp-content/uploads/2025/05/POPIA-document-gazz.pdf)
