const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  PLANS,
  MENTOR_TIERS,
  getPlanConfig,
  getEffectivePlanKey,
  buildLimitReachedPayload,
} = require('../config/plans');

/**
 * AI feature monthly limits by subscription tier
 */
const AI_FEATURE_LIMITS = {
  FREE: {
    SHARED_TRIAL: 2,
    allowedFeatures: ['TRADE_REVIEW', 'CHAT_SUPPORT'],
  },
  STARTER: {
    TRADE_REVIEW: 10,
    WEEKLY_COACH: 5,
    CHAT_SUPPORT: 10,
    JOURNAL_ASSISTANT: 20,
    DAILY_REVIEW: 10,
  },
  PRO: {
    TRADE_REVIEW: 50,
    WEEKLY_COACH: 20,
    CHAT_SUPPORT: 50,
    EDGE_FINDER: 10,
    TRADING_PLAN: 5,
    SCREENSHOT_REVIEW: 20,
    JOURNAL_ASSISTANT: 100,
    PSYCHOLOGY_INSIGHTS: 10,
    DAILY_REVIEW: 31,
    AI_TRADE_CAPTURE: 300,
  },
  SYNC_PLUS: {
    TRADE_REVIEW: 50,
    WEEKLY_COACH: 20,
    CHAT_SUPPORT: 50,
    EDGE_FINDER: 10,
    TRADING_PLAN: 5,
    SCREENSHOT_REVIEW: 20,
    JOURNAL_ASSISTANT: 100,
    PSYCHOLOGY_INSIGHTS: 10,
    DAILY_REVIEW: 31,
    AI_TRADE_CAPTURE: Infinity,
  },
  PRO_SYNC: {
    TRADE_REVIEW: 50,
    WEEKLY_COACH: 20,
    CHAT_SUPPORT: 50,
    EDGE_FINDER: 10,
    TRADING_PLAN: 5,
    SCREENSHOT_REVIEW: 20,
    JOURNAL_ASSISTANT: 100,
    PSYCHOLOGY_INSIGHTS: 10,
    DAILY_REVIEW: 31,
    AI_TRADE_CAPTURE: Infinity,
  },
  ELITE: {
    TRADE_REVIEW: 100,
    WEEKLY_COACH: 50,
    CHAT_SUPPORT: 100,
    EDGE_FINDER: 25,
    TRADING_PLAN: 20,
    SCREENSHOT_REVIEW: 50,
    JOURNAL_ASSISTANT: 200,
    PSYCHOLOGY_INSIGHTS: 30,
    DAILY_REVIEW: 31,
    AI_TRADE_CAPTURE: Infinity,
  },
  MENTOR: {
    TRADE_REVIEW: Infinity,
    WEEKLY_COACH: Infinity,
    CHAT_SUPPORT: Infinity,
    EDGE_FINDER: Infinity,
    TRADING_PLAN: Infinity,
    SCREENSHOT_REVIEW: Infinity,
    JOURNAL_ASSISTANT: Infinity,
    PSYCHOLOGY_INSIGHTS: Infinity,
    DAILY_REVIEW: Infinity,
    MENTOR_SUMMARY: Infinity,
    AI_TRADE_CAPTURE: 300,
  },
};

/**
 * Returns UTC start of the current month (or for the given reference date)
 */
const getStartOfUtcMonth = (date = new Date()) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
};

/**
 * Resolves user object ensuring role, subscriptionPlan, and subscriptionStatus are present
 */
const resolveUser = async (userIdOrUser, txOrPrisma = prisma) => {
  if (userIdOrUser && typeof userIdOrUser === 'object' && userIdOrUser.id && (userIdOrUser.subscriptionPlan !== undefined || userIdOrUser.role)) {
    return userIdOrUser;
  }
  const userId = typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser?.id;
  if (!userId) return null;

  return txOrPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      mentorTrialExpiresAt: true,
      mentorTier: true,
    },
  });
};

/**
 * Evaluates whether a user can create the requested number of trades in the current UTC month
 */
