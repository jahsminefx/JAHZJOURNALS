const { PrismaClient } = require('@prisma/client');
const {
  bucketByDate,
  buildPerformanceCurve,
  calculateDrawdown,
  calculateEquityCurve,
  calculatePeriodComparison,
  calculateSummary,
  formatDateKey,
  getTradeTimestamp,
  isClosedTrade,
  normalizeTradeResult,
  round,
  safeDivide,
} = require('../utils/dashboardMath');

const prisma = new PrismaClient();

const sessionLabels = {
  LONDON: 'London',
  NEW_YORK: 'New York',
  ASIAN: 'Asian',
  LONDON_NEW_YORK_OVERLAP: 'London/New York overlap',
  OTHER: 'Other',
  UNSPECIFIED: 'Other',
};

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const parseDate = (value, endOfDay = false) => {
  if (!hasValue(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

const toDateInput = (date) => date.toISOString().slice(0, 10);

const getPreviousPeriod = (startDate, endDate) => {
  if (!startDate || !endDate) return null;

  const duration = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return { startDate: previousStart, endDate: previousEnd };
};

const filterTradesByPeriod = (trades, startDate, endDate) => trades.filter((trade) => {
  const timestamp = getTradeTimestamp(trade);
  if (!timestamp) return false;
  if (startDate && timestamp < startDate) return false;
  if (endDate && timestamp > endDate) return false;
  return true;
});

const getStartingBalance = (accounts) => accounts.reduce((total, account) => total + Number(account.startingBalance || 0), 0);

const validateAccountFilter = async (userId, accountId) => {
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      startingBalance: true,
      currentBalance: true,
      currency: true,
      accountCategory: true,
      isPropFirmAccount: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!accountId) return { accounts, selectedAccounts: accounts };

  const selected = accounts.find((account) => account.id === accountId);
  if (!selected) {
    const error = new Error('Account not found');
    error.statusCode = 404;
    throw error;
  }

  return { accounts, selectedAccounts: [selected] };
};

const fetchTrades = (userId, accountIds) => prisma.trade.findMany({
  where: {
    tradingAccount: { userId },
    ...(accountIds.length ? { tradingAccountId: { in: accountIds } } : {}),
  },
  include: {
    tradingAccount: {
      select: { id: true, name: true, startingBalance: true, currency: true },
    },
  },
  orderBy: [{ exitTime: 'asc' }, { entryTime: 'asc' }, { createdAt: 'asc' }],
});

const bucketTradesByDate = (trades) => {
  const buckets = new Map();

  trades.forEach((trade) => {
    const timestamp = getTradeTimestamp(trade);
    if (!timestamp) return;

    const key = formatDateKey(timestamp);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(trade);
  });

  return buckets;
};

const createSparkline = (trades, metric) => {
  if (!trades.length) return [];
  const buckets = metric === 'totalTrades' ? bucketTradesByDate(trades) : bucketByDate(trades);

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayTrades]) => {
      const summary = calculateSummary(dayTrades);
      const equity = dayTrades.reduce((total, trade) => total + Number(trade.profitLossAmount || 0), 0);
      const valueByMetric = {
        netProfitLoss: equity,
        winRate: summary.winRate,
        totalTrades: summary.totalTrades,
        profitFactor: summary.profitFactor ?? 0,
        drawdown: Math.abs(Math.min(equity, 0)),
      };
      return { date, value: round(valueByMetric[metric] || 0) };
    });
};

const buildSessionPerformance = (trades) => {
  const closedTrades = trades.filter(isClosedTrade);
  const total = closedTrades.length;
  const groups = new Map();

  closedTrades.forEach((trade) => {
    const key = trade.session || 'UNSPECIFIED';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });

  const sessions = [...groups.entries()].map(([key, group]) => {
    const summary = calculateSummary(group);
    return {
      key,
      label: sessionLabels[key] || sessionLabels.UNSPECIFIED,
      totalTrades: summary.totalTrades,
      percentage: total ? round((summary.totalTrades / total) * 100, 1) : 0,
      winRate: summary.winRate,
      netProfitLoss: summary.netProfitLoss,
      profitFactor: summary.profitFactor,
      grossProfit: summary.grossProfit,
      grossLoss: summary.grossLoss,
    };
  }).sort((a, b) => b.totalTrades - a.totalTrades);

  const minimumSampleSize = Math.max(3, Math.ceil(total * 0.1));
  const strongest = sessions
    .filter((session) => session.totalTrades >= minimumSampleSize && session.netProfitLoss > 0)
    .sort((a, b) => (b.profitFactor || 0) - (a.profitFactor || 0) || b.netProfitLoss - a.netProfitLoss)[0] || null;

  return sessions.map((session) => ({
    ...session,
    isStrongest: Boolean(strongest && strongest.key === session.key),
  }));
};

