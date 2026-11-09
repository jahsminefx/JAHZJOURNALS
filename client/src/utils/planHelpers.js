/**
 * Canonical Subscription Plan & Entitlement Helpers (Client)
 * Keeps UI gates in sync with server-side entitlement engine.
 */

export const PLANS = {
  FREE: {
    key: 'FREE',
    name: 'Free',
    priceNgn: 0,
    priceFormatted: '₦0 / month',
    tradeLimit: 20,
    accountLimit: 1,
    screenshotLimit: 1,
    analyticsLevel: 'BASIC',
    emotionTracking: false,
    ruleViolations: false,
    propFirmAccess: false,
    aiAccess: false,
    weeklyCoachAccess: false,
    aiTradeCapture: false,
    reportsAccess: false,
    mentorAccess: false,
    mt5Sync: false,
  },
  STARTER: {
    key: 'STARTER',
    name: 'Starter',
    priceNgn: 4000,
    priceFormatted: '₦4,000 / month',
    tradeLimit: 100,
    accountLimit: 3,
    screenshotLimit: 3,
    analyticsLevel: 'DETAILED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: false,
    aiAccess: false,
    weeklyCoachAccess: true,
    aiTradeCapture: false,
    reportsAccess: false,
    mentorAccess: false,
    mt5Sync: false,
  },
  PRO: {
    key: 'PRO',
    name: 'Pro',
    priceNgn: 8500,
    priceFormatted: '₦8,500 / month',
    tradeLimit: Infinity,
    accountLimit: Infinity,
    screenshotLimit: 10,
    analyticsLevel: 'ADVANCED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: true,
    aiAccess: true,
    weeklyCoachAccess: true,
    aiTradeCapture: true,
    reportsAccess: true,
    mentorAccess: false,
    mt5Sync: false,
  },
  STARTER_SYNC: {
    key: 'STARTER_SYNC',
    name: 'Starter Sync',
    priceNgn: 38000,
    priceFormatted: '₦38,000 / month',
    tradeLimit: Infinity,
    accountLimit: Infinity,
    cloudSyncAccountLimit: 2,
    screenshotLimit: 10,
    analyticsLevel: 'ADVANCED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: true,
    aiAccess: true,
    weeklyCoachAccess: true,
    aiTradeCapture: true,
    reportsAccess: true,
    mentorAccess: false,
    mt5Sync: true,
  },
  SYNC_PLUS: {
    key: 'SYNC_PLUS',
    name: 'Starter Sync',
    priceNgn: 38000,
    priceFormatted: '₦38,000 / month',
    tradeLimit: Infinity,
    accountLimit: Infinity,
    cloudSyncAccountLimit: 2,
    screenshotLimit: 10,
    analyticsLevel: 'ADVANCED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: true,
    aiAccess: true,
    weeklyCoachAccess: true,
    aiTradeCapture: true,
    reportsAccess: true,
    mentorAccess: false,
    mt5Sync: true,
  },
  PRO_SYNC: {
    key: 'PRO_SYNC',
    name: 'Pro Sync',
    priceNgn: 72000,
    priceUsd: 48,
    priceFormatted: '₦72,000 / $48 / month',
    tradeLimit: Infinity,
    accountLimit: Infinity,
    cloudSyncAccountLimit: 6,
    screenshotLimit: 10,
    analyticsLevel: 'ADVANCED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: true,
    aiAccess: true,
    weeklyCoachAccess: true,
    aiTradeCapture: true,
    reportsAccess: true,
    mentorAccess: false,
    mt5Sync: true,
  },
  ELITE: {
    key: 'ELITE',
    name: 'Elite',
    priceUsd: 32,
    priceFormatted: '$32 / month',
    tradeLimit: Infinity,
    accountLimit: Infinity,
    screenshotLimit: Infinity,
    analyticsLevel: 'ADVANCED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: true,
    aiAccess: true,
    weeklyCoachAccess: true,
    aiTradeCapture: true,
    reportsAccess: true,
    mentorAccess: false,
    mt5Sync: true,
    priorityCloudSync: true,
    vipSupport: true,
  },
  MENTOR: {
    key: 'MENTOR',
    name: 'Mentor/Academy',
    priceNgn: null,
    priceFormatted: 'Custom Pricing',
    tradeLimit: Infinity,
    accountLimit: Infinity,
    screenshotLimit: Infinity,
    analyticsLevel: 'ADVANCED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: true,
    aiAccess: true,
    weeklyCoachAccess: true,
    aiTradeCapture: true,
    reportsAccess: true,
    mentorAccess: true,
    mt5Sync: true,
  },
};

/**
 * Returns effective plan key based on user role and subscription status.
 */
export const getEffectivePlan = (user) => {
  if (!user) return 'FREE';

  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return 'PRO';
  }

  if (user.role === 'MENTOR') {
    if (user.subscriptionStatus && user.subscriptionStatus !== 'ACTIVE') {
      return 'FREE';
    }
    return 'MENTOR';
  }

  if (user.subscriptionStatus === 'ACTIVE') {
    return (user.subscriptionPlan || 'FREE').toUpperCase();
  }

  return 'FREE';
};

/**
 * Gets plan configuration object for user
 */
export const getPlanConfig = (userOrPlan) => {
  const planKey = typeof userOrPlan === 'string'
    ? userOrPlan.toUpperCase()
    : getEffectivePlan(userOrPlan);

  return PLANS[planKey] || PLANS.FREE;
};

/**
 * Checks if user has access to a specific feature
 */
export const hasFeature = (user, featureKey) => {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

  const plan = getEffectivePlan(user);
  const config = PLANS[plan] || PLANS.FREE;

  return Boolean(config[featureKey]);
};

/**
 * Authoritative check if user can log trades with JAHZ AI.
 * Only PRO tiers (PRO, SYNC_PLUS, PRO_SYNC, ELITE), MENTOR accounts, and Admins can log trades with AI.
 */
export const canLogTradesWithAi = (user) => {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

  if (user.role === 'MENTOR') {
    if (user.subscriptionStatus && user.subscriptionStatus !== 'ACTIVE') {
      return false;
    }
    return true;
  }

  const plan = getEffectivePlan(user);
  const proEquivalentPlans = new Set(['PRO', 'STARTER_SYNC', 'SYNC_PLUS', 'PRO_SYNC', 'ELITE', 'MENTOR']);
  return proEquivalentPlans.has(plan);
};

/**
 * Authoritative check if user has access to Advanced Analytics (Drawdown depth, recovery velocity, etc.)
 * PRO tiers (PRO, SYNC_PLUS, PRO_SYNC, ELITE), MENTOR accounts, and Admins have access.
 */
export const hasAdvancedAnalytics = (user) => {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

  if (user.role === 'MENTOR') {
    if (user.subscriptionStatus && user.subscriptionStatus !== 'ACTIVE') {
      return false;
    }
    return true;
  }

  const plan = getEffectivePlan(user);
  const proEquivalentPlans = new Set(['PRO', 'STARTER_SYNC', 'SYNC_PLUS', 'PRO_SYNC', 'ELITE', 'MENTOR']);
  return proEquivalentPlans.has(plan);
};