const canCreateTrades = async (userIdOrUser, countToAdd = 1, txOrPrisma = prisma) => {
  const user = await resolveUser(userIdOrUser, txOrPrisma);
  const userPlanKey = getEffectivePlanKey(user);
  const planConfig = getPlanConfig(userPlanKey);

  if (planConfig.tradeLimit === Infinity) {
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      remaining: Infinity,
      plan: userPlanKey,
    };
  }

  const userId = user?.id || (typeof userIdOrUser === 'string' ? userIdOrUser : (userIdOrUser?.id || null));
  if (!userId) {
    return {
      allowed: true,
      current: 0,
      limit: planConfig.tradeLimit,
      remaining: planConfig.tradeLimit,
      plan: userPlanKey,
    };
  }

  const startOfMonth = getStartOfUtcMonth();

  const currentCount = await txOrPrisma.trade.count({
    where: {
      tradingAccount: { userId },
      createdAt: { gte: startOfMonth },
    },
  });

  const remaining = Math.max(0, planConfig.tradeLimit - currentCount);

  if (currentCount + countToAdd > planConfig.tradeLimit) {
    const requiredPlan = userPlanKey === 'FREE' ? 'STARTER' : 'PRO';
    return {
      allowed: false,
      current: currentCount,
      limit: planConfig.tradeLimit,
      remaining,
      plan: userPlanKey,
      requiredPlan,
      payload: buildLimitReachedPayload({
        feature: 'trades',
        current: currentCount,
        limit: planConfig.tradeLimit,
        userPlan: userPlanKey,
        requiredPlan,
        customMessage: countToAdd > 1
          ? `You have ${remaining} trade${remaining === 1 ? '' : 's'} remaining this month on your ${userPlanKey} plan, but this operation requires ${countToAdd}. Upgrade to ${requiredPlan} to continue.`
          : undefined,
      }),
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: planConfig.tradeLimit,
    remaining: planConfig.tradeLimit - (currentCount + countToAdd),
    plan: userPlanKey,
  };
};

/**
 * Evaluates whether a user can create an additional trading account
 */
const canCreateAccount = async (userIdOrUser, txOrPrisma = prisma) => {
  const user = await resolveUser(userIdOrUser, txOrPrisma);
  const userPlanKey = getEffectivePlanKey(user);
  const planConfig = getPlanConfig(userPlanKey);

  if (planConfig.accountLimit === Infinity) {
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      plan: userPlanKey,
    };
  }

  const userId = user?.id || (typeof userIdOrUser === 'string' ? userIdOrUser : (userIdOrUser?.id || null));
  if (!userId) {
    return {
      allowed: true,
      current: 0,
      limit: planConfig.accountLimit,
      plan: userPlanKey,
    };
  }

  const accountCount = await txOrPrisma.tradingAccount.count({
    where: {
      userId,
    },
  });

  if (accountCount >= planConfig.accountLimit) {
    const requiredPlan = userPlanKey === 'FREE' ? 'STARTER' : 'PRO';
    return {
      allowed: false,
      current: accountCount,
      limit: planConfig.accountLimit,
      plan: userPlanKey,
      requiredPlan,
      payload: buildLimitReachedPayload({
        feature: 'accounts',
        current: accountCount,
        limit: planConfig.accountLimit,
        userPlan: userPlanKey,
        requiredPlan,
      }),
    };
  }

  return {
    allowed: true,
    current: accountCount,
    limit: planConfig.accountLimit,
    plan: userPlanKey,
  };
};

/**
 * Evaluates whether a user can connect an additional automated MT4/MT5 cloud sync account
 */
