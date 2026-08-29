-- CreateEnum
CREATE TYPE "DailyReviewStatus" AS ENUM ('DRAFT', 'COMPLETED', 'REVIEWED');

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "fxRateToReporting" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "fxRateSource" TEXT,
ADD COLUMN IF NOT EXISTS "fxRateTimestamp" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DailyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradingAccountId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT 'all',
    "reviewDate" DATE NOT NULL,
    "status" "DailyReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "whatWentWell" TEXT,
    "whatWentWrong" TEXT,
    "lessonsLearned" TEXT,
    "tomorrowFocus" TEXT,
    "followedPlan" BOOLEAN,
    "emotionalState" TEXT,
    "marketConditions" TEXT,
    "generalNotes" TEXT,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION,
    "totalPips" DOUBLE PRECISION,
    "averageRiskReward" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "aiStructuredOutput" JSONB,
    "aiGeneratedAt" TIMESTAMP(3),
    "aiRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedTrade" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "includeScreenshot" BOOLEAN NOT NULL DEFAULT false,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedDailyReview" (
    "id" TEXT NOT NULL,
    "dailyReviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "includeAiReview" BOOLEAN NOT NULL DEFAULT false,
    "includeNotes" BOOLEAN NOT NULL DEFAULT false,
    "includeScreenshots" BOOLEAN NOT NULL DEFAULT false,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedDailyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "DailyReview_userId_scopeKey_reviewDate_key" ON "DailyReview"("userId", "scopeKey", "reviewDate");
CREATE INDEX IF NOT EXISTS "DailyReview_userId_idx" ON "DailyReview"("userId");
CREATE INDEX IF NOT EXISTS "DailyReview_reviewDate_idx" ON "DailyReview"("reviewDate");
CREATE INDEX IF NOT EXISTS "DailyReview_userId_reviewDate_idx" ON "DailyReview"("userId", "reviewDate");
CREATE INDEX IF NOT EXISTS "DailyReview_tradingAccountId_reviewDate_idx" ON "DailyReview"("tradingAccountId", "reviewDate");

CREATE UNIQUE INDEX IF NOT EXISTS "SharedTrade_shareToken_key" ON "SharedTrade"("shareToken");
CREATE INDEX IF NOT EXISTS "SharedTrade_tradeId_idx" ON "SharedTrade"("tradeId");
CREATE INDEX IF NOT EXISTS "SharedTrade_userId_idx" ON "SharedTrade"("userId");
CREATE INDEX IF NOT EXISTS "SharedTrade_shareToken_idx" ON "SharedTrade"("shareToken");

CREATE UNIQUE INDEX IF NOT EXISTS "SharedDailyReview_shareToken_key" ON "SharedDailyReview"("shareToken");
CREATE INDEX IF NOT EXISTS "SharedDailyReview_dailyReviewId_idx" ON "SharedDailyReview"("dailyReviewId");
CREATE INDEX IF NOT EXISTS "SharedDailyReview_userId_idx" ON "SharedDailyReview"("userId");
CREATE INDEX IF NOT EXISTS "SharedDailyReview_shareToken_idx" ON "SharedDailyReview"("shareToken");

-- AddForeignKeys
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedTrade" ADD CONSTRAINT "SharedTrade_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedTrade" ADD CONSTRAINT "SharedTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedDailyReview" ADD CONSTRAINT "SharedDailyReview_dailyReviewId_fkey" FOREIGN KEY ("dailyReviewId") REFERENCES "DailyReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedDailyReview" ADD CONSTRAINT "SharedDailyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
