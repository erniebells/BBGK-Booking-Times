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

Open [http://localhost:3000](http://localhost:3000). Member tee sheets: `/days`.

If checkout of the Postgres branch aborts due to local edits to `docker-compose.yml` / `schema.prisma` / `Dockerfile`, stash or move those files aside first — rebuilding an old SQLite tree causes **P3019** on migrate and missing tables (**P2021** `RateLimitBucket`).

### Seed accounts

| Role   | Email             | Password    |
|--------|-------------------|-------------|
| Admin  | admin@demo.golf   | admin123!   |
| Member | member@demo.golf  | member123!  |

Guest OTP codes print to the server console when SMTP is unset (development only).

## Product direction

Club administrators create and publish normal playing days and tournaments. Tee times default to 10 minutes apart; each slot holds up to four players.

Members sign in with club-managed accounts. Guests register, verify email, then wait for admin approval before booking.

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
