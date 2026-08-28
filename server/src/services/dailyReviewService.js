const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { normalizeTradeResult } = require('../utils/tradeCalculations');
const { calculatePips } = require('../utils/pipCalculator');
const currencyService = require('./fx/currencyService');

const hasValue = (val) => val !== undefined && val !== null && val !== '';
const round = (val, decimals = 2) => (val === null || val === undefined ? null : Number(Number(val).toFixed(decimals)));
const safeDivide = (num, den) => (den ? num / den : 0);

const getScopeKey = (accountId) => (accountId ? `account_${accountId}` : 'all');

const normalizeDateRange = (dateInput, timezone = 'UTC') => {
  let year, month, day;

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const parts = dateInput.split('T')[0].split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    const baseDate = dateInput ? new Date(dateInput) : new Date();
    year = baseDate.getUTCFullYear();
    month = baseDate.getUTCMonth() + 1;
    day = baseDate.getUTCDate();
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const reviewDate = new Date(`${dateStr}T00:00:00.000Z`);

  let startOfDay, endOfDay;
  try {
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcMidnight);
    const partMap = {};
    parts.forEach((p) => { partMap[p.type] = p.value; });

    const tzYear = parseInt(partMap.year, 10);
    const tzMonth = parseInt(partMap.month, 10);
    const tzDay = parseInt(partMap.day, 10);
    let tzHour = parseInt(partMap.hour, 10);
    if (tzHour === 24) tzHour = 0;
    const tzMinute = parseInt(partMap.minute, 10);

    const tzAsUtc = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0));
    const offsetMs = tzAsUtc.getTime() - utcMidnight.getTime();

    startOfDay = new Date(utcMidnight.getTime() - offsetMs);
    endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  } catch (err) {
    startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
  }

  return { dateStr, reviewDate, startOfDay, endOfDay };
};

