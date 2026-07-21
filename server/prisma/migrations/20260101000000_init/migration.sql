-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRADER', 'MENTOR', 'MODERATOR', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('light', 'dark', 'system');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeResult" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN', 'OPEN');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradingSession" AS ENUM ('ASIAN', 'LONDON', 'NEW_YORK', 'LONDON_NEW_YORK_OVERLAP', 'OTHER');

-- CreateEnum
CREATE TYPE "TradeGrade" AS ENUM ('A_PLUS', 'A', 'B', 'C', 'D', 'MISTAKE');

-- CreateEnum
CREATE TYPE "ScreenshotType" AS ENUM ('HIGHER_TIMEFRAME_ANALYSIS', 'BEFORE_ENTRY', 'ENTRY', 'DURING_TRADE', 'EXIT', 'POST_ANALYSIS', 'MARKED_CHART');

-- CreateEnum
CREATE TYPE "EmotionStage" AS ENUM ('BEFORE_TRADE', 'DURING_TRADE', 'AFTER_TRADE');

-- CreateEnum
CREATE TYPE "Emotion" AS ENUM ('CALM', 'CONFIDENT', 'ANXIOUS', 'GREEDY', 'FEARFUL', 'ANGRY', 'FOMO', 'REVENGE_MINDSET', 'DISCIPLINED', 'REGRETFUL', 'FRUSTRATED');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'MENTOR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('PAYMENT', 'PROMOTION', 'ADMIN', 'GIFT', 'REFERRAL');

