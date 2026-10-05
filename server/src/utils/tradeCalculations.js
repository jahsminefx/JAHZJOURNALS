const hasValue = (value) => value !== undefined && value !== null && value !== '' && !Number.isNaN(Number(value));
const closedTradeResults = new Set(['WIN', 'LOSS', 'BREAKEVEN']);

const calculateRiskReward = (direction, entryPrice, stopLoss, takeProfit) => {
  if (!hasValue(entryPrice)) return { riskDistance: null, rewardDistance: null, riskRewardRatio: null };

  const entry = Number.parseFloat(entryPrice);
  const sl = hasValue(stopLoss) ? Number.parseFloat(stopLoss) : null;
  const tp = hasValue(takeProfit) ? Number.parseFloat(takeProfit) : null;

  let riskDistance = null;
  let rewardDistance = null;
  let riskRewardRatio = null;

  if (direction === 'BUY') {
    if (sl !== null) riskDistance = entry - sl;
    if (tp !== null) rewardDistance = tp - entry;
  } else if (direction === 'SELL') {
    if (sl !== null) riskDistance = sl - entry;
    if (tp !== null) rewardDistance = entry - tp;
  }

  if (riskDistance !== null && rewardDistance !== null && riskDistance > 0 && rewardDistance > 0) {
    riskRewardRatio = Number.parseFloat((rewardDistance / riskDistance).toFixed(2));
  }

  return {
    riskDistance: riskDistance !== null ? Number.parseFloat(riskDistance.toFixed(5)) : null,
    rewardDistance: rewardDistance !== null ? Number.parseFloat(rewardDistance.toFixed(5)) : null,
    riskRewardRatio,
  };
};

const calculateTradeResult = (status, profitLossAmount, fallbackResult = null) => {
  if (status === 'PLANNED' || status === 'ACTIVE' || status === 'CANCELLED') return 'OPEN';
  if (status !== 'CLOSED') {
    return closedTradeResults.has(fallbackResult) ? fallbackResult : 'OPEN';
  }

  if (hasValue(profitLossAmount)) {
    const pl = Number.parseFloat(profitLossAmount);
    if (pl > 0) return 'WIN';
    if (pl < 0) return 'LOSS';
    return 'BREAKEVEN';
  }

  if (closedTradeResults.has(fallbackResult)) return fallbackResult;
  return 'OPEN';
};

const normalizeTradeResult = (trade = {}) => calculateTradeResult(
  trade.status,
  trade.profitLossAmount,
  trade.result,
);

const calculateTradeDurationMinutes = (entryTime, exitTime) => {
  if (!entryTime || !exitTime) return null;
  const start = new Date(entryTime).getTime();
  const end = new Date(exitTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.max(0, (end - start) / (1000 * 60)); // explicitly in minutes
};

const normalizeTradeState = (trade) => {
  const normalized = { ...trade };

  if (normalized.status === 'PLANNED') {
    normalized.entryTime = null;
    normalized.entryPrice = null;
    normalized.exitTime = null;
    normalized.exitPrice = null;
    normalized.profitLossAmount = null;
    normalized.result = 'OPEN';
  } else if (normalized.status === 'ACTIVE') {
    if (!hasValue(normalized.entryTime)) normalized.entryTime = new Date();
    normalized.exitTime = null;
    normalized.exitPrice = null;
    normalized.profitLossAmount = null;
    normalized.result = 'OPEN';
  } else if (normalized.status === 'CLOSED') {
    if (hasValue(normalized.profitLossAmount)) {
      normalized.result = calculateTradeResult('CLOSED', normalized.profitLossAmount, normalized.result);
    } else {
      normalized.result = closedTradeResults.has(normalized.result) ? normalized.result : 'OPEN';
    }
  } else if (normalized.status === 'CANCELLED') {
    normalized.result = 'OPEN';
  }

  return normalized;
};

const calculateProfitLossPercentage = (profitLossAmount, initialBalance) => {
  if (!hasValue(profitLossAmount) || !hasValue(initialBalance) || Number(initialBalance) === 0) return null;
  const plPercent = (Number.parseFloat(profitLossAmount) / Number.parseFloat(initialBalance)) * 100;
  return Number.parseFloat(plPercent.toFixed(2));
};

const detectTradingSession = (entryTime) => {
  if (!entryTime) return null;
  const d = new Date(entryTime);
  if (Number.isNaN(d.getTime())) return null;

  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const decimalHour = hour + minute / 60;

  // London / NY Overlap: 12:00 - 16:00 UTC
  if (decimalHour >= 12 && decimalHour < 16) {
    return 'LONDON_NEW_YORK_OVERLAP';
  }
  // London Session: 07:00 - 12:00 UTC
  if (decimalHour >= 7 && decimalHour < 12) {
    return 'LONDON';
  }
  // New York Session: 16:00 - 21:00 UTC
  if (decimalHour >= 16 && decimalHour < 21) {
    return 'NEW_YORK';
  }
  // Asian Session: 21:00 - 07:00 UTC
  return 'ASIAN';
};

const getTradingSessionLabel = (session) => {
  switch (session) {
    case 'LONDON': return 'London';
    case 'NEW_YORK': return 'New York';
    case 'ASIAN': return 'Asian';
    case 'LONDON_NEW_YORK_OVERLAP': return 'London/NY Overlap';
    case 'OTHER': return 'Other';
    default: return session || '—';
  }
};

const resolveTradeRiskReward = (trade) => {
  if (!trade) return null;
  if (trade.riskRewardRatio !== null && trade.riskRewardRatio !== undefined && !Number.isNaN(Number(trade.riskRewardRatio)) && Number(trade.riskRewardRatio) !== 0) {
    return Number(Number(trade.riskRewardRatio).toFixed(2));
  }

  const entry = hasValue(trade.entryPrice) ? Number.parseFloat(trade.entryPrice) : null;
  const sl = hasValue(trade.stopLoss) ? Number.parseFloat(trade.stopLoss) : null;
  const tp = hasValue(trade.takeProfit) ? Number.parseFloat(trade.takeProfit) : null;
  const exit = hasValue(trade.exitPrice) ? Number.parseFloat(trade.exitPrice) : null;
  const dir = String(trade.direction || '').toUpperCase().trim();

  // 1. Realized RR from exitPrice and stopLoss
  if (entry !== null && sl !== null && exit !== null && entry !== sl) {
    const riskDistance = dir === 'BUY' ? (entry - sl) : (sl - entry);
    if (riskDistance > 0) {
      const rewardDistance = dir === 'BUY' ? (exit - entry) : (entry - exit);
      return Number.parseFloat((rewardDistance / riskDistance).toFixed(2));
    }
  }

  // 2. Planned RR from takeProfit and stopLoss
  if (entry !== null && sl !== null && tp !== null && entry !== sl) {
    const { riskRewardRatio } = calculateRiskReward(dir, entry, sl, tp);
    if (riskRewardRatio !== null) return riskRewardRatio;
  }

  // 3. PnL to Dollar Risk
  if (hasValue(trade.riskAmount) && Number.parseFloat(trade.riskAmount) > 0 && hasValue(trade.profitLossAmount)) {
    return Number.parseFloat((Number.parseFloat(trade.profitLossAmount) / Number.parseFloat(trade.riskAmount)).toFixed(2));
  }

  return null;
};

module.exports = {
  calculateRiskReward,
  calculateTradeResult,
  normalizeTradeResult,
  calculateTradeDurationMinutes,
  calculateProfitLossPercentage,
  normalizeTradeState,
  detectTradingSession,
  getTradingSessionLabel,
  resolveTradeRiskReward,
};