const canConnectCloudSyncAccount = async (userIdOrUser, txOrPrisma = prisma) => {
  const user = await resolveUser(userIdOrUser, txOrPrisma);
  const userPlanKey = getEffectivePlanKey(user);
  const planConfig = getPlanConfig(user || userPlanKey);

  // Super admin / admin bypass
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return { allowed: true, current: 0, limit: Infinity, plan: userPlanKey };
  }

  // Feature gate: mt5Sync must be enabled
  if (!hasFeatureAccess(user, 'mt5Sync')) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      plan: userPlanKey,
      requiredPlan: 'STARTER_SYNC',
      payload: buildLimitReachedPayload({
        feature: 'mt5_sync',
        current: 0,
        limit: 0,
        userPlan: userPlanKey,
        requiredPlan: 'STARTER_SYNC',
        customMessage: 'MetaTrader (MT4/MT5) Cloud Sync requires a Starter Sync, Pro Sync, or Mega Academy plan. Upgrade to unlock automated cloud sync.'
      })
    };
  }

  const limit = planConfig.cloudSyncAccountLimit || (userPlanKey === 'STARTER_SYNC' || userPlanKey === 'SYNC_PLUS' ? 2 : 5);
  const userId = user?.id;
  if (!userId) {
    return { allowed: false, current: 0, limit, plan: userPlanKey };
  }

  const currentSyncedCount = await txOrPrisma.tradingAccount.count({
    where: {
      userId,
      cloudSyncEnabled: true,
    },
  });

  if (currentSyncedCount >= limit) {
    const isStarterSync = userPlanKey === 'STARTER_SYNC' || userPlanKey === 'SYNC_PLUS';
    const requiredPlan = isStarterSync ? 'PRO_SYNC' : 'PRO_SYNC';
    return {
      allowed: false,
      current: currentSyncedCount,
      limit,
      plan: userPlanKey,
      requiredPlan,
      payload: buildLimitReachedPayload({
        feature: 'mt5_sync',
        current: currentSyncedCount,
        limit,
        userPlan: userPlanKey,
        requiredPlan,
        customMessage: `You have reached your ${planConfig.name} limit of ${limit} active synced MetaTrader accounts. ${isStarterSync ? 'Upgrade to Pro Sync to connect up to 5 accounts.' : 'Please disconnect an existing synced account to connect a new one.'}`
      })
    };
  }

  return {
    allowed: true,
    current: currentSyncedCount,
    limit,
    plan: userPlanKey,
  };
};

/**
 * Evaluates whether a screenshot can be attached to a specific trade based on user's plan limit
 */
const canAttachScreenshot = async (tradeId, userIdOrUser, countToAdd = 1, txOrPrisma = prisma) => {
  const user = await resolveUser(userIdOrUser, txOrPrisma);
  const userPlanKey = getEffectivePlanKey(user);
  const planConfig = getPlanConfig(userPlanKey);

  if (planConfig.screenshotLimit === Infinity) {
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      plan: userPlanKey,
    };
  }

  const currentCount = await txOrPrisma.tradeScreenshot.count({
    where: { tradeId },
  });

  if (currentCount + countToAdd > planConfig.screenshotLimit) {
    const requiredPlan = userPlanKey === 'FREE' ? 'STARTER' : 'PRO';
    return {
      allowed: false,
      current: currentCount,
      limit: planConfig.screenshotLimit,
      plan: userPlanKey,
      requiredPlan,
      payload: buildLimitReachedPayload({
        feature: 'screenshots',
        current: currentCount,
        limit: planConfig.screenshotLimit,
        userPlan: userPlanKey,
        requiredPlan,
      }),
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: planConfig.screenshotLimit,
    plan: userPlanKey,
  };
};

/**
 * Authoritative check for AI feature quotas and user settings
 */
