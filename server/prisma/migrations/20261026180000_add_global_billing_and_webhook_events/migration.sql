-- AlterEnum
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'SYNC_PLUS';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'PRO_SYNC';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'ELITE';

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "billingCountry" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "billingCurrency" TEXT;

-- AlterTable Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "priceId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'NGN';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT DEFAULT 'MONTHLY';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'PAYSTACK';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "providerSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT;

-- CreateTable WebhookEvent
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_idx" ON "WebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");
