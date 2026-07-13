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

module.exports = {
  calculateRiskReward,
  calculateTradeResult,
  normalizeTradeResult,
  calculateTradeDurationMinutes,
  calculateProfitLossPercentage,
  normalizeTradeState,
};