-- CreateEnum
CREATE TYPE "SubscriptionReason" AS ENUM ('PROMOTION_EXPIRED', 'ADMIN_GRANTED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'PROMOTION_REDEEMED', 'REFERRAL_REWARD', 'INITIAL_SIGNUP');

-- CreateEnum
CREATE TYPE "PromotionCategory" AS ENUM ('LAUNCH', 'REFERRAL', 'GIFT', 'COUPON', 'BETA', 'INTERNAL', 'MARKETING', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AiFeatureType" AS ENUM ('TRADE_REVIEW', 'WEEKLY_COACH', 'EDGE_FINDER', 'TRADING_PLAN', 'SCREENSHOT_REVIEW', 'JOURNAL_ASSISTANT', 'ANALYTICS_ASSISTANT', 'MENTOR_SUMMARY', 'SUPPORT_ASSISTANT');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('REGULAR', 'PROP_FIRM');

-- CreateEnum
CREATE TYPE "PropFirmMarketType" AS ENUM ('FOREX_CFD', 'FUTURES', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('ONE_STEP', 'TWO_STEP', 'THREE_STEP', 'INSTANT_FUNDED', 'ALREADY_FUNDED', 'FREE_TRIAL', 'DEMO_EVALUATION');

-- CreateEnum
CREATE TYPE "PropFirmAccountStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'FUNDED', 'SUSPENDED', 'RESET', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DrawdownType" AS ENUM ('STATIC', 'TRAILING', 'END_OF_DAY_TRAILING', 'INTRADAY_TRAILING', 'ABSOLUTE');

-- CreateEnum
CREATE TYPE "PropFirmPhaseStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRADER',
    "country" TEXT,
    "timezone" TEXT,
    "phoneNumber" TEXT,
    "tradingExperience" TEXT,
    "mainTradingPairs" TEXT[],
    "mainSession" TEXT,
    "tradingStyle" TEXT,
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationTokenHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "passwordResetTokenHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "passwordResetUsedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "avatarUrl" TEXT,
    "avatarPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'system',
    "dashboardDensity" TEXT NOT NULL DEFAULT 'comfortable',
    "tradeTableDensity" TEXT NOT NULL DEFAULT 'comfortable',
    "chartAnimations" BOOLEAN NOT NULL DEFAULT true,
    "preferredDateFormat" TEXT DEFAULT 'DD/MM/YYYY',
    "preferredNumberFormat" TEXT DEFAULT '1,234.56',
    "defaultTradingAccountId" TEXT,
    "defaultRiskPercent" DOUBLE PRECISION,
    "minimumRiskRewardRatio" DOUBLE PRECISION,
    "defaultHigherTimeframe" TEXT,
    "defaultEntryTimeframe" TEXT,
    "mainStrategy" TEXT,
    "mainPairs" TEXT,
    "preferredSession" TEXT,
    "maxTradesPerDay" INTEGER,
    "maxLossesPerDay" INTEGER,
    "dailyLossLimit" DOUBLE PRECISION,
    "defaultTradeGrade" TEXT,
    "requireScreenshotBeforeCompletion" BOOLEAN NOT NULL DEFAULT false,
    "requirePostTradeNotes" BOOLEAN NOT NULL DEFAULT false,
    "requireEmotionTracking" BOOLEAN NOT NULL DEFAULT false,
    "requireRuleChecklist" BOOLEAN NOT NULL DEFAULT false,
    "showOpenTradesFirst" BOOLEAN NOT NULL DEFAULT true,
    "defaultTradeListView" TEXT NOT NULL DEFAULT 'table',
    "defaultAnalyticsPeriod" TEXT NOT NULL DEFAULT '30d',
    "requiredTradeFields" TEXT[] DEFAULT ARRAY['pair', 'direction', 'entryPrice', 'stopLoss', 'takeProfit']::TEXT[],
    "defaultScreenshotType" TEXT NOT NULL DEFAULT 'MARKED_CHART',
    "defaultScreenshotQuality" TEXT NOT NULL DEFAULT 'high',
    "maximumScreenshotsPerTrade" INTEGER NOT NULL DEFAULT 6,
    "automaticallyCompressImages" BOOLEAN NOT NULL DEFAULT true,
    "keepOriginalImage" BOOLEAN NOT NULL DEFAULT false,
    "deleteCloudinaryImagesWithTrade" BOOLEAN NOT NULL DEFAULT true,
    "enableAiTradeReviews" BOOLEAN NOT NULL DEFAULT false,
    "generateReviewAfterClose" BOOLEAN NOT NULL DEFAULT false,
    "includeEmotions" BOOLEAN NOT NULL DEFAULT true,
    "includeRuleViolations" BOOLEAN NOT NULL DEFAULT true,
    "includeScreenshots" BOOLEAN NOT NULL DEFAULT false,
    "weeklyAiSummary" BOOLEAN NOT NULL DEFAULT false,
    "coachingTone" TEXT NOT NULL DEFAULT 'analytical',
    "assignedMentor" TEXT,
    "shareTradesWithMentor" BOOLEAN NOT NULL DEFAULT false,
    "shareScreenshots" BOOLEAN NOT NULL DEFAULT false,
    "shareEmotions" BOOLEAN NOT NULL DEFAULT false,
    "shareWeeklyReviews" BOOLEAN NOT NULL DEFAULT false,
    "allowMentorComments" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReviewReminders" BOOLEAN NOT NULL DEFAULT false,
    "dailyJournalingReminders" BOOLEAN NOT NULL DEFAULT false,
    "tradeFollowUpReminders" BOOLEAN NOT NULL DEFAULT false,
    "riskLimitWarnings" BOOLEAN NOT NULL DEFAULT false,
    "propFirmDrawdownWarnings" BOOLEAN NOT NULL DEFAULT false,
    "mentorFeedbackNotifications" BOOLEAN NOT NULL DEFAULT false,
    "productUpdates" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "riskPerTrade" DOUBLE PRECISION,
    "dailyDrawdownLimit" DOUBLE PRECISION,
    "weeklyDrawdownLimit" DOUBLE PRECISION,
    "maximumOpenTrades" INTEGER,
    "stopAfterLosses" INTEGER,
    "warnRiskAboveLimit" BOOLEAN NOT NULL DEFAULT false,
    "warnRiskRewardBelowMinimum" BOOLEAN NOT NULL DEFAULT false,
    "loginAlerts" BOOLEAN NOT NULL DEFAULT false,
    "billingEmail" TEXT,
    "renewalReminders" BOOLEAN NOT NULL DEFAULT false,
    "enableJahzAi" BOOLEAN NOT NULL DEFAULT true,
    "allowTradeDataAnalysis" BOOLEAN NOT NULL DEFAULT true,
    "allowAiUseOfJournalData" BOOLEAN NOT NULL DEFAULT false,
    "allowScreenshotAnalysis" BOOLEAN NOT NULL DEFAULT false,
    "aiLanguage" TEXT NOT NULL DEFAULT 'english',
    "saveAiHistory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountCategory" "AccountCategory" NOT NULL DEFAULT 'REGULAR',
    "brokerName" TEXT,
    "accountType" TEXT,
    "startingBalance" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "platform" TEXT,
    "defaultRiskPercent" DOUBLE PRECISION,
    "riskPerTradePercent" DOUBLE PRECISION,
    "maxDailyLossPercent" DOUBLE PRECISION,
    "maxTradesPerDay" INTEGER,
    "maxLossesPerDay" INTEGER,
    "notes" TEXT,
    "isPropFirmAccount" BOOLEAN NOT NULL DEFAULT false,
    "propFirmName" TEXT,
    "profitTarget" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "dailyDrawdown" DOUBLE PRECISION,
    "minimumTradingDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropFirmAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropFirmPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "tradingAccountId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "entryPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "lotSize" DOUBLE PRECISION,
    "riskAmount" DOUBLE PRECISION,
    "rewardAmount" DOUBLE PRECISION,
    "profitLossAmount" DOUBLE PRECISION,
    "profitLossPercent" DOUBLE PRECISION,
    "riskRewardRatio" DOUBLE PRECISION,
    "pips" DOUBLE PRECISION,
    "result" "TradeResult" NOT NULL DEFAULT 'OPEN',
    "status" "TradeStatus" NOT NULL DEFAULT 'PLANNED',
    "session" "TradingSession",
    "strategyId" TEXT,
    "setupId" TEXT,
    "higherTimeframe" TEXT,
    "entryTimeframe" TEXT,
    "htfBias" TEXT,
    "entryReason" TEXT,
    "exitReason" TEXT,
    "notesBefore" TEXT,
    "notesAfter" TEXT,
    "followedPlan" BOOLEAN,
    "isAPlusSetup" BOOLEAN,
    "newsRelated" BOOLEAN,
    "grade" "TradeGrade",
    "entryTime" TIMESTAMP(3),
    "exitTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeScreenshot" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "screenshotType" "ScreenshotType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "fileSize" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRuleViolation" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "tradeRuleId" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeRuleViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmotionLog" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "stage" "EmotionStage" NOT NULL,
    "emotion" "Emotion" NOT NULL,
    "intensity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmotionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedTradeFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedTradeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradingAccountId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT 'all',
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "breakevens" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION,
    "expectancy" DOUBLE PRECISION,
    "averageWin" DOUBLE PRECISION,
    "averageLoss" DOUBLE PRECISION,
    "averageRiskReward" DOUBLE PRECISION,
    "bestTradeId" TEXT,
    "worstTradeId" TEXT,
    "bestPair" TEXT,
    "worstPair" TEXT,
    "bestSession" TEXT,
    "worstSession" TEXT,
    "bestSetup" TEXT,
    "worstSetup" TEXT,
    "biggestMistake" TEXT,
    "mostCommonEmotion" TEXT,
    "mostBrokenRule" TEXT,
    "mainLesson" TEXT,
    "mainMistake" TEXT,
    "personalLesson" TEXT,
    "nextWeekFocus" TEXT,
    "generalReflection" TEXT,
    "additionalNotes" TEXT,
    "aPlusSetupWinRate" DOUBLE PRECISION,
    "newsRelatedWinRate" DOUBLE PRECISION,
    "planFollowingRate" DOUBLE PRECISION,
    "disciplineScore" INTEGER,
    "disciplineScoreFormulaVersion" TEXT,
    "disciplineScoreComponents" JSONB,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTradeReview" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "summary" TEXT,
    "mistakes" TEXT,
    "strengths" TEXT,
    "ruleFeedback" TEXT,
    "psychologyFeedback" TEXT,
    "riskFeedback" TEXT,
    "recommendation" TEXT,
    "disciplineScore" INTEGER,
    "rawResponse" TEXT,
    "provider" TEXT,
    "modelUsed" TEXT,
    "promptVersion" TEXT,
    "generatedAt" TIMESTAMP(3),
    "inputSnapshot" JSONB,
    "structuredOutput" JSONB,
    "tokenUsage" JSONB,
    "reviewStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTradeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" TEXT,
    "weeklyReviewId" TEXT,
    "mentorGroupId" TEXT,
    "featureType" "AiFeatureType" NOT NULL,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB,
    "structuredOutput" JSONB,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DECIMAL(65,30),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorGroup" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorStudent" (
    "id" TEXT NOT NULL,
    "mentorGroupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorFeedback" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "grade" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "SubscriptionSource" NOT NULL DEFAULT 'PAYMENT',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "paymentReference" TEXT,
    "promotionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "style" TEXT,
    "market" TEXT,
    "defaultRiskPercent" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "preferredSession" TEXT,
    "preferredTimeframes" TEXT[],
    "minimumRR" DOUBLE PRECISION,
    "maximumRisk" DOUBLE PRECISION,
    "exampleImage" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeChecklistResponse" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "planGranted" "SubscriptionPlan" NOT NULL,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "badgeId" TEXT,
    "category" "PromotionCategory" NOT NULL DEFAULT 'MARKETING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "currentRedemptions" INTEGER NOT NULL DEFAULT 0,
    "requiresInvite" BOOLEAN NOT NULL DEFAULT false,
    "autoActivate" BOOLEAN NOT NULL DEFAULT false,
    "autoExpire" BOOLEAN NOT NULL DEFAULT false,
    "revokeBadgeOnExpiry" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousPlan" "SubscriptionPlan",
    "newPlan" "SubscriptionPlan" NOT NULL,
    "source" "SubscriptionSource" NOT NULL,
    "reason" "SubscriptionReason",
    "promotionId" TEXT,
    "paymentReference" TEXT,
    "changedBy" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gold',
    "icon" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assignedTo" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "browser" TEXT,
    "device" TEXT,
    "appVersion" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedTo" TEXT,
    "relatedModule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "estimatedRelease" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "category" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "targetUsers" TEXT[],
    "targetRoles" TEXT[],
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "senderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetAudiences" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "displayLocations" TEXT[] DEFAULT ARRAY['DASHBOARD']::TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "assignedToId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactThread" (
    "id" TEXT NOT NULL,
    "contactMessageId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "message" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInternalNote" (
    "id" TEXT NOT NULL,
    "contactMessageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactInternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_timezone_idx" ON "User"("timezone");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "TradingAccount_userId_idx" ON "TradingAccount"("userId");

-- CreateIndex
CREATE INDEX "TradingAccount_userId_createdAt_idx" ON "TradingAccount"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TradingAccount_userId_accountCategory_idx" ON "TradingAccount"("userId", "accountCategory");

-- CreateIndex
CREATE UNIQUE INDEX "PropFirmAccount_tradingAccountId_key" ON "PropFirmAccount"("tradingAccountId");

-- CreateIndex
CREATE INDEX "PropFirmAccount_tradingAccountId_idx" ON "PropFirmAccount"("tradingAccountId");

-- CreateIndex
CREATE INDEX "PropFirmAccount_firmName_idx" ON "PropFirmAccount"("firmName");

-- CreateIndex
CREATE INDEX "PropFirmAccount_accountStatus_idx" ON "PropFirmAccount"("accountStatus");

-- CreateIndex
CREATE INDEX "PropFirmPhase_propFirmAccountId_idx" ON "PropFirmPhase"("propFirmAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PropFirmPhase_propFirmAccountId_phaseNumber_key" ON "PropFirmPhase"("propFirmAccountId", "phaseNumber");

-- CreateIndex
CREATE INDEX "PropFirmProgressSnapshot_propFirmAccountId_recordedAt_idx" ON "PropFirmProgressSnapshot"("propFirmAccountId", "recordedAt");

-- CreateIndex
CREATE INDEX "TradingGoal_userId_active_periodType_idx" ON "TradingGoal"("userId", "active", "periodType");

-- CreateIndex
CREATE INDEX "TradingGoal_tradingAccountId_idx" ON "TradingGoal"("tradingAccountId");

-- CreateIndex
CREATE INDEX "Trade_tradingAccountId_idx" ON "Trade"("tradingAccountId");

-- CreateIndex
CREATE INDEX "Trade_tradingAccountId_entryTime_idx" ON "Trade"("tradingAccountId", "entryTime");

-- CreateIndex
CREATE INDEX "Trade_entryTime_idx" ON "Trade"("entryTime");

-- CreateIndex
CREATE INDEX "Trade_exitTime_idx" ON "Trade"("exitTime");

-- CreateIndex
CREATE INDEX "Trade_pair_idx" ON "Trade"("pair");

-- CreateIndex
CREATE INDEX "Trade_result_idx" ON "Trade"("result");

-- CreateIndex
CREATE INDEX "Trade_session_idx" ON "Trade"("session");

-- CreateIndex
CREATE INDEX "Trade_strategyId_idx" ON "Trade"("strategyId");

-- CreateIndex
CREATE INDEX "Trade_setupId_idx" ON "Trade"("setupId");

-- CreateIndex
CREATE INDEX "Trade_direction_idx" ON "Trade"("direction");

-- CreateIndex
CREATE INDEX "Trade_entryTimeframe_idx" ON "Trade"("entryTimeframe");

-- CreateIndex
CREATE INDEX "Trade_followedPlan_idx" ON "Trade"("followedPlan");

-- CreateIndex
CREATE INDEX "Trade_isAPlusSetup_idx" ON "Trade"("isAPlusSetup");

-- CreateIndex
CREATE INDEX "Trade_newsRelated_idx" ON "Trade"("newsRelated");

-- CreateIndex
CREATE INDEX "TradeScreenshot_tradeId_idx" ON "TradeScreenshot"("tradeId");

-- CreateIndex
CREATE INDEX "TradeRule_userId_idx" ON "TradeRule"("userId");

-- CreateIndex
CREATE INDEX "TradeRule_userId_active_idx" ON "TradeRule"("userId", "active");

-- CreateIndex
CREATE INDEX "TradeRuleViolation_tradeId_idx" ON "TradeRuleViolation"("tradeId");

-- CreateIndex
CREATE INDEX "TradeRuleViolation_tradeRuleId_idx" ON "TradeRuleViolation"("tradeRuleId");

-- CreateIndex
CREATE INDEX "EmotionLog_tradeId_idx" ON "EmotionLog"("tradeId");

-- CreateIndex
CREATE INDEX "EmotionLog_emotion_idx" ON "EmotionLog"("emotion");

-- CreateIndex
CREATE INDEX "EmotionLog_stage_idx" ON "EmotionLog"("stage");

-- CreateIndex
CREATE INDEX "WeeklyReview_userId_idx" ON "WeeklyReview"("userId");

-- CreateIndex
CREATE INDEX "WeeklyReview_weekStartDate_idx" ON "WeeklyReview"("weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklyReview_userId_weekStartDate_idx" ON "WeeklyReview"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklyReview_tradingAccountId_weekStartDate_idx" ON "WeeklyReview"("tradingAccountId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_scopeKey_weekStartDate_key" ON "WeeklyReview"("userId", "scopeKey", "weekStartDate");

-- CreateIndex
CREATE INDEX "AiTradeReview_tradeId_idx" ON "AiTradeReview"("tradeId");

-- CreateIndex
CREATE INDEX "AiRequest_userId_featureType_createdAt_idx" ON "AiRequest"("userId", "featureType", "createdAt");

-- CreateIndex
CREATE INDEX "AiRequest_status_createdAt_idx" ON "AiRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Strategy_userId_idx" ON "Strategy"("userId");

-- CreateIndex
CREATE INDEX "Strategy_userId_isArchived_idx" ON "Strategy"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "Setup_strategyId_idx" ON "Setup"("strategyId");

-- CreateIndex
CREATE INDEX "ChecklistItem_setupId_idx" ON "ChecklistItem"("setupId");

-- CreateIndex
CREATE INDEX "TradeChecklistResponse_tradeId_idx" ON "TradeChecklistResponse"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeChecklistResponse_tradeId_checklistItemId_key" ON "TradeChecklistResponse"("tradeId", "checklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_slug_key" ON "Promotion"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "Badge"("name");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_ticketNumber_idx" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "BugReport_reporterId_idx" ON "BugReport"("reporterId");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "FeatureRequest_userId_idx" ON "FeatureRequest"("userId");

-- CreateIndex
CREATE INDEX "FeatureRequest_status_idx" ON "FeatureRequest"("status");

-- CreateIndex
CREATE INDEX "InternalNote_userId_idx" ON "InternalNote"("userId");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_status_idx" ON "NotificationRecipient"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- CreateIndex
CREATE INDEX "Announcement_startsAt_endsAt_idx" ON "Announcement"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ContactMessage_email_idx" ON "ContactMessage"("email");

-- CreateIndex
CREATE INDEX "ContactMessage_status_idx" ON "ContactMessage"("status");

-- CreateIndex
CREATE INDEX "ContactMessage_assignedToId_idx" ON "ContactMessage"("assignedToId");

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_userId_idx" ON "ContactMessage"("userId");

-- CreateIndex
CREATE INDEX "ContactThread_contactMessageId_idx" ON "ContactThread"("contactMessageId");

-- CreateIndex
CREATE INDEX "ContactInternalNote_contactMessageId_idx" ON "ContactInternalNote"("contactMessageId");

-- CreateIndex
CREATE INDEX "ContactInternalNote_authorId_idx" ON "ContactInternalNote"("authorId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropFirmAccount" ADD CONSTRAINT "PropFirmAccount_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropFirmPhase" ADD CONSTRAINT "PropFirmPhase_propFirmAccountId_fkey" FOREIGN KEY ("propFirmAccountId") REFERENCES "PropFirmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropFirmProgressSnapshot" ADD CONSTRAINT "PropFirmProgressSnapshot_propFirmAccountId_fkey" FOREIGN KEY ("propFirmAccountId") REFERENCES "PropFirmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingGoal" ADD CONSTRAINT "TradingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingGoal" ADD CONSTRAINT "TradingGoal_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeScreenshot" ADD CONSTRAINT "TradeScreenshot_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRule" ADD CONSTRAINT "TradeRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRuleViolation" ADD CONSTRAINT "TradeRuleViolation_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRuleViolation" ADD CONSTRAINT "TradeRuleViolation_tradeRuleId_fkey" FOREIGN KEY ("tradeRuleId") REFERENCES "TradeRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionLog" ADD CONSTRAINT "EmotionLog_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTradeFile" ADD CONSTRAINT "ImportedTradeFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_bestTradeId_fkey" FOREIGN KEY ("bestTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_worstTradeId_fkey" FOREIGN KEY ("worstTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTradeReview" ADD CONSTRAINT "AiTradeReview_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorGroup" ADD CONSTRAINT "MentorGroup_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorStudent" ADD CONSTRAINT "MentorStudent_mentorGroupId_fkey" FOREIGN KEY ("mentorGroupId") REFERENCES "MentorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorStudent" ADD CONSTRAINT "MentorStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorFeedback" ADD CONSTRAINT "MentorFeedback_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorFeedback" ADD CONSTRAINT "MentorFeedback_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeChecklistResponse" ADD CONSTRAINT "TradeChecklistResponse_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeChecklistResponse" ADD CONSTRAINT "TradeChecklistResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactThread" ADD CONSTRAINT "ContactThread_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInternalNote" ADD CONSTRAINT "ContactInternalNote_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInternalNote" ADD CONSTRAINT "ContactInternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

