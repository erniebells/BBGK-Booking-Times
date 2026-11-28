-- CreateEnum
CREATE TYPE "PlayingDayFormat" AS ENUM ('SHOTGUN', 'TEE_TIMES');

-- AlterTable PlayingDay
ALTER TABLE "PlayingDay" ADD COLUMN "format" "PlayingDayFormat" NOT NULL DEFAULT 'TEE_TIMES';
ALTER TABLE "PlayingDay" ADD COLUMN "sponsor" TEXT;

-- AlterTable TeeSlot
ALTER TABLE "TeeSlot" ADD COLUMN "teeNumber" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "TeeSlot_dayId_startsAt_key";

CREATE UNIQUE INDEX "TeeSlot_dayId_startsAt_teeNumber_key" ON "TeeSlot"("dayId", "startsAt", "teeNumber");
CREATE INDEX "TeeSlot_teeNumber_idx" ON "TeeSlot"("teeNumber");

-- AlterTable User (full SA ID never stored plaintext)
ALTER TABLE "User" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "User" ADD COLUMN "idNumberHash" TEXT;
ALTER TABLE "User" ADD COLUMN "idLastFour" TEXT;
ALTER TABLE "User" ADD COLUMN "profileComplete" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "profileComplete" = true WHERE "role" = 'ADMIN';
