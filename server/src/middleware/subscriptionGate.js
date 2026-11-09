const {
  canCreateTrades,
  canCreateAccount,
  canAttachScreenshot,
  hasFeatureAccess,
} = require('../services/entitlementService');
const {
  getPlanConfig,
  getEffectivePlanKey,
  buildLimitReachedPayload,
} = require('../config/plans');

/**
 * Middleware to check monthly trade creation limits for a user
 */
const checkTradeLimit = async (req, res, next) => {
  try {
    const result = await canCreateTrades(req.user, 1);
    if (!result.allowed) {
      return res.status(403).json(result.payload);
    }
    next();
  } catch (error) {
    console.error('Subscription Check Trade Limit Error:', error);
    next(error);
  }
};

/**
 * Middleware to check trading account creation limits for a user
 */
const checkAccountLimit = async (req, res, next) => {
  try {
    const result = await canCreateAccount(req.user);
    if (!result.allowed) {
      return res.status(403).json(result.payload);
    }
    next();
  } catch (error) {
    console.error('Subscription Check Account Limit Error:', error);
    next(error);
  }
};

/**
 * Middleware to check screenshot attachment limits per trade
 */
const checkScreenshotLimit = async (req, res, next) => {
  try {
    const { tradeId } = req.params;
    if (!tradeId) return next();

    const result = await canAttachScreenshot(tradeId, req.user, 1);
    if (!result.allowed) {
      return res.status(403).json(result.payload);
    }
    next();
  } catch (error) {
    console.error('Subscription Check Screenshot Limit Error:', error);
    next(error);
  }
};

/**
 * Generic middleware to enforce any feature flag (e.g. emotionTracking, ruleViolations, etc.)
 */
const requireFeature = (featureKey, requiredPlan = 'STARTER', customMessage) => async (req, res, next) => {
  try {
    if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN') {
      return next();
    }

    const userPlanKey = getEffectivePlanKey(req.user);
    const isAllowed = hasFeatureAccess(req.user, featureKey);

    if (isAllowed) {
      return next();
    }

    return res.status(403).json(buildLimitReachedPayload({
      feature: featureKey,
      current: 0,
      limit: 0,
      userPlan: userPlanKey,
      requiredPlan,
      customMessage,
    }));
  } catch (error) {
    console.error(`Subscription Feature Gate Error (${featureKey}):`, error);
    next(error);
  }
};

/**
 * Higher-order middleware to enforce feature access requiring PRO or MENTOR plans
 */
const requireProFeature = (featureName = 'feature', customMessage) => async (req, res, next) => {
  try {
    const userPlanKey = getEffectivePlanKey(req.user);

    const proEquivalentPlans = new Set(['PRO', 'PRO_SYNC', 'MENTOR']);
    if (proEquivalentPlans.has(userPlanKey) || req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    return res.status(403).json(buildLimitReachedPayload({
      feature: featureName,
      current: 0,
      limit: 0,
      userPlan: userPlanKey,
      requiredPlan: 'PRO',
      customMessage,
    }));
  } catch (error) {
    console.error(`Subscription Gate Error (${featureName}):`, error);
    next(error);
  }
};

/**
 * Middleware to enforce MENTOR/ACADEMY plan access
 */
const requireMentorPlan = async (req, res, next) => {
  try {
    const userPlanKey = getEffectivePlanKey(req.user);
    const isPlatformAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (isPlatformAdmin) {
      return next();
    }

    const isExplicitlyExpired = req.user.subscriptionStatus && req.user.subscriptionStatus !== 'ACTIVE';
    if (isExplicitlyExpired) {
      return res.status(403).json(buildLimitReachedPayload({
        feature: 'mentor',
        current: 0,
        limit: 0,
        userPlan: userPlanKey,
        requiredPlan: 'MENTOR',
        customMessage: 'Your Mentor/Academy subscription has expired or is inactive. Please renew your plan to manage cohorts and review student journals.',
      }));
    }

    // Check if user is on a mentor trial that has exceeded the 12-hour grace period
    if (req.user.mentorTrialExpiresAt) {
      const now = new Date();
      const trialExpiresAt = new Date(req.user.mentorTrialExpiresAt);
      const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000;
      const graceCutoff = new Date(trialExpiresAt.getTime() + GRACE_PERIOD_MS);

      if (now > graceCutoff) {
        return res.status(403).json(buildLimitReachedPayload({
          feature: 'mentor',
          current: 0,
          limit: 0,
          userPlan: userPlanKey,
          requiredPlan: 'MENTOR',
          code: 'TRIAL_GRACE_EXPIRED',
          customMessage: 'Your 14-day Mentor Free Trial and 12-hour grace period have ended. Please choose a plan to continue managing cohorts and students.',
        }));
      }
    }

    if (userPlanKey === 'MENTOR' || req.user.role === 'MENTOR' || req.user.subscriptionPlan === 'MENTOR') {
      return next();
    }

    return res.status(403).json(buildLimitReachedPayload({
      feature: 'mentor',
      current: 0,
      limit: 0,
      userPlan: userPlanKey,
      requiredPlan: 'MENTOR',
      customMessage: 'Mentor and student management features require an active Mentor/Academy plan.',
    }));
  } catch (error) {
    console.error('Subscription Gate Error (mentor):', error);
    next(error);
  }
};

/**
 * Middleware to enforce MT4/MT5 Cloud Sync access (Sync Plus, Pro Sync, Elite, Mega Academy, Admin)
 */
const checkMt5SyncAllowed = async (req, res, next) => {
  try {
    const userPlanKey = getEffectivePlanKey(req.user);
    const planConfig = getPlanConfig(req.user || userPlanKey);

    // Platform admins always have access
    if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN') {
      return next();
    }

    const isMentor = req.user?.role === 'MENTOR' || userPlanKey === 'MENTOR';

    if (isMentor) {
      if (req.user?.mentorTier === 'MEGA' || req.user?.mentorTier === 'MEGA_PRO_SYNC' || planConfig.mt5Sync) {
        return next();
      }

      return res.status(403).json(buildLimitReachedPayload({
        feature: 'mt5_sync',
        current: 0,
        limit: 0,
        userPlan: userPlanKey,
        requiredPlan: 'MEGA',
        customMessage: 'MetaTrader (MT4/MT5) Cloud Sync is exclusive to the Mega Academy plan. Upgrade your academy tier to unlock automated broker sync for your account.',
      }));
    }

    const syncAllowedPlans = new Set(['PRO_SYNC', 'STARTER_SYNC', 'SYNC_PLUS']);

    if (planConfig.mt5Sync || syncAllowedPlans.has(userPlanKey)) {
      return next();
    }

    const requiredPlan = 'PRO_SYNC';

    return res.status(403).json(buildLimitReachedPayload({
      feature: 'mt5_sync',
      current: 0,
      limit: 0,
      userPlan: userPlanKey,
      requiredPlan,
      customMessage: 'MetaTrader (MT4/MT5) Cloud Sync requires an active Pro Sync subscription. Upgrade to Pro Sync to connect your broker accounts.',
    }));
  } catch (error) {
    console.error('Subscription Check MT5 Sync Error:', error);
    next(error);
  }
};

module.exports = {
  checkTradeLimit,
  checkAccountLimit,
  checkScreenshotLimit,
  requireFeature,
  requireProFeature,
  requireMentorPlan,
  checkMt5SyncAllowed,
};
