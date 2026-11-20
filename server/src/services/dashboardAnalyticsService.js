const { PrismaClient } = require('@prisma/client');
const currencyService = require('./fx/currencyService');
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

/**
 * Normalizes starting balance across multi-currency accounts
 */
const getNormalizedStartingBalance = async (accounts, targetCurrency) => {
  let totalUSD = 0;
  const rateCache = new Map();

  for (const account of accounts) {
    const rawBalance = Number(account.startingBalance || 0);
    const accCurrency = account.currency || 'USD';
    if (accCurrency === targetCurrency) {
      totalUSD += rawBalance;
    } else {
      const cacheKey = `${accCurrency}_${targetCurrency}`;
      let rate = rateCache.get(cacheKey);
      if (rate === undefined) {
        const converted = await currencyService.convertAmount(1, accCurrency, targetCurrency);
        rate = converted.convertedAmount ?? 1;
        rateCache.set(cacheKey, rate);
      }
      totalUSD += rawBalance * rate;
    }
  }
  return round(totalUSD, 2);
};

/**
 * Normalizes trade profit/loss values to target currency
 * Uses historical fxRateToReporting when present, else live/cached conversion
 */
const normalizeTradesForAnalytics = async (trades, targetCurrency) => {
  const normalized = [];
  const rateCache = new Map();

  for (const trade of trades) {
    const rawPnl = Number(trade.profitLossAmount || 0);
    const rawRisk = Number(trade.riskAmount || 0);
    const accCurrency = trade.tradingAccount?.currency || 'USD';

    let convertedPnl = rawPnl;
    let convertedRisk = rawRisk;

    if (accCurrency !== targetCurrency) {
      if (trade.fxRateToReporting && targetCurrency === 'USD') {
        convertedPnl = rawPnl * Number(trade.fxRateToReporting);
        convertedRisk = rawRisk * Number(trade.fxRateToReporting);
      } else {
        const cacheKey = `${accCurrency}_${targetCurrency}`;
        let rate = rateCache.get(cacheKey);
        if (rate === undefined) {
          const converted = await currencyService.convertAmount(1, accCurrency, targetCurrency);
          rate = converted.convertedAmount ?? 1;
          rateCache.set(cacheKey, rate);
        }
        convertedPnl = rawPnl * rate;
        convertedRisk = rawRisk * rate;
      }
    }

    normalized.push({
      ...trade,
      profitLossAmount: round(convertedPnl, 2),
      riskAmount: round(convertedRisk, 2),
      nativeCurrency: accCurrency,
      nativeProfitLossAmount: rawPnl,
    });
  }
  return normalized;
};

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
      wins: summary.wins,
      losses: summary.losses,
      breakevens: summary.breakevens,
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
    winRate: pair.winRate,
    totalTrades: pair.totalTrades,
    wins: pair.wins,
    losses: pair.losses,
    breakevens: pair.breakevens,
    profitFactor: pair.profitFactor,
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
    winRate: pair.winRate,
    totalTrades: pair.totalTrades,
    wins: pair.wins,
    losses: pair.losses,
    breakevens: pair.breakevens,
    profitFactor: pair.profitFactor,
  }));
};

const buildPairPerformance = (trades) => {
  const closedTrades = trades.filter(isClosedTrade);
  const total = closedTrades.length;
  const groups = new Map();

  closedTrades.forEach((trade) => {
    const key = trade.pair || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });

  return [...groups.entries()].map(([pair, group]) => {
    const summary = calculateSummary(group);
    return {
      pair,
      totalTrades: summary.totalTrades,
      percentage: total ? round((summary.totalTrades / total) * 100, 1) : 0,
      winRate: summary.winRate,
      wins: summary.wins,
      losses: summary.losses,
      breakevens: summary.breakevens,
      netProfitLoss: summary.netProfitLoss,
      profitFactor: summary.profitFactor,
      grossProfit: summary.grossProfit,
      grossLoss: summary.grossLoss,
    };
  }).sort((a, b) => b.totalTrades - a.totalTrades || b.netProfitLoss - a.netProfitLoss);
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
    currency: trade.nativeCurrency || 'USD',
  }));

const getCurrentUtcWeekWindow = (referenceDate = new Date()) => {
  const now = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date(referenceDate);
  const day = now.getUTCDay() || 7; // Monday = 1, Sunday = 7
  const startOfWeek = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - day + 1,
    0,
    0,
    0,
    0,
  ));
  const endOfWeekExclusive = new Date(startOfWeek.getTime() + (7 * 24 * 60 * 60 * 1000));
  const endOfWeekInclusive = new Date(endOfWeekExclusive.getTime() - 1);

  return {
    startOfWeek,
    endOfWeekExclusive,
    endOfWeekInclusive,
    weekStart: toDateInput(startOfWeek),
    weekEnd: toDateInput(endOfWeekInclusive),
  };
};

