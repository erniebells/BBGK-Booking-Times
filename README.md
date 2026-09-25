# Boggoms Bay Golf Club - Tee Time Booking

An MVP web app for Boggoms Bay Golf Club near Mossel Bay, South Africa. The app lets club administrators publish tee sheets and allows approved members and guests to book fourball places online.

## Stack

- Next.js 15 App Router (TypeScript) in [`web/`](web/)
- PostgreSQL + Prisma (SQLite supported for local dev)
- Auth.js (next-auth v5) with credentials authentication
- Tailwind CSS 4

## Features

- **Member Management**: Import club members from dot.golf CSV exports
- **Dual Authentication**: Members login with name + email/membership number; admins use email + password
- **Rate Limiting**: Protection against brute-force attacks on all auth endpoints
- **Role-based Access**: Members, Guests, and Admins with distinct permissions
- **Tee Sheet Management**: Create and publish playing days with flexible tee times
- **Booking System**: Concurrency-safe fourball bookings with cancellation
- **Audit Trail**: Complete history of administrative actions
- **Docker Deployment**: Production-ready container setup for Unraid/NAS hosting

## Quick Start - Local Development

```bash
cd web
cp .env.example .env
# Edit .env - set a random AUTH_SECRET and initial admin credentials
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The seed will create an initial admin account from the `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` environment variables if no admin exists.

### Member Data

Members are imported via CSV from dot.golf. A sample CSV is provided at `web/samples/sample-members-dotgolf.csv` for testing. In production, admins upload the real export via the admin panel at `/admin/members/import`.

## Docker Deployment (Unraid/Production)

### Prerequisites

- Docker and Docker Compose
- At least 2GB RAM
- Persistent storage volume

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure:
   ```bash
   cd web
   cp .env.example .env
   ```

3. **REQUIRED**: Set secure values in `.env`:
   - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `POSTGRES_PASSWORD`: Strong database password
   - `INITIAL_ADMIN_EMAIL`: Your admin email
   - `INITIAL_ADMIN_PASSWORD`: Secure admin password

4. Build and start:
   ```bash
   docker compose build
   docker compose up -d
   ```

5. Access the app at `http://your-server:3100`

6. Sign in with your admin credentials and import members

### Environment Variables (Production)

Required:
- `AUTH_SECRET`: 32+ character random string (will refuse to start if missing/placeholder)
- `POSTGRES_PASSWORD`: Database password
- `INITIAL_ADMIN_EMAIL`: Bootstrap admin email (only used if no admin exists)
- `INITIAL_ADMIN_PASSWORD`: Bootstrap admin password

Optional:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Email delivery for guest verification

### Data Persistence

The Docker setup uses a named volume `postgres_data` for database persistence. Back this up regularly:

```bash
docker compose exec db pg_dump -U golfclub boggoms_golf > backup.sql
```

## Member Import

1. Export "Full Member Listing" from dot.golf (CSV format)
2. Navigate to `/admin/members/import`
3. Upload the CSV file
4. Review the import report:
   - **Created**: New members added
   - **Updated**: Existing members refreshed
   - **Disabled**: Resigned members deactivated
   - **Skipped**: Resigned members not previously imported
   - **Conflicts**: Duplicate names requiring manual resolution

### Member Login Rules

- **Username**: Member's full name as registered (case-insensitive, whitespace-flexible, bracket content ignored)
- **Password**: EITHER the member's email address OR their 10-digit membership number (both work)
- Members without an email use their membership number to login
- Duplicate normalized names are flagged and cannot login until resolved by admin

## Admin Tasks

- **Members**: `/admin/members` - Search, edit, import from CSV
- **Guests**: `/admin/guests` - Approve/reject guest registrations
- **Playing Days**: `/admin/days/new` - Create tee sheets with custom intervals
- **Accounts**: `/admin/accounts` - View all users (members, guests, admins)
- **Audit Log**: `/admin/audit` - Review all administrative actions

## Security

- Rate limiting on all authentication endpoints (per-user and per-IP)
- JWT sessions with automatic role/status revalidation
- Password hashing with bcrypt (cost factor 12)
- Production startup validation for AUTH_SECRET
- Automatic `.gitignore` rules to prevent committing CSV uploads

## Known Limitations (Out of Scope)

These exist but are not addressed in the current system:

- Guest email verification throws in production without SMTP configuration
- Cancelling a playing day leaves its bookings active
- Club-specific rules (9/18 hole options, two-tee system, Wed/Sat competitions, green-fee member classes) are not yet modeled

## Product Direction

Club administrators create and publish normal playing days and tournaments. Tee times default to 10 minutes apart; each slot holds up to four players. Members sign in with club-managed accounts imported from dot.golf. Guests register, verify email, then wait for admin approval before booking.

## Research Links

- [Clubmaster](https://clubmaster.africa/)
- [Teesheet.co.za](https://teesheet.co.za/)
- [Parkview Golf Club](https://parkviewgolf.co.za/members-bookings/)
- [MicroGrow Golf](https://microgrow.co.za/)
- [GolfRSA handicap guidelines](https://www.golfrsa.com/wp-content/uploads/2020/10/GolfRSA-Handicap-Related-Guidelines-for-Clubs.pdf)
- [Information Regulator guidance](https://inforegulator.org.za/wp-content/uploads/2025/05/POPIA-document-gazz.pdf)
