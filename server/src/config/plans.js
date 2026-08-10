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
    tradeLimit: 50, // trades per calendar month
    accountLimit: 1, // active trading accounts
    screenshotLimit: 2, // screenshots per trade
    analyticsLevel: 'BASIC', // BASIC | DETAILED | ADVANCED
    emotionTracking: false,
    ruleViolations: false,
    propFirmAccess: false,
    aiAccess: false,
    reportsAccess: false,
    mentorAccess: false,
  },
  STARTER: {
    key: 'STARTER',
    name: 'Starter',
    priceNgn: 3000,
    priceFormatted: '₦3,000 / month',
    tagline: 'Build discipline.',
    description: 'Designed for active traders who want to understand their emotions, mistakes, and execution patterns.',
    tradeLimit: 300,
    accountLimit: 3,
    screenshotLimit: 6,
    analyticsLevel: 'DETAILED',
    emotionTracking: true,
    ruleViolations: true,
    propFirmAccess: false,
    aiAccess: false,
    reportsAccess: false,
    mentorAccess: false,
  },
  PRO: {
    key: 'PRO',
    name: 'Pro',
    priceNgn: 8000,
    priceFormatted: '₦8,000 / month',
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
    reportsAccess: true,
    mentorAccess: false,
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
    reportsAccess: true,
    mentorAccess: true,
  },
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
  if (user.role === 'MENTOR') {
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
    
  return PLANS[planKey] || PLANS.FREE;
};

/**
 * Helper to build standard PLAN_LIMIT_REACHED response payload
 */
const buildLimitReachedPayload = ({ feature, current, limit, userPlan, requiredPlan, customMessage }) => {
  const planNames = { FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', MENTOR: 'Mentor/Academy' };
  const reqPlanName = planNames[requiredPlan] || requiredPlan;
  
  let message = customMessage;
  if (!message) {
    if (feature === 'trades') {
      message = `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} trades this month. Upgrade to ${reqPlanName} to continue journaling without interruption.`;
    } else if (feature === 'accounts') {
      message = `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} trading ${limit === 1 ? 'account' : 'accounts'}. Upgrade to ${reqPlanName} to connect more accounts.`;
    } else if (feature === 'screenshots') {
      message = `You've reached your ${planNames[userPlan] || userPlan} plan limit of ${limit} screenshots per trade. Upgrade to ${reqPlanName} to attach more chart images.`;
    } else if (feature === 'ai') {
      message = `AI Trade Review and AI Coach features require a Pro subscription. Upgrade to Pro to unlock AI insights.`;
    } else if (feature === 'prop_firm') {
      message = `Prop firm challenge tracking requires a Pro subscription. Upgrade to Pro to track your evaluation rules.`;
    } else if (feature === 'pdf_reports') {
      message = `Exporting PDF performance reports requires a Pro subscription. Upgrade to Pro to generate reports.`;
    } else if (feature === 'mentor') {
      message = `Mentor and student management features require a Mentor/Academy plan.`;
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
  getEffectivePlanKey,
  getPlanConfig,
  buildLimitReachedPayload,
};