const filterTradesForUtcWeek = (trades = [], startOfWeek, endOfWeekExclusive) => trades.filter((trade) => {
  const rawTimestamp = getTradeTimestamp(trade);
  if (!rawTimestamp) return false;
  const timestamp = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp);
  if (Number.isNaN(timestamp.getTime())) return false;
  if (startOfWeek && timestamp < startOfWeek) return false;
  if (endOfWeekExclusive && timestamp >= endOfWeekExclusive) return false;
  return true;
});

const calculateWeeklyGoalItems = ({
  goal,
  trades = [],
  accounts = [],
  dashboardAccountId = null,
  defaultCurrency = 'USD',
  now = new Date(),
}) => {
  if (!goal || goal.active === false) return [];

  let scopedTrades = Array.isArray(trades) ? trades : [];
  let goalCurrency = defaultCurrency || 'USD';
  let scopeType = 'ALL_ACCOUNTS';
  let accountName = null;
  let scopeLabel = 'All Accounts';
  let isDifferentFromDashboardAccount = Boolean(dashboardAccountId);

  if (goal.tradingAccountId) {
    const goalAccount = accounts.find((a) => String(a.id) === String(goal.tradingAccountId)) || goal.tradingAccount || null;
    if (accounts.length > 0 && !accounts.some((a) => String(a.id) === String(goal.tradingAccountId))) {
      return [];
    }

    scopedTrades = scopedTrades.filter(
      (t) => String(t.tradingAccountId || t.tradingAccount?.id || '') === String(goal.tradingAccountId),
    );
    goalCurrency = goalAccount?.currency || defaultCurrency || 'USD';
    scopeType = 'ACCOUNT';
    accountName = goalAccount?.name || 'Selected Account';
    scopeLabel = accountName;
    isDifferentFromDashboardAccount = Boolean(
      dashboardAccountId && String(dashboardAccountId) !== String(goal.tradingAccountId),
    );
  } else {
    if (accounts.length > 0) {
      const validIds = new Set(accounts.map((a) => String(a.id)));
      scopedTrades = scopedTrades.filter((t) => !t.tradingAccountId || validIds.has(String(t.tradingAccountId)));
    }
    goalCurrency = defaultCurrency || (accounts.length === 1 ? accounts[0]?.currency : 'USD') || 'USD';
  }

  const { startOfWeek, endOfWeekExclusive, weekStart, weekEnd } = getCurrentUtcWeekWindow(now);
  const weeklyTrades = filterTradesForUtcWeek(scopedTrades, startOfWeek, endOfWeekExclusive);
  const summary = calculateSummary(weeklyTrades);
  const meta = {
    goalId: goal.id || null,
    tradingAccountId: goal.tradingAccountId || null,
    accountName,
    scopeType,
    scopeLabel,
    currency: goalCurrency,
    isDifferentFromDashboardAccount,
    weekStart,
    weekEnd,
  };
  const items = [];

  if (goal.profitTarget !== null && goal.profitTarget !== undefined) {
    const target = Number(goal.profitTarget);
    const current = summary.netProfitLoss;
    const rawPct = target > 0 ? (current / target) * 100 : 0;
    items.push({
      ...meta,
      key: 'profitTarget',
      label: 'Profit Goal',
      currentValue: current,
      targetValue: target,
      percentageComplete: target > 0 ? round(Math.max(0, rawPct), 1) : 0,
      isCompleted: target > 0 && current >= target,
      isNegative: current < 0,
      format: 'currency',
    });
  }

  if (goal.tradeCountTarget !== null && goal.tradeCountTarget !== undefined) {
    const target = Number(goal.tradeCountTarget);
    const current = summary.totalTrades;
    items.push({
      ...meta,
      key: 'tradeCountTarget',
      label: 'Trade Goal',
      currentValue: current,
      targetValue: target,
      percentageComplete: target > 0 ? round((current / target) * 100, 1) : 0,
      isCompleted: target > 0 && current >= target,
      format: 'integer',
    });
  }

  if (goal.winRateTarget !== null && goal.winRateTarget !== undefined) {
    const target = Number(goal.winRateTarget);
    const current = summary.winRate;
    items.push({
      ...meta,
      key: 'winRateTarget',
      label: 'Win Rate Goal',
      currentValue: current,
      targetValue: target,
      percentageComplete: target > 0 ? round((current / target) * 100, 1) : 0,
      isCompleted: summary.closedTrades > 0 && target > 0 && current >= target,
      closedTrades: summary.closedTrades,
      format: 'percent',
    });
  }

  if (goal.maxLossTarget !== null && goal.maxLossTarget !== undefined) {
    const target = Number(goal.maxLossTarget);
    const current = summary.grossLoss;
    items.push({
      ...meta,
      key: 'maxLossTarget',
      label: 'Maximum Loss Goal',
      currentValue: current,
      targetValue: target,
      percentageComplete: target > 0 ? round((current / target) * 100, 1) : 0,
      format: 'currency',
      inverse: true,
      isExceeded: target > 0 && current > target,
      isWarning: target > 0 && current >= target * 0.8 && current <= target,
    });
  }

  return items;
};