const buildCalendar = (trades) => [...bucketByDate(trades).entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, dayTrades]) => {
    const summary = calculateSummary(dayTrades);
    const outcome = summary.netProfitLoss > 0
      ? 'PROFIT'
      : summary.netProfitLoss < 0
        ? 'LOSS'
        : 'BREAKEVEN';

    return {
      date,
      totalTrades: summary.totalTrades,
      wins: summary.wins,
      losses: summary.losses,
      breakevens: summary.breakevens,
      netProfitLoss: summary.netProfitLoss,
      outcome,
    };
  });

const buildTopPairs = (trades) => {
  const groups = new Map();

  trades.filter(isClosedTrade).forEach((trade) => {
    const key = trade.pair || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });

  const pairStats = [...groups.entries()].map(([pair, group]) => ({
    pair,
    ...calculateSummary(group),
  })).filter((pair) => pair.netProfitLoss > 0)
    .sort((a, b) => b.netProfitLoss - a.netProfitLoss)
    .slice(0, 5);

  const positiveTotal = pairStats.reduce((total, pair) => total + pair.netProfitLoss, 0);

  return pairStats.map((pair) => ({
    pair: pair.pair,
    netProfitLoss: pair.netProfitLoss,
    contributionPercentage: positiveTotal ? round((pair.netProfitLoss / positiveTotal) * 100, 1) : 0,
  }));
};

const buildWorstPairs = (trades) => {
  const groups = new Map();

  trades.filter(isClosedTrade).forEach((trade) => {
    const key = trade.pair || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });

  const pairStats = [...groups.entries()].map(([pair, group]) => ({
    pair,
    ...calculateSummary(group),
  })).filter((pair) => pair.netProfitLoss < 0)
    .sort((a, b) => a.netProfitLoss - b.netProfitLoss)
    .slice(0, 5);

  const negativeTotal = pairStats.reduce((total, pair) => total + pair.netProfitLoss, 0);

  return pairStats.map((pair) => ({
    pair: pair.pair,
    netProfitLoss: pair.netProfitLoss,
    contributionPercentage: negativeTotal ? round((pair.netProfitLoss / negativeTotal) * 100, 1) : 0,
  }));
};

const buildRecentTrades = (trades) => [...trades]
  .sort((a, b) => getTradeTimestamp(b) - getTradeTimestamp(a))
  .slice(0, 5)
  .map((trade) => ({
    id: trade.id,
    pair: trade.pair,
    direction: trade.direction,
    profitLossAmount: round(trade.profitLossAmount),
    result: normalizeTradeResult(trade),
    status: trade.status,
    entryTime: trade.entryTime ? trade.entryTime.toISOString() : null,
    exitTime: trade.exitTime ? trade.exitTime.toISOString() : null,
    createdAt: trade.createdAt ? trade.createdAt.toISOString() : null,
    timestamp: getTradeTimestamp(trade).toISOString(),
  }));

