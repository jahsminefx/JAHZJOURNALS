const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getPlanConfig, getEffectivePlanKey, buildLimitReachedPayload } = require('../config/plans');

/**
 * Middleware to check monthly trade creation limits for a user
 */
const checkTradeLimit = async (req, res, next) => {
  try {
    const userPlanKey = getEffectivePlanKey(req.user);
    const planConfig = getPlanConfig(userPlanKey);

    if (planConfig.tradeLimit === Infinity) {
      return next();
    }

    // Count trades created by user in current calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const tradeCount = await prisma.trade.count({
      where: {
        tradingAccount: { userId: req.user.id },
        createdAt: { gte: startOfMonth },
      },
    });

    if (tradeCount >= planConfig.tradeLimit) {
      const requiredPlan = userPlanKey === 'FREE' ? 'STARTER' : 'PRO';
      return res.status(403).json(buildLimitReachedPayload({
        feature: 'trades',
        current: tradeCount,
        limit: planConfig.tradeLimit,
        userPlan: userPlanKey,
        requiredPlan,
      }));
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
    const userPlanKey = getEffectivePlanKey(req.user);
    const planConfig = getPlanConfig(userPlanKey);

    if (planConfig.accountLimit === Infinity) {
      return next();
    }

    const accountCount = await prisma.tradingAccount.count({
      where: { userId: req.user.id },
    });

    if (accountCount >= planConfig.accountLimit) {
      const requiredPlan = userPlanKey === 'FREE' ? 'STARTER' : 'PRO';
      return res.status(403).json(buildLimitReachedPayload({
        feature: 'accounts',
        current: accountCount,
        limit: planConfig.accountLimit,
        userPlan: userPlanKey,
        requiredPlan,
      }));
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
    const userPlanKey = getEffectivePlanKey(req.user);
    const planConfig = getPlanConfig(userPlanKey);

    if (planConfig.screenshotLimit === Infinity) {
      return next();
    }

    const { tradeId } = req.params;
    if (!tradeId) return next();

    const screenshotCount = await prisma.tradeScreenshot.count({
      where: { tradeId },
    });

    if (screenshotCount >= planConfig.screenshotLimit) {
      const requiredPlan = userPlanKey === 'FREE' ? 'STARTER' : 'PRO';
      return res.status(403).json(buildLimitReachedPayload({
        feature: 'screenshots',
        current: screenshotCount,
        limit: planConfig.screenshotLimit,
        userPlan: userPlanKey,
        requiredPlan,
      }));
    }

    next();
  } catch (error) {
    console.error('Subscription Check Screenshot Limit Error:', error);
    next(error);
  }
};

/**
 * Higher-order middleware to enforce feature access requiring PRO or MENTOR plans
 */
const requireProFeature = (featureName = 'feature') => async (req, res, next) => {
  try {
    const userPlanKey = getEffectivePlanKey(req.user);
    const planConfig = getPlanConfig(userPlanKey);

    if (userPlanKey === 'PRO' || userPlanKey === 'MENTOR' || req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    return res.status(403).json(buildLimitReachedPayload({
      feature: featureName,
      current: 0,
      limit: 0,
      userPlan: userPlanKey,
      requiredPlan: 'PRO',
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

    if (userPlanKey === 'MENTOR' || req.user.role === 'MENTOR' || req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    return res.status(403).json(buildLimitReachedPayload({
      feature: 'mentor',
      current: 0,
      limit: 0,
      userPlan: userPlanKey,
      requiredPlan: 'MENTOR',
    }));
  } catch (error) {
    console.error('Subscription Gate Error (mentor):', error);
    next(error);
  }
};

module.exports = {
  checkTradeLimit,
  checkAccountLimit,
  checkScreenshotLimit,
  requireProFeature,
  requireMentorPlan,
};
