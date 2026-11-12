-- CreateEnum PropFirmPayoutStatus (idempotent)
DO $$ BEGIN
    CREATE TYPE "PropFirmPayoutStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable PropFirmPayout
CREATE TABLE IF NOT EXISTS "PropFirmPayout" (
    "id" TEXT NOT NULL,
    "propFirmAccountId" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledDate" TIMESTAMP(3),
    "processedDate" TIMESTAMP(3),
    "amountRequested" DOUBLE PRECISION NOT NULL,
    "profitSplitPercent" DOUBLE PRECISION NOT NULL,
    "netTraderPayout" DOUBLE PRECISION NOT NULL,
    "firmFeeOrDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PropFirmPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentMethod" TEXT,
    "transactionReference" TEXT,
    "highWaterMarkAtRequest" DOUBLE PRECISION,
    "balanceAtRequest" DOUBLE PRECISION,
    "notes" TEXT,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropFirmPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable EconomicNewsAlertPreference
CREATE TABLE IF NOT EXISTS "EconomicNewsAlertPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "targetingMode" TEXT NOT NULL DEFAULT 'CURRENCIES_AND_PAIRS',
    "currencies" TEXT[] DEFAULT ARRAY['USD', 'EUR', 'GBP']::TEXT[],
    "pairs" TEXT[] DEFAULT ARRAY['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']::TEXT[],
    "impactLevels" TEXT[] DEFAULT ARRAY['HIGH']::TEXT[],
    "leadTimesMinutes" INTEGER[] DEFAULT ARRAY[30]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicNewsAlertPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable EconomicNewsAlertLog
CREATE TABLE IF NOT EXISTS "EconomicNewsAlertLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "leadMinutes" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "matchedCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedPairs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impact" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "eventCountry" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "notificationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "errorReason" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicNewsAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PropFirmPayout_propFirmAccountId_requestDate_idx" ON "PropFirmPayout"("propFirmAccountId", "requestDate");
CREATE INDEX IF NOT EXISTS "PropFirmPayout_status_idx" ON "PropFirmPayout"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "EconomicNewsAlertPreference_userId_key" ON "EconomicNewsAlertPreference"("userId");
CREATE INDEX IF NOT EXISTS "EconomicNewsAlertPreference_userId_isEnabled_idx" ON "EconomicNewsAlertPreference"("userId", "isEnabled");

CREATE INDEX IF NOT EXISTS "EconomicNewsAlertLog_userId_createdAt_idx" ON "EconomicNewsAlertLog"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "EconomicNewsAlertLog_userId_eventId_leadMinutes_channel_key" ON "EconomicNewsAlertLog"("userId", "eventId", "leadMinutes", "channel");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "PropFirmPayout" ADD CONSTRAINT "PropFirmPayout_propFirmAccountId_fkey" FOREIGN KEY ("propFirmAccountId") REFERENCES "PropFirmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "EconomicNewsAlertPreference" ADD CONSTRAINT "EconomicNewsAlertPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "EconomicNewsAlertLog" ADD CONSTRAINT "EconomicNewsAlertLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
