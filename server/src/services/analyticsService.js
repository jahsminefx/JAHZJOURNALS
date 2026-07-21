const SUPPORTED_GROUPS = new Set([
  'pair',
  'session',
  'setup',
  'strategy',
  'direction',
  'weekday',
  'timeframe',
  'emotion',
  'ruleViolation',
]);
const { normalizeTradeResult } = require('../utils/tradeCalculations');

const hasValue = (value) => value !== undefined && value !== null && value !== '';
const round = (value, places = 2) => Number((Number(value) || 0).toFixed(places));
const safeDivide = (numerator, denominator) => {
  if (!denominator) return 0;
  return numerator / denominator;
};

const normalizeDate = (value, endOfDay = false) => {
  if (!hasValue(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

const getTradeTimestamp = (trade) => trade.exitTime || trade.entryTime || trade.createdAt;

const buildTradeWhere = (query = {}, userId) => {
  const where = {
    tradingAccount: { userId },
  };

  if (hasValue(query.accountId)) {
    where.tradingAccountId = query.accountId;
  }

  const startDate = normalizeDate(query.startDate);
  const endDate = normalizeDate(query.endDate, true);
  if (startDate || endDate) {
    where.entryTime = {};
    if (startDate) where.entryTime.gte = startDate;
    if (endDate) where.entryTime.lte = endDate;
  }

  if (hasValue(query.pair)) where.pair = String(query.pair).trim().toUpperCase();
  if (hasValue(query.session)) where.session = query.session;
  if (hasValue(query.setup)) where.setupId = String(query.setup).trim();
  if (hasValue(query.strategy)) where.strategyId = String(query.strategy).trim();
  if (hasValue(query.direction)) where.direction = query.direction;
  if (hasValue(query.timeframe)) where.entryTimeframe = String(query.timeframe).trim();
  if (hasValue(query.result)) where.result = query.result;
  if (hasValue(query.followedPlan)) where.followedPlan = String(query.followedPlan) === 'true';
  if (hasValue(query.isAPlusSetup)) where.isAPlusSetup = String(query.isAPlusSetup) === 'true';
  if (hasValue(query.newsRelated)) where.newsRelated = String(query.newsRelated) === 'true';

  return where;
};

const getWeekday = (date, timezone = 'UTC') => {
  try {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(date);
  } catch (error) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
  }
};

const calculateSummary = (trades = []) => {
  const closedTrades = trades.filter((trade) => normalizeTradeResult(trade) !== 'OPEN');
  const wins = closedTrades.filter((trade) => normalizeTradeResult(trade) === 'WIN');
  const losses = closedTrades.filter((trade) => normalizeTradeResult(trade) === 'LOSS');
  const breakevens = closedTrades.filter((trade) => normalizeTradeResult(trade) === 'BREAKEVEN');
  const profitLossValues = trades.map((trade) => Number(trade.profitLossAmount || 0));
  const grossProfit = profitLossValues
    .filter((value) => value > 0)
    .reduce((total, value) => total + value, 0);
  const grossLoss = Math.abs(profitLossValues
    .filter((value) => value < 0)
    .reduce((total, value) => total + value, 0));
  const netRealisedProfitLoss = grossProfit - grossLoss;
  const averageWin = safeDivide(grossProfit, wins.length);
  const averageLoss = safeDivide(grossLoss, losses.length);
  const winRateDecimal = safeDivide(wins.length, closedTrades.length);
  const lossRateDecimal = safeDivide(losses.length, closedTrades.length);
  const riskRewardValues = trades
    .map((trade) => Number(trade.riskRewardRatio))
    .filter((value) => Number.isFinite(value));

  return {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: breakevens.length,
    winRate: round(winRateDecimal * 100, 1),
    lossRate: round(lossRateDecimal * 100, 1),
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    netRealisedProfitLoss: round(netRealisedProfitLoss),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : null,
    expectancy: round((winRateDecimal * averageWin) - (lossRateDecimal * averageLoss)),
    averageWin: round(averageWin),
    averageLoss: round(averageLoss),
    averageRiskRewardRatio: riskRewardValues.length
      ? round(riskRewardValues.reduce((total, value) => total + value, 0) / riskRewardValues.length, 2)
      : null,
  };
};

const calculateEquityCurve = (trades = [], startingBalance = null) => {
  let cumulativeProfitLoss = 0;
  return [...trades]
    .sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
    .map((trade) => {
      cumulativeProfitLoss += Number(trade.profitLossAmount || 0);
      const timestamp = getTradeTimestamp(trade);
      return {
        tradeId: trade.id,
        timestamp,
        label: timestamp.toISOString(),
        profitLoss: round(trade.profitLossAmount),
        cumulativeProfitLoss: round(cumulativeProfitLoss),
        equity: startingBalance === null ? round(cumulativeProfitLoss) : round(startingBalance + cumulativeProfitLoss),
      };
    });
};

const calculateDrawdown = (equityCurve = [], startingBalance = null) => {
  let runningPeak = startingBalance === null ? 0 : startingBalance;
  let maximumDrawdown = 0;
  const data = equityCurve.map((point) => {
    const equity = Number(point.equity || 0);
    runningPeak = Math.max(runningPeak, equity);
    const drawdownAmount = Math.max(0, runningPeak - equity);
    maximumDrawdown = Math.max(maximumDrawdown, drawdownAmount);

    return {
      timestamp: point.timestamp,
      tradeId: point.tradeId,
      cumulativeEquity: round(equity),
      runningPeak: round(runningPeak),
      drawdownAmount: round(drawdownAmount),
      drawdownPercentage: startingBalance && runningPeak > 0 ? round((drawdownAmount / runningPeak) * 100, 2) : null,
    };
  });

  return {
    maximumDrawdown: round(maximumDrawdown),
    data,
  };
};

const createGroupMetric = (key, trades, extra = {}) => ({
  key,
  label: key || 'UNSPECIFIED',
  ...calculateSummary(trades),
  ...extra,
});

const groupTrades = (trades = [], groupBy, timezone = 'UTC') => {
  if (!SUPPORTED_GROUPS.has(groupBy)) {
    const error = new Error('Unsupported analytics groupBy value');
    error.statusCode = 400;
    throw error;
  }

  if (groupBy === 'emotion') {
    const groups = new Map();
    trades.forEach((trade) => {
      const seenForTrade = new Set();
      (trade.emotionLogs || []).forEach((log) => {
        const key = log.emotion || 'UNSPECIFIED';
        if (!groups.has(key)) groups.set(key, { trades: [], recordCount: 0, tradeIds: new Set() });
        const group = groups.get(key);
        group.recordCount += 1;
        if (!seenForTrade.has(key)) {
          group.tradeIds.add(trade.id);
          group.trades.push(trade);
          seenForTrade.add(key);
        }
      });
    });

    return [...groups.entries()]
      .map(([key, group]) => createGroupMetric(key, group.trades, {
        associatedTradeCount: group.tradeIds.size,
        emotionLogCount: group.recordCount,
      }))
      .sort((a, b) => b.associatedTradeCount - a.associatedTradeCount);
  }

  if (groupBy === 'ruleViolation') {
    const groups = new Map();
    trades.forEach((trade) => {
      const seenForTrade = new Set();
      (trade.ruleViolations || []).forEach((violation) => {
        const key = violation.tradeRule?.name || violation.tradeRuleId || 'UNSPECIFIED';
        if (!groups.has(key)) groups.set(key, { trades: [], recordCount: 0, tradeIds: new Set() });
        const group = groups.get(key);
        group.recordCount += 1;
        if (!seenForTrade.has(key)) {
          group.tradeIds.add(trade.id);
          group.trades.push(trade);
          seenForTrade.add(key);
        }
      });
    });

    return [...groups.entries()]
      .map(([key, group]) => createGroupMetric(key, group.trades, {
        associatedTradeCount: group.tradeIds.size,
        violationCount: group.recordCount,
      }))
      .sort((a, b) => b.associatedTradeCount - a.associatedTradeCount);
  }

  const fieldByGroup = {
    pair: 'pair',
    session: 'session',
    direction: 'direction',
    timeframe: 'entryTimeframe',
  };
  const groups = new Map();

  trades.forEach((trade) => {
    const timestamp = getTradeTimestamp(trade);
    let key = 'UNSPECIFIED';
    let label = 'UNSPECIFIED';

    if (groupBy === 'weekday') {
      key = getWeekday(timestamp, timezone);
      label = key;
    } else if (groupBy === 'strategy') {
      key = trade.strategyId || 'UNSPECIFIED';
      label = trade.strategy?.name || 'UNSPECIFIED';
    } else if (groupBy === 'setup') {
      key = trade.setupId || 'UNSPECIFIED';
      label = trade.setup?.name || 'UNSPECIFIED';
    } else {
      key = trade[fieldByGroup[groupBy]] || 'UNSPECIFIED';
      label = key;
    }

    if (!groups.has(key)) groups.set(key, { label, trades: [] });
    groups.get(key).trades.push(trade);
  });

  return [...groups.entries()]
    .map(([key, groupData]) => createGroupMetric(key, groupData.trades, { label: groupData.label }))
    .sort((a, b) => b.totalTrades - a.totalTrades);
};

const calculateRiskRewardDistribution = (trades = []) => {
  const buckets = [
    { key: 'lt_1', label: '< 1R', min: -Infinity, max: 1, count: 0 },
    { key: '1_to_2', label: '1R - 2R', min: 1, max: 2, count: 0 },
    { key: '2_to_3', label: '2R - 3R', min: 2, max: 3, count: 0 },
    { key: 'gte_3', label: '3R+', min: 3, max: Infinity, count: 0 },
  ];

  trades.forEach((trade) => {
    const value = Number(trade.riskRewardRatio);
    if (!Number.isFinite(value)) return;
    const bucket = buckets.find((item) => value >= item.min && value < item.max);
    if (bucket) bucket.count += 1;
  });

  return buckets.map(({ min, max, ...bucket }) => bucket);
};

module.exports = {
  SUPPORTED_GROUPS,
  buildTradeWhere,
  calculateSummary,
  calculateEquityCurve,
  calculateDrawdown,
  calculateRiskRewardDistribution,
  groupTrades,
};
