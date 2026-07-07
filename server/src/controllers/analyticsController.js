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

const getTradeDate = (trade) => trade.entryTime || trade.createdAt;

const formatDateLabel = (date) => new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
}).format(date);

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
    const error = new Error('Account not found');
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
    const { trades } = await fetchAnalyticsTrades(req);
    const summary = calculateSummary(trades);

    let cumulativeProfit = 0;
    const equityCurve = trades.map((trade) => {
      cumulativeProfit += Number(trade.profitLossAmount || 0);
      return {
        name: formatDateLabel(getTradeDate(trade)),
        profit: Number(cumulativeProfit.toFixed(2)),
      };
    });

    const sessionStats = groupTrades(trades, 'session').map((session) => ({
      name: session.label,
      totalTrades: session.totalTrades,
      wins: session.winningTrades,
      netProfitLoss: session.netRealisedProfitLoss,
      winRate: session.winRate,
    }));

    res.json({
      totalTrades: summary.totalTrades,
      wins: summary.winningTrades,
      losses: summary.losingTrades,
      breakevens: summary.breakEvenTrades,
      winRate: summary.winRate,
      netProfitLoss: summary.netRealisedProfitLoss,
      equityCurve,
      sessionStats,
      profitFactor: summary.profitFactor,
      expectancy: summary.expectancy,
    });
  } catch (error) {
    handleAnalyticsError(res, error, 'Failed to load dashboard analytics');
  }
};

const getPerformanceAnalytics = async (req, res) => {
  try {
    const groupBy = req.query.groupBy || 'pair';

    if (!SUPPORTED_GROUPS.has(groupBy)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported analytics groupBy value',
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
    handleAnalyticsError(res, error, 'Failed to load performance analytics');
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
    handleAnalyticsError(res, error, 'Failed to load analytics summary');
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
    handleAnalyticsError(res, error, 'Failed to load equity curve');
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
    handleAnalyticsError(res, error, 'Failed to load drawdown analytics');
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
    handleAnalyticsError(res, error, 'Failed to load risk-reward analytics');
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
