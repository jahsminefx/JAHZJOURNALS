-- AlterTable Promotion
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "applicablePlans" "SubscriptionPlan"[] DEFAULT ARRAY[]::"SubscriptionPlan"[];
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "discountType" TEXT DEFAULT 'FULL_GRANT';

-- AlterTable SubscriptionHistory
ALTER TABLE "SubscriptionHistory" ADD COLUMN IF NOT EXISTS "notes" TEXT;
