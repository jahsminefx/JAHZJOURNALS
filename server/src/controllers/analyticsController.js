const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  SUPPORTED_GROUPS,
  buildTradeWhere,
  calculateSummary,
  calculateEquityCurve,
  calculateDrawdown,
  calculateRiskRewardDistribution,
  groupTrades,
} = require('../services/analyticsService');
const { buildDashboardAnalytics } = require('../services/dashboardAnalyticsService');

const getUserTimezone = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  return user?.timezone || 'UTC';
};

const validateAccountFilter = async (accountId, userId) => {
  if (!accountId) return null;

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, startingBalance: true },
  });

  if (!account) {
    const error = new Error('We couldn\'t find your trading account');
    error.statusCode = 404;
    throw error;
  }

  return account;
};

const fetchAnalyticsTrades = async (req) => {
  const account = await validateAccountFilter(req.query.accountId, req.user.id);
  const where = buildTradeWhere(req.query, req.user.id);
  const trades = await prisma.trade.findMany({
    where,
    orderBy: [{ entryTime: 'asc' }, { createdAt: 'asc' }],
    include: {
      emotionLogs: true,
      strategy: { select: { id: true, name: true } },
      setup: { select: { id: true, name: true } },
      checklistResponses: { include: { checklistItem: true } },
      ruleViolations: {
        include: {
          tradeRule: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return { trades, account };
};

const handleAnalyticsError = (res, error, fallbackMessage) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallbackMessage });
};

const getDashboardAnalytics = async (req, res) => {
  try {
    const dashboard = await buildDashboardAnalytics({ userId: req.user.id, query: req.query });
    res.set('Cache-Control', 'no-store');
    res.json(dashboard);
  } catch (error) {
    handleAnalyticsError(res, error, 'We couldn\'t assemble your dashboard.');
  }
};

const getPerformanceAnalytics = async (req, res) => {
  try {
    const groupBy = req.query.groupBy || 'pair';

    if (!SUPPORTED_GROUPS.has(groupBy)) {
      return res.status(400).json({
        success: false,
        message: 'We can\'t group your analytics that way.',
        supportedGroupBy: [...SUPPORTED_GROUPS],
      });
    }

    const timezone = req.query.timezone || await getUserTimezone(req.user.id);
    const { trades } = await fetchAnalyticsTrades(req);

    res.json({
      success: true,
      filters: req.query,
      groupBy,
      summary: calculateSummary(trades),
      data: groupTrades(trades, groupBy, timezone),
    });
  } catch (error) {
    handleAnalyticsError(res, error, 'We couldn\'t assemble your performance analytics.');
  }
};

const getSummaryAnalytics = async (req, res) => {
  try {
    const { trades } = await fetchAnalyticsTrades(req);
    const summary = calculateSummary(trades);
    const aPlusTrades = trades.filter((trade) => trade.isAPlusSetup === true);
    const newsTrades = trades.filter((trade) => trade.newsRelated === true);

    res.json({
      success: true,
      filters: req.query,
      summary: {
        ...summary,
        aPlusSetupPerformance: calculateSummary(aPlusTrades),
        newsRelatedPerformance: calculateSummary(newsTrades),
      },
    });
  } catch (error) {
    handleAnalyticsError(res, error, 'We couldn\'t calculate your analytics summary.');
  }
};

const getEquityCurve = async (req, res) => {
  try {
    const { trades, account } = await fetchAnalyticsTrades(req);
    const startingBalance = account ? Number(account.startingBalance || 0) : null;

    res.json({
      success: true,
      filters: req.query,
      summary: calculateSummary(trades),
      data: calculateEquityCurve(trades, startingBalance),
    });
  } catch (error) {
    handleAnalyticsError(res, error, 'We hit a snag loading your equity curve.');
  }
};

const getDrawdown = async (req, res) => {
  try {
    const { trades, account } = await fetchAnalyticsTrades(req);
    const startingBalance = account ? Number(account.startingBalance || 0) : null;
    const equityCurve = calculateEquityCurve(trades, startingBalance);
    const drawdown = calculateDrawdown(equityCurve, startingBalance);

    res.json({
      success: true,
      filters: req.query,
      maximumDrawdown: drawdown.maximumDrawdown,
      data: drawdown.data,
    });
  } catch (error) {
    handleAnalyticsError(res, error, 'We hit a snag loading your drawdown analytics.');
  }
};

const getRiskReward = async (req, res) => {
  try {
    const { trades } = await fetchAnalyticsTrades(req);

    res.json({
      success: true,
      filters: req.query,
      summary: calculateSummary(trades),
      data: calculateRiskRewardDistribution(trades),
    });
  } catch (error) {
    handleAnalyticsError(res, error, 'We hit a snag loading your risk-reward metrics.');
  }
};

module.exports = {
  getDashboardAnalytics,
  getPerformanceAnalytics,
  getSummaryAnalytics,
  getEquityCurve,
  getDrawdown,
  getRiskReward,
};