const checkAiAllowance = async (userIdOrUser, featureType, txOrPrisma = prisma) => {
  const user = await resolveUser(userIdOrUser, txOrPrisma);
  const plan = getEffectivePlanKey(user);
  const userId = user?.id || (typeof userIdOrUser === 'string' ? userIdOrUser : (userIdOrUser?.id || null));
  if (!userId) {
    return { allowed: true, current: 0, limit: Infinity, plan };
  }

  const userSettings = await txOrPrisma.userSettings.findUnique({
    where: { userId },
  });

  if (userSettings && userSettings.enableJahzAi === false) {
    return {
      allowed: false,
      payload: {
        error: 'AI_DISABLED_IN_SETTINGS',
        message: 'JAHZ AI is disabled in your settings.',
      },
    };
  }

  if (['TRADE_REVIEW', 'EDGE_FINDER', 'WEEKLY_COACH', 'DAILY_REVIEW'].includes(featureType)) {
    if (userSettings && userSettings.allowTradeDataAnalysis === false) {
      return {
        allowed: false,
        payload: {
          error: 'TRADE_ANALYSIS_DISABLED',
          message: 'Trade data analysis is disabled in your privacy settings.',
        },
      };
    }
  }

  if (featureType === 'SCREENSHOT_REVIEW') {
    const isAllowed = userSettings
      ? (userSettings.allowScreenshotAnalysis === true || userSettings.includeScreenshots === true)
      : true;
    if (!isAllowed) {
      return {
        allowed: false,
        payload: {
          error: 'SCREENSHOT_ANALYSIS_DISABLED',
          message: 'Screenshot analysis is disabled in your privacy settings. Enable "Include screenshots" or "Allow screenshot analysis" in Settings to use this feature.',
        },
      };
    }
  }

  const startOfMonth = getStartOfUtcMonth();

  // FREE TIER: Shared pool of 2 requests across allowed features (TRADE_REVIEW, CHAT_SUPPORT)
  if (plan === 'FREE') {
    if (AI_FEATURE_LIMITS.FREE.allowedFeatures.includes(featureType)) {
      const limit = AI_FEATURE_LIMITS.FREE.SHARED_TRIAL;
      const usageCount = await txOrPrisma.aiRequest.count({
        where: {
          userId,
          featureType: { in: AI_FEATURE_LIMITS.FREE.allowedFeatures },
          status: { notIn: ['FAILED', 'CANCELLED'] },
          createdAt: { gte: startOfMonth },
        },
      });

      if (usageCount >= limit) {
        return {
          allowed: false,
          payload: buildLimitReachedPayload({
            feature: 'ai',
            current: usageCount,
            limit,
            userPlan: 'FREE',
            requiredPlan: 'STARTER',
            customMessage: `You've used your Free trial limit of ${limit} AI requests this month. Upgrade to Starter or Pro to continue receiving AI feedback and insights.`,
          }),
        };
      }
      return { allowed: true, current: usageCount, limit, plan: 'FREE' };
    }

    // Attempting a feature not available on Free tier
    const isStarterSupported = Boolean(AI_FEATURE_LIMITS.STARTER[featureType]);
    return {
      allowed: false,
      payload: buildLimitReachedPayload({
        feature: featureType === 'AI_TRADE_CAPTURE'
          ? 'ai_trade_capture'
          : (featureType === 'WEEKLY_COACH' ? 'weekly_coach' : 'ai'),
        current: 0,
        limit: 0,
        userPlan: 'FREE',
        requiredPlan: isStarterSupported ? 'STARTER' : 'PRO',
      }),
    };
  }

  // STARTER, PRO, MENTOR, ADMIN
  const planLimits = AI_FEATURE_LIMITS[plan] || {};
  let limit = planLimits[featureType];

  // Mentors: Mega Academy coaches receive unlimited AI trade captures; Private Cohort & Growth get 300/mo
  if (plan === 'MENTOR' && featureType === 'AI_TRADE_CAPTURE') {
    const isMega = user?.mentorTier === 'MEGA';
    limit = isMega ? Infinity : (planLimits[featureType] || 300);
  }

  if (limit === undefined) {
    return {
      allowed: false,
      payload: buildLimitReachedPayload({
        feature: featureType === 'AI_TRADE_CAPTURE' ? 'ai_trade_capture' : 'ai',
        current: 0,
        limit: 0,
        userPlan: plan,
        requiredPlan: 'PRO',
      }),
    };
  }

  if (limit === Infinity) {
    return { allowed: true, current: 0, limit: Infinity, plan };
  }

  // Specific handler for AI_TRADE_CAPTURE: counts trades logged via AI in current month
  if (featureType === 'AI_TRADE_CAPTURE') {
    const usageCount = await txOrPrisma.trade.count({
      where: {
        tradingAccount: { userId },
        classificationSource: 'AI_SUGGESTION',
        createdAt: { gte: startOfMonth },
      },
    });

    if (usageCount >= limit) {
      const reqPlan = plan === 'MENTOR' ? 'MEGA' : 'PRO_SYNC';
      return {
        allowed: false,
        current: usageCount,
        limit,
        plan,
        payload: buildLimitReachedPayload({
          feature: 'ai_trade_capture',
          current: usageCount,
          limit,
          userPlan: plan,
          requiredPlan: reqPlan,
          customMessage: plan === 'MENTOR'
            ? `You've reached your ${user?.mentorTier === 'GROWTH' ? 'Growth Community' : 'Private Cohort'} plan limit of ${limit} AI trade captures this month. Upgrade to Mega Academy for unlimited AI trade logging.`
            : undefined,
        }),
      };
    }

    return { allowed: true, current: usageCount, limit, remaining: limit - usageCount, plan };
  }

  const usageCount = await txOrPrisma.aiRequest.count({
    where: {
      userId,
      featureType,
      status: { notIn: ['FAILED', 'CANCELLED'] },
      createdAt: { gte: startOfMonth },
    },
  });

  if (usageCount >= limit) {
    return {
      allowed: false,
      payload: buildLimitReachedPayload({
        feature: 'ai',
        current: usageCount,
        limit,
        userPlan: plan,
        requiredPlan: plan === 'STARTER' ? 'PRO' : 'MENTOR',
      }),
    };
  }

  return { allowed: true, current: usageCount, limit, plan };
};

