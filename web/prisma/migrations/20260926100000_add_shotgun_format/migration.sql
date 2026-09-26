-- Add SHOTGUN day format support
-- Safe for production: existing days default to NORMAL, no data loss

-- Step 1: Create new enum for day format
CREATE TYPE "PlayingDayFormat" AS ENUM ('NORMAL', 'SHOTGUN');

-- Step 2: Add format column to PlayingDay with default NORMAL
ALTER TABLE "PlayingDay" ADD COLUMN "format" "PlayingDayFormat" NOT NULL DEFAULT 'NORMAL';

-- Step 3: Add teeNumber column to TeeSlot (nullable for backward compatibility)
ALTER TABLE "TeeSlot" ADD COLUMN "teeNumber" INTEGER;

-- Step 4: Drop old unique constraint on TeeSlot (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeeSlot_dayId_startsAt_key') THEN
        ALTER TABLE "TeeSlot" DROP CONSTRAINT "TeeSlot_dayId_startsAt_key";
    END IF;
END $$;

-- Step 5: Add new unique constraint including teeNumber
ALTER TABLE "TeeSlot" ADD CONSTRAINT "TeeSlot_dayId_startsAt_teeNumber_key" UNIQUE ("dayId", "startsAt", "teeNumber");

-- Step 6: Add index on teeNumber for performance
CREATE INDEX "TeeSlot_teeNumber_idx" ON "TeeSlot"("teeNumber");
