-- Separate regular trading accounts from prop-firm account details.
-- Existing columns are preserved for backward compatibility and legacy review.

CREATE TYPE "AccountCategory" AS ENUM ('REGULAR', 'PROP_FIRM');
CREATE TYPE "PropFirmMarketType" AS ENUM ('FOREX_CFD', 'FUTURES', 'OTHER');
CREATE TYPE "EvaluationType" AS ENUM ('ONE_STEP', 'TWO_STEP', 'THREE_STEP', 'INSTANT_FUNDED', 'ALREADY_FUNDED', 'FREE_TRIAL', 'DEMO_EVALUATION');
CREATE TYPE "PropFirmAccountStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'FUNDED', 'SUSPENDED', 'RESET', 'EXPIRED');
CREATE TYPE "DrawdownType" AS ENUM ('STATIC', 'TRAILING', 'END_OF_DAY_TRAILING', 'INTRADAY_TRAILING', 'ABSOLUTE');
CREATE TYPE "PropFirmPhaseStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'RESET');

ALTER TABLE "TradingAccount"
  ADD COLUMN "accountCategory" "AccountCategory" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN "platform" TEXT,
  ADD COLUMN "defaultRiskPercent" DOUBLE PRECISION,
  ADD COLUMN "notes" TEXT;

UPDATE "TradingAccount"
SET "accountCategory" = 'PROP_FIRM',
    "defaultRiskPercent" = COALESCE("defaultRiskPercent", "riskPerTradePercent")
WHERE "isPropFirmAccount" = true;

UPDATE "TradingAccount"
SET "defaultRiskPercent" = COALESCE("defaultRiskPercent", "riskPerTradePercent");

