/**
 * Centralized Plan Configuration for JAHZJOURNALS
 * Defines limits, features, prices, and positioning for each subscription tier.
 */

const PLANS = {
  FREE: {
    key: 'FREE',
    name: 'Free',
    priceNgn: 0,
    priceFormatted: '₦0 / month',
    tagline: 'Build the habit.',
    description: 'Designed for beginner traders who want to start journaling and understand their trading performance.',
    tradeLimit: 20, // trades per calendar month
    accountLimit: 1, // active trading accounts
    screenshotLimit: 1, // screenshots per trade
    analyticsLevel: 'BASIC', // BASIC | DETAILED | ADVANCED
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
    tagline: 'Build discipline.',
    description: 'Designed for active traders who want to understand their emotions, mistakes, and execution patterns.',
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
    tagline: 'Find your edge.',
    description: 'The flagship individual trader plan with AI reviews, prop-firm tracking, and advanced analytics.',
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
    cloudSyncAccountLimit: 0,
  },
  STARTER_SYNC: {
    key: 'STARTER_SYNC',
    name: 'Starter Sync',
    priceNgn: 38000,
    priceFormatted: '₦38,000 / month',
    tagline: 'Automate your core accounts.',
    description: 'Full Pro features plus automated MetaTrader 4/5 Cloud Sync for up to 2 active trading accounts.',
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
    tagline: 'Automate your core accounts.',
    description: 'Full Pro features plus automated MetaTrader 4/5 Cloud Sync for up to 2 active trading accounts.',
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
    priceFormatted: '₦72,000 / month',
    tagline: 'Automate your journal with power.',
    description: 'Everything in Pro plus automated MetaTrader 4/5 Cloud Sync for up to 6 trading accounts with priority processing.',
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
  MENTOR: {
    key: 'MENTOR',
    name: 'Mentor/Academy',
    priceNgn: null,
    priceFormatted: 'Custom Pricing',
    tagline: 'Build better traders.',
    description: 'Designed for mentors, trading coaches, and academies managing student progress.',
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
    mt5Sync: false,
  },
};

const MENTOR_TIERS = {
  PRIVATE_COHORT: {
    key: 'PRIVATE_COHORT',
    name: 'Private Cohort',
    priceNgn: 14500,
    priceFormatted: '₦14,500 / month',
    maxStudents: 80,
    maxCohorts: 2,
    studentRange: 'Up to 80 Students',
    tagline: 'Ideal for private masterminds & small coaching cohorts',
    features: [
      'Up to 80 active student trading journals',
      '2 private trading cohorts with invite links',
      'Strategy Risk Guard rules (e.g. 1% max risk)',
      'Direct trade comments & feedback grading',
      'Full Pro trading features for the mentor (300 AI captures/mo)',
    ],
    mt5Sync: false,
  },
  GROWTH: {
    key: 'GROWTH',
    name: 'Growth Community',
    priceNgn: 25000,
    priceFormatted: '₦25,000 / month',
    maxStudents: 200,
    maxCohorts: 5,
    studentRange: 'Up to 200 Students',
    tagline: 'Most popular for active trading coaches & communities',
    features: [
      'Up to 200 active student trading journals',
      '5 private trading cohorts',
      'Everything in Private Cohort',
      'Automated cohort risk adherence & violation reports',
      'Review assignments and student submissions',
      'Paid student cohort checkouts (1.5% platform fee)',
      'Custom academy branding',
    ],
    mt5Sync: false,
  },
  MEGA: {
    key: 'MEGA',
    name: 'Mega Academy',
    priceNgn: 85000,
    priceFormatted: '₦85,000 / month',
    maxStudents: 1000,
    maxCohorts: Infinity,
    studentRange: 'Up to 1,000 Students',
    tagline: 'Flat rate for large communities & institutional academies',
    features: [
      'Up to 1,000 active student trading journals',
      'Unlimited trading cohorts',
      'Everything in Growth Community',
      'MetaTrader 4/5 Cloud Sync included for coach',
      'Unlimited JAHZ AI Trade Captures',
      'Bulk student invite links & CSV data exports',
      'Aggregated academy risk & performance analytics',
      'Priority mentor onboarding & dedicated VIP support',
    ],
    mt5Sync: true,
  },
};

const getMentorTierConfig = (tierKey = 'PRIVATE_COHORT') => {
  return MENTOR_TIERS[tierKey] || MENTOR_TIERS.PRIVATE_COHORT;
};

/**
 * Returns effective plan details for a user based on user object and subscription status.
 * Takes launch mode / promotion into account.
 */
const getEffectivePlanKey = (user) => {
  if (!user) return 'FREE';
  
  // Super admins or admins always get full PRO/MENTOR privileges
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return 'PRO';
  }

  // If user has MENTOR role, check if subscription is explicitly expired or inactive
  if (user.role === 'MENTOR') {
    if (user.subscriptionStatus && user.subscriptionStatus !== 'ACTIVE') {
      return 'FREE';
    }
    return 'MENTOR';
  }

  // If user subscription is active, use user's subscriptionPlan
  if (user.subscriptionStatus === 'ACTIVE') {
    return user.subscriptionPlan || 'FREE';
  }

  // Fallback to FREE
  return 'FREE';
};

