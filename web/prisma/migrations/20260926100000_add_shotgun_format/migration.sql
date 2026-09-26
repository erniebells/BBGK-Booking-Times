-- Add SHOTGUN day format support
-- Safe for production: existing days default to NORMAL, no data loss

-- Step 1: Create new enum for day format
CREATE TYPE "PlayingDayFormat" AS ENUM ('NORMAL', 'SHOTGUN');

-- Step 2: Add format column to PlayingDay with default NORMAL
ALTER TABLE "PlayingDay" ADD COLUMN "format" "PlayingDayFormat" NOT NULL DEFAULT 'NORMAL';

-- Step 3: Add teeNumber column to TeeSlot (nullable temporarily)
ALTER TABLE "TeeSlot" ADD COLUMN "teeNumber" INTEGER;

-- Step 4: Create index on teeNumber for performance
CREATE INDEX "TeeSlot_teeNumber_idx" ON "TeeSlot"("teeNumber");
