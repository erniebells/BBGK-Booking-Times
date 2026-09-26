-- Allow members to share email addresses while keeping admin/guest emails unique
-- This migration is safe for existing production databases with real data

-- Step 1: Drop the unique constraint on User.email
DROP INDEX IF EXISTS "User_email_key";

-- Step 2: Create a partial unique index that only applies to ADMIN and GUEST roles
-- This allows members to share emails but keeps admin/guest emails unique
CREATE UNIQUE INDEX "User_email_admin_guest_unique" ON "User"("email") 
WHERE "role" IN ('ADMIN', 'GUEST');

-- Step 3: Allow email to be nullable for members (schema change handled by Prisma)
-- Members without an email will get a placeholder like member123456@placeholder.local
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
