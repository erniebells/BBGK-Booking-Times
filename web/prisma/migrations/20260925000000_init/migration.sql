-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'GUEST', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PlayingDayType" AS ENUM ('NORMAL', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "PlayingDayStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "membershipNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "emailPasswordHash" TEXT,
    "membershipNumberPasswordHash" TEXT,
    "role" "Role" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clubName" TEXT NOT NULL DEFAULT 'Boggoms Bay Golf Club',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 7,
    "cancellationLeadHours" INTEGER NOT NULL DEFAULT 24,

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberImportLog" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "disabled" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "conflicts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayingDay" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "PlayingDayType" NOT NULL DEFAULT 'NORMAL',
    "formatLabel" TEXT,
    "notes" TEXT,
    "firstTeeTime" TEXT NOT NULL,
    "lastTeeTime" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "status" "PlayingDayStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeeSlot" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPlace" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_membershipNumber_key" ON "User"("membershipNumber");

-- CreateIndex
CREATE INDEX "User_normalizedName_idx" ON "User"("normalizedName");

-- CreateIndex
CREATE INDEX "User_membershipNumber_idx" ON "User"("membershipNumber");

-- CreateIndex
CREATE INDEX "MemberImportLog_createdAt_idx" ON "MemberImportLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeeSlot_dayId_startsAt_key" ON "TeeSlot"("dayId", "startsAt");

-- CreateIndex
CREATE INDEX "TeeSlot_startsAt_idx" ON "TeeSlot"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_ownerId_idx" ON "Booking"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPlace_slotId_position_key" ON "BookingPlace"("slotId", "position");

-- CreateIndex
CREATE INDEX "BookingPlace_bookingId_idx" ON "BookingPlace"("bookingId");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "TeeSlot" ADD CONSTRAINT "TeeSlot_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "PlayingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPlace" ADD CONSTRAINT "BookingPlace_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPlace" ADD CONSTRAINT "BookingPlace_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TeeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
