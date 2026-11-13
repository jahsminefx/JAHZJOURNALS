-- AlterTable
ALTER TABLE "EconomicNewsAlertPreference" ADD COLUMN IF NOT EXISTS "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EconomicNewsAlertPreference" ADD COLUMN IF NOT EXISTS "calendarPreferences" JSONB;