CREATE TABLE "PropFirmAccount" (
  "id" TEXT NOT NULL,
  "tradingAccountId" TEXT NOT NULL,
  "firmName" TEXT NOT NULL,
  "customFirmName" TEXT,
  "programmeName" TEXT NOT NULL,
  "marketType" "PropFirmMarketType" NOT NULL,
  "evaluationType" "EvaluationType" NOT NULL,
  "accountStatus" "PropFirmAccountStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "platform" TEXT,
  "brokerServer" TEXT,
  "challengeFee" DOUBLE PRECISION,
  "startDate" TIMESTAMP(3),
  "currentPhaseNumber" INTEGER,
  "dailyLossEnabled" BOOLEAN NOT NULL DEFAULT true,
  "dailyLossPercent" DOUBLE PRECISION,
  "dailyLossAmount" DOUBLE PRECISION,
  "maximumLossPercent" DOUBLE PRECISION,
  "maximumLossAmount" DOUBLE PRECISION,
  "drawdownType" "DrawdownType",
  "dailyLossCalculationBasis" TEXT,
  "overallLossCalculationBasis" TEXT,
  "includeFloatingPnl" BOOLEAN NOT NULL DEFAULT true,
  "includeCommissions" BOOLEAN NOT NULL DEFAULT true,
  "includeSwaps" BOOLEAN NOT NULL DEFAULT true,
  "dailyResetTime" TEXT,
  "dailyResetTimezone" TEXT,
  "maxRiskPerTradePercent" DOUBLE PRECISION,
  "maxRiskPerTradeIdea" DOUBLE PRECISION,
  "maxOpenPositions" INTEGER,
  "maxLotSize" DOUBLE PRECISION,
  "stopAfterLosses" INTEGER,
  "consistencyRuleEnabled" BOOLEAN NOT NULL DEFAULT false,
  "consistencyRuleType" TEXT,
  "consistencyThreshold" DOUBLE PRECISION,
  "maximumBestDayPercent" DOUBLE PRECISION,
  "minimumProfitableDays" INTEGER,
  "profitableDayMinimum" DOUBLE PRECISION,
  "newsTradingAllowed" BOOLEAN,
  "weekendHoldingAllowed" BOOLEAN,
  "overnightHoldingAllowed" BOOLEAN,
  "expertAdvisorsAllowed" BOOLEAN,
  "copyTradingAllowed" BOOLEAN,
  "hedgingAllowed" BOOLEAN,
  "scalpingAllowed" BOOLEAN,
  "cryptoTradingAllowed" BOOLEAN,
  "restrictedSymbols" TEXT[],
  "restrictedNewsBeforeMinutes" INTEGER,
  "restrictedNewsAfterMinutes" INTEGER,
  "maximumInactivityDays" INTEGER,
  "prohibitedStrategies" TEXT,
  "customRules" TEXT,
  "profitSplitPercent" DOUBLE PRECISION,
  "firstPayoutDate" TIMESTAMP(3),
  "payoutFrequency" TEXT,
  "minimumPayoutAmount" DOUBLE PRECISION,
  "payoutCycleStartDate" TIMESTAMP(3),
  "scalingPlanEnabled" BOOLEAN NOT NULL DEFAULT false,
  "nextScalingTarget" DOUBLE PRECISION,
  "maximumAllocation" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PropFirmAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropFirmPhase" (
  "id" TEXT NOT NULL,
  "propFirmAccountId" TEXT NOT NULL,
  "phaseNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "profitTargetPercent" DOUBLE PRECISION,
  "profitTargetAmount" DOUBLE PRECISION,
  "minimumTradingDays" INTEGER,
  "minimumProfitableDays" INTEGER,
  "maximumTradingDays" INTEGER,
  "timeLimitType" TEXT,
  "timeLimitDays" INTEGER,
  "status" "PropFirmPhaseStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PropFirmPhase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropFirmProgressSnapshot" (
  "id" TEXT NOT NULL,
  "propFirmAccountId" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL,
  "equity" DOUBLE PRECISION,
  "dailyProfitLoss" DOUBLE PRECISION,
  "overallProfitLoss" DOUBLE PRECISION,
  "completedTradingDays" INTEGER NOT NULL DEFAULT 0,
  "profitableDays" INTEGER NOT NULL DEFAULT 0,
  "bestDayProfit" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PropFirmProgressSnapshot_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PropFirmAccount" (
  "id",
  "tradingAccountId",
  "firmName",
  "programmeName",
  "marketType",
  "evaluationType",
  "accountStatus",
  "maximumLossAmount",
  "dailyLossAmount",
  "currentPhaseNumber",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text),
  "id",
  COALESCE(NULLIF("propFirmName", ''), "name", 'Legacy Prop Firm'),
  COALESCE(NULLIF("accountType", ''), 'Legacy prop-firm programme'),
  'FOREX_CFD',
  'DEMO_EVALUATION',
  'ACTIVE',
  "maxDrawdown",
  "dailyDrawdown",
  CASE WHEN "minimumTradingDays" IS NOT NULL OR "profitTarget" IS NOT NULL THEN 1 ELSE NULL END,
  "createdAt",
  "updatedAt"
FROM "TradingAccount"
WHERE "isPropFirmAccount" = true;

INSERT INTO "PropFirmPhase" (
  "id",
  "propFirmAccountId",
  "phaseNumber",
  "name",
  "profitTargetAmount",
  "minimumTradingDays",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text),
  pfa."id",
  1,
  'Legacy evaluation',
  ta."profitTarget",
  ta."minimumTradingDays",
  'ACTIVE',
  ta."createdAt",
  ta."updatedAt"
FROM "PropFirmAccount" pfa
JOIN "TradingAccount" ta ON ta."id" = pfa."tradingAccountId"
WHERE ta."isPropFirmAccount" = true
  AND (ta."profitTarget" IS NOT NULL OR ta."minimumTradingDays" IS NOT NULL);

CREATE UNIQUE INDEX "PropFirmAccount_tradingAccountId_key" ON "PropFirmAccount"("tradingAccountId");
CREATE INDEX "PropFirmAccount_tradingAccountId_idx" ON "PropFirmAccount"("tradingAccountId");
CREATE INDEX "PropFirmAccount_firmName_idx" ON "PropFirmAccount"("firmName");
CREATE INDEX "PropFirmAccount_accountStatus_idx" ON "PropFirmAccount"("accountStatus");
CREATE UNIQUE INDEX "PropFirmPhase_propFirmAccountId_phaseNumber_key" ON "PropFirmPhase"("propFirmAccountId", "phaseNumber");
CREATE INDEX "PropFirmPhase_propFirmAccountId_idx" ON "PropFirmPhase"("propFirmAccountId");
CREATE INDEX "PropFirmProgressSnapshot_propFirmAccountId_recordedAt_idx" ON "PropFirmProgressSnapshot"("propFirmAccountId", "recordedAt");
CREATE INDEX "TradingAccount_userId_accountCategory_idx" ON "TradingAccount"("userId", "accountCategory");

ALTER TABLE "PropFirmAccount"
  ADD CONSTRAINT "PropFirmAccount_tradingAccountId_fkey"
  FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropFirmPhase"
  ADD CONSTRAINT "PropFirmPhase_propFirmAccountId_fkey"
  FOREIGN KEY ("propFirmAccountId") REFERENCES "PropFirmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropFirmProgressSnapshot"
  ADD CONSTRAINT "PropFirmProgressSnapshot_propFirmAccountId_fkey"
  FOREIGN KEY ("propFirmAccountId") REFERENCES "PropFirmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
