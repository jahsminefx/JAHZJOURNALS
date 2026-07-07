-- Backend completion, hardening, analytics, and weekly review support.

ALTER TABLE "User"
  ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerificationTokenHash" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetTokenHash" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetUsedAt" TIMESTAMP(3);

ALTER TABLE "TradeScreenshot"
  ADD COLUMN "fileSize" INTEGER;

ALTER TABLE "WeeklyReview"
  ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "grossLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "profitFactor" DOUBLE PRECISION,
  ADD COLUMN "expectancy" DOUBLE PRECISION,
  ADD COLUMN "averageWin" DOUBLE PRECISION,
  ADD COLUMN "averageLoss" DOUBLE PRECISION,
  ADD COLUMN "averageRiskReward" DOUBLE PRECISION,
  ADD COLUMN "bestTradeId" TEXT,
  ADD COLUMN "worstTradeId" TEXT,
  ADD COLUMN "mainMistake" TEXT,
  ADD COLUMN "personalLesson" TEXT,
  ADD COLUMN "generalReflection" TEXT,
  ADD COLUMN "additionalNotes" TEXT,
  ADD COLUMN "aPlusSetupWinRate" DOUBLE PRECISION,
  ADD COLUMN "newsRelatedWinRate" DOUBLE PRECISION,
  ADD COLUMN "planFollowingRate" DOUBLE PRECISION,
  ADD COLUMN "disciplineScoreFormulaVersion" TEXT,
  ADD COLUMN "disciplineScoreComponents" JSONB;

UPDATE "WeeklyReview"
SET "scopeKey" = COALESCE("tradingAccountId", 'all');

ALTER TABLE "AiTradeReview"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "modelUsed" TEXT,
  ADD COLUMN "promptVersion" TEXT,
  ADD COLUMN "generatedAt" TIMESTAMP(3),
  ADD COLUMN "inputSnapshot" JSONB,
  ADD COLUMN "structuredOutput" JSONB,
  ADD COLUMN "tokenUsage" JSONB,
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "errorMessage" TEXT,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ContactMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WeeklyReview"
  ADD CONSTRAINT "WeeklyReview_bestTradeId_fkey"
  FOREIGN KEY ("bestTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyReview"
  ADD CONSTRAINT "WeeklyReview_worstTradeId_fkey"
  FOREIGN KEY ("worstTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactMessage"
  ADD CONSTRAINT "ContactMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WeeklyReview_userId_scopeKey_weekStartDate_key"
  ON "WeeklyReview"("userId", "scopeKey", "weekStartDate");

CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

CREATE INDEX "User_timezone_idx" ON "User"("timezone");
CREATE INDEX "TradingAccount_userId_idx" ON "TradingAccount"("userId");
CREATE INDEX "TradingAccount_userId_createdAt_idx" ON "TradingAccount"("userId", "createdAt");
CREATE INDEX "Trade_tradingAccountId_idx" ON "Trade"("tradingAccountId");
CREATE INDEX "Trade_tradingAccountId_entryTime_idx" ON "Trade"("tradingAccountId", "entryTime");
CREATE INDEX "Trade_entryTime_idx" ON "Trade"("entryTime");
CREATE INDEX "Trade_exitTime_idx" ON "Trade"("exitTime");
CREATE INDEX "Trade_pair_idx" ON "Trade"("pair");
CREATE INDEX "Trade_result_idx" ON "Trade"("result");
CREATE INDEX "Trade_session_idx" ON "Trade"("session");
CREATE INDEX "Trade_setupType_idx" ON "Trade"("setupType");
CREATE INDEX "Trade_strategyName_idx" ON "Trade"("strategyName");
CREATE INDEX "Trade_direction_idx" ON "Trade"("direction");
CREATE INDEX "Trade_entryTimeframe_idx" ON "Trade"("entryTimeframe");
CREATE INDEX "Trade_followedPlan_idx" ON "Trade"("followedPlan");
CREATE INDEX "Trade_isAPlusSetup_idx" ON "Trade"("isAPlusSetup");
CREATE INDEX "Trade_newsRelated_idx" ON "Trade"("newsRelated");
CREATE INDEX "TradeScreenshot_tradeId_idx" ON "TradeScreenshot"("tradeId");
CREATE INDEX "TradeRule_userId_idx" ON "TradeRule"("userId");
CREATE INDEX "TradeRule_userId_active_idx" ON "TradeRule"("userId", "active");
CREATE INDEX "TradeRuleViolation_tradeId_idx" ON "TradeRuleViolation"("tradeId");
CREATE INDEX "TradeRuleViolation_tradeRuleId_idx" ON "TradeRuleViolation"("tradeRuleId");
CREATE INDEX "EmotionLog_tradeId_idx" ON "EmotionLog"("tradeId");
CREATE INDEX "EmotionLog_emotion_idx" ON "EmotionLog"("emotion");
CREATE INDEX "EmotionLog_stage_idx" ON "EmotionLog"("stage");
CREATE INDEX "WeeklyReview_userId_idx" ON "WeeklyReview"("userId");
CREATE INDEX "WeeklyReview_weekStartDate_idx" ON "WeeklyReview"("weekStartDate");
CREATE INDEX "WeeklyReview_userId_weekStartDate_idx" ON "WeeklyReview"("userId", "weekStartDate");
CREATE INDEX "WeeklyReview_tradingAccountId_weekStartDate_idx" ON "WeeklyReview"("tradingAccountId", "weekStartDate");
CREATE INDEX "AiTradeReview_tradeId_idx" ON "AiTradeReview"("tradeId");
CREATE INDEX "ContactMessage_email_idx" ON "ContactMessage"("email");
CREATE INDEX "ContactMessage_status_idx" ON "ContactMessage"("status");
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
CREATE INDEX "ContactMessage_userId_idx" ON "ContactMessage"("userId");