const buildGoalProgress = async ({
  userId,
  accountId = null,
  accounts = null,
  rawTrades = null,
  trades = [],
  targetCurrency = 'USD',
  now = new Date(),
}) => {
  const ownerAccounts = Array.isArray(accounts)
    ? accounts
    : await prisma.tradingAccount.findMany({
      where: { userId },
      select: { id: true, name: true, currency: true },
      orderBy: { createdAt: 'asc' },
    });

  const goals = await prisma.tradingGoal.findMany({
    where: {
      userId,
      active: true,
      periodType: 'WEEKLY',
    },
    include: {
      tradingAccount: {
        select: { id: true, name: true, currency: true },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const ownerAccountIds = new Set(ownerAccounts.map((a) => String(a.id)));
  const validGoals = goals.filter(
    (g) => !g.tradingAccountId || ownerAccountIds.has(String(g.tradingAccountId)),
  );
  if (validGoals.length === 0) return [];

  const goal = (accountId && validGoals.find((g) => String(g.tradingAccountId) === String(accountId)))
    || validGoals[0];

  let goalCurrency = targetCurrency || 'USD';
  let goalTrades = [];

  if (goal.tradingAccountId) {
    const goalAccount = ownerAccounts.find((a) => String(a.id) === String(goal.tradingAccountId)) || goal.tradingAccount;
    goalCurrency = goalAccount?.currency || 'USD';
    const matchingRawTrades = Array.isArray(rawTrades) && (!accountId || String(accountId) === String(goal.tradingAccountId))
      ? rawTrades.filter((t) => String(t.tradingAccountId) === String(goal.tradingAccountId))
      : await fetchTrades(userId, [goal.tradingAccountId]);
    goalTrades = await normalizeTradesForAnalytics(matchingRawTrades, goalCurrency);
  } else {
    goalCurrency = ownerAccounts.length > 1 ? 'USD' : (ownerAccounts[0]?.currency || targetCurrency || 'USD');
    if (!accountId && Array.isArray(trades) && goalCurrency === targetCurrency) {
      goalTrades = trades;
    } else {
      const allUserRawTrades = await fetchTrades(userId, ownerAccounts.map((a) => a.id));
      goalTrades = await normalizeTradesForAnalytics(allUserRawTrades, goalCurrency);
    }
  }

  return calculateWeeklyGoalItems({
    goal,
    trades: goalTrades,
    accounts: ownerAccounts,
    dashboardAccountId: accountId,
    defaultCurrency: goalCurrency,
    now,
  });
};

const buildDashboardAnalytics = async ({ userId, query }) => {
  const accountId = hasValue(query.accountId) ? String(query.accountId) : null;
  const startDate = parseDate(query.startDate);
  const endDate = parseDate(query.endDate, true);
  const previousPeriod = getPreviousPeriod(startDate, endDate);
  const { accounts, selectedAccounts } = await validateAccountFilter(userId, accountId);
  const accountIds = selectedAccounts.map((account) => account.id);

  // If single account selected, use native currency; if all accounts selected, use USD reporting currency
  const isMultiAccount = !accountId && selectedAccounts.length > 1;
  const targetCurrency = isMultiAccount ? 'USD' : (selectedAccounts[0]?.currency || accounts[0]?.currency || 'USD');

  const rawTrades = await fetchTrades(userId, accountIds);
  const allTrades = await normalizeTradesForAnalytics(rawTrades, targetCurrency);
  const currentTrades = filterTradesByPeriod(allTrades, startDate, endDate);
  const previousTrades = previousPeriod ? filterTradesByPeriod(allTrades, previousPeriod.startDate, previousPeriod.endDate) : [];
  
  const startingBalance = await getNormalizedStartingBalance(selectedAccounts, targetCurrency);
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

  // Retrieve FX conversion metadata for status UI
  const fxDetails = await currencyService.getExchangeRateDetails(targetCurrency, 'USD');

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
    currency: targetCurrency,
    isMultiAccountNormalized: isMultiAccount,
    fxMetadata: {
      source: fxDetails.source,
      timeAgo: fxDetails.timeAgo,
      isStale: fxDetails.isStale,
      status: fxDetails.status,
    },
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
    pairPerformance: buildPairPerformance(currentTrades),
    tradeOutcomes: {
      wins: currentSummary.wins,
      losses: currentSummary.losses,
      breakevens: currentSummary.breakevens,
      totalClosedTrades: currentSummary.closedTrades,
    },
    weeklyGoals: await buildGoalProgress({
      userId,
      accountId,
      accounts,
      rawTrades,
      trades: allTrades,
      targetCurrency,
    }),
    recentTrades: buildRecentTrades(currentTrades),
  };
};

module.exports = {
  buildDashboardAnalytics,
  buildGoalProgress,
  calculateWeeklyGoalItems,
  getCurrentUtcWeekWindow,
  filterTradesForUtcWeek,
  buildSessionPerformance,
  buildPairPerformance,
  buildCalendar,
  buildTopPairs,
  buildWorstPairs,
  getPreviousPeriod,
  filterTradesByPeriod,
  validateAccountFilter,
};