const buildGoalProgress = async ({ userId, accountId, trades }) => {
  const goals = await prisma.tradingGoal.findMany({
    where: {
      userId,
      active: true,
      periodType: 'WEEKLY',
      OR: [
        { tradingAccountId: null },
        ...(accountId ? [{ tradingAccountId: accountId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const goal = goals[0];
  if (!goal) return [];

  const today = new Date();
  const day = today.getUTCDay() || 7;
  const startOfWeek = new Date(today);
  startOfWeek.setUTCDate(today.getUTCDate() - day + 1);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  const weeklyTrades = filterTradesByPeriod(trades, startOfWeek, endOfWeek);
  const summary = calculateSummary(weeklyTrades);
  const items = [];

  if (goal.profitTarget !== null) {
    const target = Number(goal.profitTarget);
    items.push({
      key: 'profitTarget',
      label: 'Profit Goal',
      currentValue: summary.netProfitLoss,
      targetValue: target,
      percentageComplete: target ? round(Math.max(0, summary.netProfitLoss / target) * 100, 1) : 0,
      format: 'currency',
    });
  }

  if (goal.tradeCountTarget !== null) {
    const target = Number(goal.tradeCountTarget);
    items.push({
      key: 'tradeCountTarget',
      label: 'Trade Goal',
      currentValue: summary.totalTrades,
      targetValue: target,
      percentageComplete: target ? round((summary.totalTrades / target) * 100, 1) : 0,
      format: 'integer',
    });
  }

  if (goal.winRateTarget !== null) {
    const target = Number(goal.winRateTarget);
    items.push({
      key: 'winRateTarget',
      label: 'Win Rate Goal',
      currentValue: summary.winRate,
      targetValue: target,
      percentageComplete: target ? round((summary.winRate / target) * 100, 1) : 0,
      format: 'percent',
    });
  }

  if (goal.maxLossTarget !== null) {
    const target = Number(goal.maxLossTarget);
    items.push({
      key: 'maxLossTarget',
      label: 'Maximum Loss Goal',
      currentValue: summary.grossLoss,
      targetValue: target,
      percentageComplete: target ? round((summary.grossLoss / target) * 100, 1) : 0,
      format: 'currency',
      inverse: true,
    });
  }

  return items;
};

const buildDashboardAnalytics = async ({ userId, query }) => {
  const accountId = hasValue(query.accountId) ? String(query.accountId) : null;
  const startDate = parseDate(query.startDate);
  const endDate = parseDate(query.endDate, true);
  const previousPeriod = getPreviousPeriod(startDate, endDate);
  const { accounts, selectedAccounts } = await validateAccountFilter(userId, accountId);
  const accountIds = selectedAccounts.map((account) => account.id);
  const allTrades = await fetchTrades(userId, accountIds);
  const currentTrades = filterTradesByPeriod(allTrades, startDate, endDate);
  const previousTrades = previousPeriod ? filterTradesByPeriod(allTrades, previousPeriod.startDate, previousPeriod.endDate) : [];
  const startingBalance = getStartingBalance(selectedAccounts);
  const currentSummary = calculateSummary(currentTrades, startingBalance);
  const equityCurve = calculateEquityCurve(currentTrades, startingBalance);
  const drawdown = calculateDrawdown(equityCurve, startingBalance);
  const performanceCurve = buildPerformanceCurve({
    accounts: selectedAccounts,
    trades: allTrades,
    startDate,
    endDate,
  });
  const previousSummary = calculateSummary(previousTrades, startingBalance);
  const previousDrawdown = calculateDrawdown(calculateEquityCurve(previousTrades, startingBalance), startingBalance);
  const comparison = previousPeriod
    ? calculatePeriodComparison(
      { ...currentSummary, maximumDrawdownPercentage: drawdown.maximumDrawdownPercentage },
      { ...previousSummary, maximumDrawdownPercentage: previousDrawdown.maximumDrawdownPercentage },
    )
    : null;

  return {
    filters: {
      accountId,
      startDate: startDate ? toDateInput(startDate) : null,
      endDate: endDate ? toDateInput(endDate) : null,
      previousPeriod: previousPeriod ? {
        startDate: toDateInput(previousPeriod.startDate),
        endDate: toDateInput(previousPeriod.endDate),
      } : null,
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      startingBalance: Number(account.startingBalance || 0),
      currentBalance: Number(account.currentBalance || 0),
      currency: account.currency || 'USD',
      accountCategory: account.accountCategory,
      isPropFirmAccount: account.isPropFirmAccount,
      createdAt: account.createdAt ? account.createdAt.toISOString() : null,
    })),
    selectedAccountIds: accountIds,
    startingBalance,
    currency: selectedAccounts[0]?.currency || accounts[0]?.currency || 'USD',
    summary: {
      netProfitLoss: currentSummary.netProfitLoss,
      returnPercentage: currentSummary.returnPercentage,
      winRate: currentSummary.winRate,
      totalTrades: currentSummary.totalTrades,
      closedTrades: currentSummary.closedTrades,
      profitFactor: currentSummary.profitFactor,
      maximumDrawdown: drawdown.maximumDrawdown,
      maximumDrawdownPercentage: drawdown.maximumDrawdownPercentage,
    },
    previousPeriodComparison: comparison,
    performanceCurve,
    metricSparklines: {
      netProfitLoss: createSparkline(currentTrades, 'netProfitLoss'),
      winRate: createSparkline(currentTrades, 'winRate'),
      totalTrades: createSparkline(currentTrades, 'totalTrades'),
      profitFactor: createSparkline(currentTrades, 'profitFactor'),
      drawdown: drawdown.data.map((point) => ({ date: point.label, value: point.drawdownPercentage })),
    },
    equityCurve: drawdown.data,
    sessionPerformance: buildSessionPerformance(currentTrades),
    calendar: buildCalendar(currentTrades),
    performanceBreakdown: {
      grossProfit: currentSummary.grossProfit,
      grossLoss: currentSummary.grossLoss,
      averageWin: currentSummary.averageWin,
      averageLoss: currentSummary.averageLoss,
    },
    topPairs: buildTopPairs(currentTrades),
    worstPairs: buildWorstPairs(currentTrades),
    tradeOutcomes: {
      wins: currentSummary.wins,
      losses: currentSummary.losses,
      breakevens: currentSummary.breakevens,
      totalClosedTrades: currentSummary.closedTrades,
    },
    weeklyGoals: await buildGoalProgress({ userId, accountId, trades: allTrades }),
    recentTrades: buildRecentTrades(currentTrades),
  };
};

module.exports = {
  buildDashboardAnalytics,
  buildSessionPerformance,
  buildCalendar,
  buildTopPairs,
  buildWorstPairs,
  getPreviousPeriod,
  filterTradesByPeriod,
  validateAccountFilter,
};
