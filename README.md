# Small Golf Club Tee-Time Booking

An MVP web app for a South African golf club to publish tee sheets and let approved members and guests book fourball places online.

## Stack

- Next.js App Router (TypeScript) in [`web/`](web/)
- SQLite + Prisma for local MVP (Docker Compose Postgres config included when Docker is available)
- Auth.js (credentials)
- Tailwind CSS

## Run locally

```bash
cd web
cp .env.example .env   # if needed
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`docker-compose.yml` is provided for PostgreSQL when Docker is available; switch `prisma/schema.prisma` provider to `postgresql` and update `DATABASE_URL` accordingly.

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