/**
 * Checks whether user has access to a specific feature flag (e.g. emotionTracking, propFirmAccess, etc.)
 */
const hasFeatureAccess = (userOrPlanKey, featureKey) => {
  const planConfig = getPlanConfig(userOrPlanKey);
  const planKey = typeof userOrPlanKey === 'string' ? userOrPlanKey : getEffectivePlanKey(userOrPlanKey);

  // Admins always have access
  if (typeof userOrPlanKey === 'object' && (userOrPlanKey?.role === 'ADMIN' || userOrPlanKey?.role === 'SUPER_ADMIN')) {
    return true;
  }

  // Mentor tier check for mt5Sync: only MEGA tier mentors have MT4/MT5 Cloud Sync
  if (featureKey === 'mt5Sync') {
    if (planKey === 'MENTOR') {
      if (typeof userOrPlanKey === 'object' && userOrPlanKey !== null) {
        return userOrPlanKey.mentorTier === 'MEGA';
      }
      return false;
    }
  }

  return Boolean(planConfig[featureKey]);
};

/**
 * Resolves full quota summary for dashboard or usage indicators
 */
const getQuotaSummary = async (userIdOrUser, txOrPrisma = prisma) => {
  const user = await resolveUser(userIdOrUser, txOrPrisma);
  const planKey = getEffectivePlanKey(user);
  const planConfig = getPlanConfig(user || planKey);
  const userId = user?.id;

  if (!userId) {
    return {
      plan: planKey,
      planName: planConfig.name,
      trades: { current: 0, limit: planConfig.tradeLimit, remaining: planConfig.tradeLimit },
      accounts: { current: 0, limit: planConfig.accountLimit, remaining: planConfig.accountLimit },
      screenshotsPerTradeLimit: planConfig.screenshotLimit,
      features: {},
    };
  }

  const startOfMonth = getStartOfUtcMonth();

  const [tradeCount, activeAccountCount] = await Promise.all([
    txOrPrisma.trade.count({
      where: {
        tradingAccount: { userId },
        createdAt: { gte: startOfMonth },
      },
    }),
    txOrPrisma.tradingAccount.count({
      where: {
        userId,
      },
    }),
  ]);

  return {
    plan: planKey,
    planName: planConfig.name,
    trades: {
      current: tradeCount,
      limit: planConfig.tradeLimit,
      remaining: planConfig.tradeLimit === Infinity ? Infinity : Math.max(0, planConfig.tradeLimit - tradeCount),
    },
    accounts: {
      current: activeAccountCount,
      limit: planConfig.accountLimit,
      remaining: planConfig.accountLimit === Infinity ? Infinity : Math.max(0, planConfig.accountLimit - activeAccountCount),
    },
    screenshotsPerTradeLimit: planConfig.screenshotLimit,
    features: {
      mt5Sync: Boolean(planConfig.mt5Sync),
      emotionTracking: Boolean(planConfig.emotionTracking),
      ruleViolations: Boolean(planConfig.ruleViolations),
      propFirmAccess: Boolean(planConfig.propFirmAccess),
      reportsAccess: Boolean(planConfig.reportsAccess),
      mentorAccess: Boolean(planConfig.mentorAccess),
      aiTradeCapture: Boolean(planConfig.aiTradeCapture),
    },
  };
};

module.exports = {
  AI_FEATURE_LIMITS,
  getStartOfUtcMonth,
  resolveUser,
  canCreateTrades,
  canCreateAccount,
  canConnectCloudSyncAccount,
  canAttachScreenshot,
  checkAiAllowance,
  hasFeatureAccess,
  getQuotaSummary,
};