const getPlanConfig = (userOrPlanKey) => {
  const planKey = typeof userOrPlanKey === 'string'
    ? userOrPlanKey
    : getEffectivePlanKey(userOrPlanKey);
    
  const baseConfig = PLANS[planKey] || PLANS.FREE;

  // For MENTOR, only MEGA tier receives MT4/MT5 Cloud Sync
  if (planKey === 'MENTOR' && typeof userOrPlanKey === 'object' && userOrPlanKey !== null) {
    const isMega = userOrPlanKey.mentorTier === 'MEGA';
    return {
      ...baseConfig,
      mt5Sync: isMega,
    };
  }

  return baseConfig;
};

/**
 * Helper to build standard PLAN_LIMIT_REACHED response payload
 */
const buildLimitReachedPayload = ({ feature, current, limit, userPlan, requiredPlan, customMessage }) => {
  const planNames = {
    FREE: 'Free',
    STARTER: 'Starter',
    PRO: 'Pro',
    STARTER_SYNC: 'Starter Sync',
    SYNC_PLUS: 'Starter Sync',
    PRO_SYNC: 'Pro Sync',
    MENTOR: 'Mentor/Academy'
  };
  const reqPlanName = planNames[requiredPlan] || requiredPlan;
  
  let message = customMessage;
  if (!message) {
    if (feature === 'trades') {
      message = `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} trades this month. Upgrade to ${reqPlanName} to continue journaling without interruption.`;
    } else if (feature === 'accounts') {
      message = `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} trading ${limit === 1 ? 'account' : 'accounts'}. Upgrade to ${reqPlanName} to connect more accounts.`;
    } else if (feature === 'screenshots') {
      message = `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} screenshots per trade. Upgrade to ${reqPlanName} to attach more chart images.`;
    } else if (feature === 'ai_trade_capture') {
      message = (limit && limit > 0)
        ? `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} AI trade captures this month. Upgrade to Starter Sync or Pro Sync for unlimited AI trade logging or wait for your quota to reset on the 1st of next month.`
        : `Logging trades with JAHZ AI is reserved for Pro, Starter Sync, Pro Sync, and Mentor plans. Upgrade to Pro to capture trades via AI chat and screenshots.`;
    } else if (feature === 'weekly_coach') {
      message = (limit && limit > 0)
        ? `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} Weekly AI Coach summaries this month. Upgrade to ${reqPlanName} for expanded capacity.`
        : `Weekly AI Coaching Summaries are available starting on the Starter plan. Upgrade to Starter, Pro, or Sync tiers to unlock Weekly AI Coach.`;
    } else if (feature === 'ai') {
      message = `AI Trade Review and AI Coach features require a Starter, Pro, or Sync subscription. Upgrade to unlock AI insights.`;
    } else if (feature === 'prop_firm') {
      message = `Prop firm challenge tracking requires a Pro, Starter Sync, or Pro Sync subscription. Upgrade to track your evaluation rules.`;
    } else if (feature === 'pdf_reports') {
      message = `Exporting PDF performance reports requires a Pro, Starter Sync, or Pro Sync subscription. Upgrade to generate reports.`;
    } else if (feature === 'mentor') {
      message = `Mentor and student management features require a Mentor/Academy plan.`;
    } else if (feature === 'mt5_sync') {
      message = (limit && limit > 0)
        ? `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} active synced MetaTrader accounts. Upgrade to Pro Sync to connect up to 6 accounts.`
        : `MetaTrader (MT4/MT5) Cloud Sync is available on Starter Sync, Pro Sync, and Mega Academy plans. Upgrade to an automated sync tier to automatically sync your MT4/MT5 broker accounts.`;
    } else {
      message = `Feature unavailable on your current plan. Upgrade to ${reqPlanName} to unlock.`;
    }
  }

  return {
    error: 'PLAN_LIMIT_REACHED',
    feature,
    current,
    limit,
    plan: userPlan,
    requiredPlan,
    message
  };
};

module.exports = {
  PLANS,
  MENTOR_TIERS,
  getMentorTierConfig,
  getEffectivePlanKey,
  getPlanConfig,
  buildLimitReachedPayload,
};
