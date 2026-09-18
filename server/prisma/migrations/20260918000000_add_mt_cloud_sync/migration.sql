-- AlterTable TradingAccount
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "syncToken" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "mtServerName" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "mtAccountNumber" TEXT;

ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudSyncStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED';
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudAccountId" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudServer" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudLogin" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudInvestorPassword" TEXT;
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudLastSyncedAt" TIMESTAMP(3);
ALTER TABLE "TradingAccount" ADD COLUMN IF NOT EXISTS "cloudError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TradingAccount_syncToken_key" ON "TradingAccount"("syncToken");
CREATE UNIQUE INDEX IF NOT EXISTS "TradingAccount_cloudAccountId_key" ON "TradingAccount"("cloudAccountId");

-- AlterTable Trade
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "initialStopLoss" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "initialTakeProfit" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "slTpHistory" JSONB;
