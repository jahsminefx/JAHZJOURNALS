-- CreateEnum AccountTransactionType (idempotent)
DO $$ BEGIN
    CREATE TYPE "AccountTransactionType" AS ENUM ('OPENING_BALANCE', 'DEPOSIT', 'WITHDRAWAL', 'PAYOUT', 'FEE', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum AccountTransactionDirection (idempotent)
DO $$ BEGIN
    CREATE TYPE "AccountTransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable AccountTransaction (idempotent)
CREATE TABLE IF NOT EXISTS "AccountTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradingAccountId" TEXT NOT NULL,
    "type" "AccountTransactionType" NOT NULL,
    "direction" "AccountTransactionDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "signedAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "transferGroupId" TEXT,
    "linkedPropFirmPayoutId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "archiveReason" TEXT,
    "editedAt" TIMESTAMP(3),
    "editHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "AccountTransaction_linkedPropFirmPayoutId_key" ON "AccountTransaction"("linkedPropFirmPayoutId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_userId_idx" ON "AccountTransaction"("userId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_tradingAccountId_idx" ON "AccountTransaction"("tradingAccountId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_tradingAccountId_archivedAt_occurredAt_idx" ON "AccountTransaction"("tradingAccountId", "archivedAt", "occurredAt");
CREATE INDEX IF NOT EXISTS "AccountTransaction_userId_occurredAt_idx" ON "AccountTransaction"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AccountTransaction_transferGroupId_idx" ON "AccountTransaction"("transferGroupId");
CREATE UNIQUE INDEX IF NOT EXISTS "AccountTransaction_userId_idempotencyKey_key" ON "AccountTransaction"("userId", "idempotencyKey");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_linkedPropFirmPayoutId_fkey" FOREIGN KEY ("linkedPropFirmPayoutId") REFERENCES "PropFirmPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
