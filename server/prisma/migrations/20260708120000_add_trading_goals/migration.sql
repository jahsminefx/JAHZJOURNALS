-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "TradingGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradingAccountId" TEXT,
    "periodType" "GoalPeriod" NOT NULL,
    "profitTarget" DECIMAL(65,30),
    "tradeCountTarget" INTEGER,
    "winRateTarget" DECIMAL(65,30),
    "maxLossTarget" DECIMAL(65,30),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradingGoal_userId_active_periodType_idx" ON "TradingGoal"("userId", "active", "periodType");

-- CreateIndex
CREATE INDEX "TradingGoal_tradingAccountId_idx" ON "TradingGoal"("tradingAccountId");

-- AddForeignKey
ALTER TABLE "TradingGoal" ADD CONSTRAINT "TradingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingGoal" ADD CONSTRAINT "TradingGoal_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
