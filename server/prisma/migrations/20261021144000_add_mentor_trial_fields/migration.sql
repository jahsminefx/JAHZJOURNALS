-- AlterTable User: Mentor Trial tracking
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasUsedMentorTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorTrialExpiresAt" TIMESTAMP(3);
