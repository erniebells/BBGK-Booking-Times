-- Fix TeeSlot uniqueness for shotgun format
-- Drop old unique INDEX (not constraint), backfill teeNumber, make NOT NULL

-- Step 1: Drop the old unique INDEX (if exists)
DROP INDEX IF EXISTS "TeeSlot_dayId_startsAt_key";

-- Step 2: Drop the old constraint too if it somehow exists (safety)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeeSlot_dayId_startsAt_key') THEN
        ALTER TABLE "TeeSlot" DROP CONSTRAINT "TeeSlot_dayId_startsAt_key";
    END IF;
END $$;

-- Step 3: Backfill teeNumber = 1 for all existing normal-day slots
UPDATE "TeeSlot" SET "teeNumber" = 1 WHERE "teeNumber" IS NULL;

-- Step 4: Make teeNumber NOT NULL with DEFAULT 1
ALTER TABLE "TeeSlot" ALTER COLUMN "teeNumber" SET NOT NULL;
ALTER TABLE "TeeSlot" ALTER COLUMN "teeNumber" SET DEFAULT 1;

-- Step 5: Create the proper unique index that Prisma expects (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'TeeSlot_dayId_startsAt_teeNumber_key'
    ) THEN
        CREATE UNIQUE INDEX "TeeSlot_dayId_startsAt_teeNumber_key" ON "TeeSlot"("dayId", "startsAt", "teeNumber");
    END IF;
END $$;