const calculateMostCommon = (items) => {
  const counts = new Map();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

/**
 * Calculates deterministic statistics and fetches/creates DailyReview record for user/date/account context.
 */
const getDailyReviewSummary = async ({ userId, date, accountId, timezone = 'UTC' }) => {
  const { dateStr, reviewDate, startOfDay, endOfDay } = normalizeDateRange(date, timezone);
  const scopeKey = getScopeKey(accountId);

  let selectedAccount = null;
  if (accountId) {
    selectedAccount = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, name: true, currency: true, startingBalance: true, currentBalance: true },
    });
    if (!selectedAccount) {
      const err = new Error('Trading account not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  // Fetch all trades for this user (and account if provided) falling within the date window
  const tradeWhere = {
    tradingAccount: { userId },
    ...(accountId ? { tradingAccountId: accountId } : {}),
    OR: [
      { entryTime: { gte: startOfDay, lte: endOfDay } },
      { exitTime: { gte: startOfDay, lte: endOfDay } },
      { AND: [{ entryTime: null }, { createdAt: { gte: startOfDay, lte: endOfDay } }] },
    ],
  };

  const trades = await prisma.trade.findMany({
    where: tradeWhere,
    include: {
      tradingAccount: { select: { id: true, name: true, currency: true } },
      strategy: { select: { id: true, name: true } },
      setup: { select: { id: true, name: true } },
      ruleViolations: { include: { tradeRule: true } },
      emotionLogs: true,
      screenshots: { select: { id: true, imageUrl: true, screenshotType: true, note: true } },
    },
    orderBy: { entryTime: 'asc' },
  });

  const closedTrades = trades.filter((t) => normalizeTradeResult(t) !== 'OPEN');
  const winningTrades = closedTrades.filter((t) => normalizeTradeResult(t) === 'WIN');
  const losingTrades = closedTrades.filter((t) => normalizeTradeResult(t) === 'LOSS');
  const breakevenTrades = closedTrades.filter((t) => normalizeTradeResult(t) === 'BREAKEVEN');

  const winRate = closedTrades.length > 0 ? round((winningTrades.length / closedTrades.length) * 100, 1) : 0;
  const lossRate = closedTrades.length > 0 ? round((losingTrades.length / closedTrades.length) * 100, 1) : 0;

  let fxStatus = 'LIVE';
  let isMultiAccount = !accountId;
  let primaryCurrency = accountId ? selectedAccount.currency : 'USD';
  let reportingCurrency = accountId ? selectedAccount.currency : 'USD';

  let grossProfit = 0;
  let grossLoss = 0;
  let netProfitLoss = 0;
  let largestWinner = null;
  let largestLoser = null;

  // Process trades monetary values with strict FX handling
  if (!isMultiAccount) {
    // Single Account: native currency
    trades.forEach((t) => {
      const pnl = Number(t.profitLossAmount || 0);
      if (pnl > 0) grossProfit += pnl;
      if (pnl < 0) grossLoss += Math.abs(pnl);
    });
    netProfitLoss = grossProfit - grossLoss;

    const sortedByPnl = [...trades].sort((a, b) => Number(b.profitLossAmount || 0) - Number(a.profitLossAmount || 0));
    const topWin = sortedByPnl[0];
    const topLoss = sortedByPnl[sortedByPnl.length - 1];

    if (topWin && Number(topWin.profitLossAmount || 0) > 0) {
      largestWinner = {
        tradeId: topWin.id,
        pair: topWin.pair,
        pnl: round(topWin.profitLossAmount),
        pips: topWin.pips,
        currency: primaryCurrency,
      };
    }

    if (topLoss && Number(topLoss.profitLossAmount || 0) < 0) {
      largestLoser = {
        tradeId: topLoss.id,
        pair: topLoss.pair,
        pnl: round(topLoss.profitLossAmount),
        pips: topLoss.pips,
        currency: primaryCurrency,
      };
    }
  } else {
    // ALL ACCOUNTS: Normalize monetary amounts to USD via existing FX service
    let fxSourcesUsed = new Set();

    for (const t of trades) {
      const rawPnl = Number(t.profitLossAmount || 0);
      const accCurrency = t.tradingAccount?.currency || 'USD';
      const conversion = await currencyService.convertToReportingCurrency(rawPnl, accCurrency);

      if (conversion.rateDetails?.source) {
        fxSourcesUsed.add(conversion.rateDetails.source);
      }

      const usdPnl = conversion.convertedAmount !== null ? conversion.convertedAmount : rawPnl;
      t._usdPnl = usdPnl;

      if (usdPnl > 0) grossProfit += usdPnl;
      if (usdPnl < 0) grossLoss += Math.abs(usdPnl);
    }

    netProfitLoss = grossProfit - grossLoss;

    if (fxSourcesUsed.has('UNAVAILABLE')) {
      fxStatus = 'UNAVAILABLE';
    } else if (fxSourcesUsed.has('CACHED')) {
      fxStatus = 'CACHED';
    } else {
      fxStatus = 'LIVE';
    }

    const sortedByUsdPnl = [...trades].sort((a, b) => (b._usdPnl || 0) - (a._usdPnl || 0));
    const topWin = sortedByUsdPnl[0];
    const topLoss = sortedByUsdPnl[sortedByUsdPnl.length - 1];

    if (topWin && (topWin._usdPnl || 0) > 0) {
      largestWinner = {
        tradeId: topWin.id,
        pair: topWin.pair,
        pnl: round(topWin._usdPnl),
        pips: topWin.pips,
        currency: 'USD',
        nativePnl: round(topWin.profitLossAmount),
        nativeCurrency: topWin.tradingAccount?.currency || 'USD',
      };
    }

    if (topLoss && (topLoss._usdPnl || 0) < 0) {
      largestLoser = {
        tradeId: topLoss.id,
        pair: topLoss.pair,
        pnl: round(topLoss._usdPnl),
        pips: topLoss.pips,
        currency: 'USD',
        nativePnl: round(topLoss.profitLossAmount),
        nativeCurrency: topLoss.tradingAccount?.currency || 'USD',
      };
    }
  }

  const profitFactor = grossLoss > 0 ? round(grossProfit / grossLoss, 2) : null;
  const averageWin = winningTrades.length > 0 ? round(grossProfit / winningTrades.length) : null;
  const averageLoser = losingTrades.length > 0 ? round(grossLoss / losingTrades.length) : null;

  const validRrValues = trades.map((t) => Number(t.riskRewardRatio)).filter((v) => Number.isFinite(v));
  const averageRiskReward = validRrValues.length > 0
    ? round(validRrValues.reduce((sum, val) => sum + val, 0) / validRrValues.length, 2)
    : null;

  const totalPips = round(trades.reduce((sum, t) => {
    const tradePips = t.pips !== null && t.pips !== undefined
      ? Number(t.pips)
      : calculatePips({ pair: t.pair, direction: t.direction, entryPrice: t.entryPrice, exitPrice: t.exitPrice });
    return sum + Number(tradePips || 0);
  }, 0), 1);

  const bestStrategy = calculateMostCommon(trades.map((t) => t.strategy?.name));
  const bestSession = calculateMostCommon(trades.map((t) => t.session));
  const totalRuleViolations = trades.reduce((sum, t) => sum + (t.ruleViolations || []).length, 0);

  const planKnownTrades = trades.filter((t) => t.followedPlan !== null);
  const planFollowingRate = planKnownTrades.length > 0
    ? round((planKnownTrades.filter((t) => t.followedPlan).length / planKnownTrades.length) * 100, 1)
    : null;

  const deterministicMetrics = {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    breakEvenTrades: breakevenTrades.length,
    winRate,
    lossRate,
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    netProfitLoss: round(netProfitLoss),
    profitFactor,
    averageWin,
    averageLoser,
    averageRiskReward,
    totalPips,
    largestWinner,
    largestLoser,
    bestStrategy,
    bestSession,
    totalRuleViolations,
    planFollowingRate,
    currency: primaryCurrency,
    reportingCurrency,
    isMultiAccount,
    fxStatus,
    note: isMultiAccount ? 'Portfolio values shown in USD (normalized via FX service)' : null,
  };

  // Find existing DailyReview record if saved
  let review = await prisma.dailyReview.findUnique({
    where: {
      userId_scopeKey_reviewDate: {
        userId,
        scopeKey,
        reviewDate,
      },
    },
    include: {
      sharedDailyReviews: {
        where: { isActive: true },
        select: { id: true, shareToken: true, isActive: true, includeAiReview: true, includeNotes: true, includeScreenshots: true },
      },
    },
  });

  return {
    dateStr,
    reviewDate,
    scopeKey,
    selectedAccount,
    trades,
    metrics: deterministicMetrics,
    review,
  };
};

module.exports = {
  getScopeKey,
  normalizeDateRange,
  getDailyReviewSummary,
};
