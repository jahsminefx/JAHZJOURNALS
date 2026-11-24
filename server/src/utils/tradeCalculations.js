const hasValue = (value) => value !== undefined && value !== null && value !== '' && !Number.isNaN(Number(value));
const closedTradeResults = new Set(['WIN', 'LOSS', 'BREAKEVEN']);
const { classifyTrade } = require('../services/tradeClassificationService');

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

const calculateTradeResult = (status, profitLossAmount, fallbackResult = null, options = {}) => {
  if (status === 'PLANNED' || status === 'ACTIVE' || status === 'CANCELLED') return 'OPEN';
  if (status !== 'CLOSED') {
    return closedTradeResults.has(fallbackResult) ? fallbackResult : 'OPEN';
  }

  // Preserve explicit user outcome if provided as fallbackResult and no profitLossAmount
  if (!hasValue(profitLossAmount) && closedTradeResults.has(fallbackResult)) {
    return fallbackResult;
  }

  const classification = classifyTrade({
    status: 'CLOSED',
    profitLossAmount,
    manualResultOverride: options.isManualResultOverride ? fallbackResult : null,
    ...options,
  });

  return classification.result;
};

const normalizeTradeResult = (trade = {}) => {
  if (!trade) return 'OPEN';
  if (trade.status === 'PLANNED' || trade.status === 'ACTIVE' || trade.status === 'CANCELLED') return 'OPEN';

  // If trade already has an explicit stored result like 'BREAKEVEN', honor it
  if (trade.result === 'BREAKEVEN') return 'BREAKEVEN';

  return calculateTradeResult(
    trade.status,
    trade.profitLossAmount,
    trade.result,
    {
      direction: trade.direction,
      pair: trade.pair,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss,
      initialStopLoss: trade.initialStopLoss,
      lotSize: trade.lotSize,
      grossProfit: trade.grossProfit,
      commission: trade.commission,
      swap: trade.swap,
      fees: trade.fees,
      breakEvenActivated: trade.breakEvenActivated,
      breakEvenPrice: trade.breakEvenPrice,
      breakEvenEvidenceSource: trade.breakEvenEvidenceSource,
      breakEvenEvidenceStatus: trade.breakEvenEvidenceStatus,
      slTpHistory: trade.slTpHistory,
      isManualResultOverride: trade.isManualResultOverride,
    }
  );
};

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
    const classification = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: normalized.profitLossAmount,
      grossProfit: normalized.grossProfit,
      commission: normalized.commission,
      swap: normalized.swap,
      fees: normalized.fees,
      direction: normalized.direction,
      pair: normalized.pair,
      entryPrice: normalized.entryPrice,
      exitPrice: normalized.exitPrice,
      stopLoss: normalized.stopLoss,
      initialStopLoss: normalized.initialStopLoss,
      lotSize: normalized.lotSize,
      breakEvenActivated: normalized.breakEvenActivated,
      breakEvenPrice: normalized.breakEvenPrice,
      breakEvenEvidenceSource: normalized.breakEvenEvidenceSource,
      breakEvenEvidenceStatus: normalized.breakEvenEvidenceStatus,
      slTpHistory: normalized.slTpHistory,
      manualResultOverride: normalized.isManualResultOverride ? normalized.result : null,
    });
    normalized.result = classification.result;
    normalized.breakEvenActivated = classification.breakEvenActivated;
    normalized.breakEvenPrice = classification.breakEvenPrice;
    normalized.breakEvenEvidenceSource = classification.breakEvenEvidenceSource;
    normalized.breakEvenEvidenceStatus = classification.breakEvenEvidenceStatus;
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

const getTradingSessionLabel = (session, fallback = 'N/A') => {
  if (!session) return fallback;
  switch (session) {
    case 'LONDON': return 'London';
    case 'NEW_YORK': return 'New York';
    case 'ASIAN': return 'Asian';
    case 'LONDON_NEW_YORK_OVERLAP': return 'London/NY Overlap';
    case 'OTHER': return 'Other';
    default: return String(session).replace(/_/g, ' ');
  }
};

const parseRiskRewardInput = (raw) => {
  if (raw === null || raw === undefined) {
    return { valid: true, value: null };
  }
  const str = String(raw).trim();
  if (!str) {
    return { valid: true, value: null };
  }

  const ratioMatch = str.match(/^1\s*:\s*([+-]?\d+(?:\.\d+)?|\.\d+)\s*r?$/i);
  const rMatch = !ratioMatch ? str.match(/^([+-]?\d+(?:\.\d+)?|\.\d+)\s*r?$/i) : null;
  const numericStr = ratioMatch ? ratioMatch[1] : (rMatch ? rMatch[1] : null);

  if (numericStr === null) {
    return {
      valid: false,
      value: null,
      error: 'Risk/Reward ratio must be between 0 and 100 (e.g., 2.5 or 1:2.5).',
    };
  }

  const num = Number(numericStr);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return {
      valid: false,
      value: null,
      error: 'Risk/Reward ratio must be between 0 and 100 (e.g., 2.5 or 1:2.5).',
    };
  }

  const rounded = Number.parseFloat(num.toFixed(2));
  return { valid: true, value: rounded === 0 ? 0 : rounded };
};

const formatRiskReward = (value, fallback = 'N/A') => {
  if (!hasValue(value)) return fallback;
  const num = Number.parseFloat(Number(value).toFixed(2));
  if (!Number.isFinite(num)) return fallback;
  return `1 : ${num === 0 ? 0 : num}`;
};

const isStopLossAtOrPastEntry = (direction, entryPrice, stopLoss) => {
  if (!hasValue(entryPrice) || !hasValue(stopLoss)) return false;
  const entry = Number.parseFloat(entryPrice);
  const sl = Number.parseFloat(stopLoss);
  const dir = String(direction || '').toUpperCase().trim();
  if (!Number.isFinite(entry) || !Number.isFinite(sl) || !dir) return false;
  const epsilon = 1e-6;
  if (dir === 'BUY') return sl >= entry - epsilon;
  if (dir === 'SELL') return sl <= entry + epsilon;
  return false;
};

const resolveEffectiveRiskStopLoss = (direction, entryPrice, stopLoss, initialStopLoss) => {
  const dir = String(direction || '').toUpperCase().trim();
  const entry = hasValue(entryPrice) ? Number.parseFloat(entryPrice) : null;
  const sl = hasValue(stopLoss) ? Number.parseFloat(stopLoss) : null;
  const initialSl = hasValue(initialStopLoss) ? Number.parseFloat(initialStopLoss) : null;

  if (entry === null || !dir) {
    return { stopLoss: null, riskDistance: null, usedInitialStopLoss: false };
  }

  if (sl !== null) {
    const slDist = dir === 'BUY' ? (entry - sl) : (sl - entry);
    if (slDist > 0) {
      return { stopLoss: sl, riskDistance: slDist, usedInitialStopLoss: false };
    }
  }

  if (initialSl !== null) {
    const initDist = dir === 'BUY' ? (entry - initialSl) : (initialSl - entry);
    if (initDist > 0) {
      return { stopLoss: initialSl, riskDistance: initDist, usedInitialStopLoss: true };
    }
  }

  return { stopLoss: null, riskDistance: null, usedInitialStopLoss: false };
};

const resolveTradePlannedRiskReward = (trade) => {
  if (!trade) return null;

  if (hasValue(trade.riskRewardRatio)) {
    const num = Number.parseFloat(Number(trade.riskRewardRatio).toFixed(2));
    if (Number.isFinite(num) && num >= 0) {
      const clean = num === 0 ? 0 : num;
      if (trade.isManualRiskReward === true || clean > 0 || trade.result === 'BREAKEVEN') {
        return clean;
      }
    }
  }

  const entry = hasValue(trade.entryPrice) ? Number.parseFloat(trade.entryPrice) : null;
  const tp = hasValue(trade.takeProfit) ? Number.parseFloat(trade.takeProfit) : null;
  const exit = hasValue(trade.exitPrice) ? Number.parseFloat(trade.exitPrice) : null;
  const dir = String(trade.direction || '').toUpperCase().trim();

  const { stopLoss: effectiveSl, riskDistance: effectiveRiskDistance } = resolveEffectiveRiskStopLoss(
    dir,
    entry,
    trade.stopLoss,
    trade.initialStopLoss
  );

  // 1. Planned RR from takeProfit and effective stopLoss (current SL, or initialStopLoss if SL moved to BE)
  if (entry !== null && effectiveSl !== null && tp !== null) {
    const { riskRewardRatio } = calculateRiskReward(dir, entry, effectiveSl, tp);
    if (riskRewardRatio !== null && riskRewardRatio >= 0) {
      return riskRewardRatio === 0 ? 0 : riskRewardRatio;
    }
  }

  // 2. Non-negative realized RR from exitPrice and effective stopLoss
  if (entry !== null && effectiveSl !== null && exit !== null && effectiveRiskDistance > 0) {
    const rewardDistance = dir === 'BUY' ? (exit - entry) : (entry - exit);
    if (rewardDistance >= 0) {
      const ratio = Number.parseFloat((rewardDistance / effectiveRiskDistance).toFixed(2));
      return ratio === 0 ? 0 : ratio;
    }
  }

  // 3. Non-negative PnL to Dollar Risk
  if (hasValue(trade.riskAmount) && Number.parseFloat(trade.riskAmount) > 0 && hasValue(trade.profitLossAmount)) {
    const pnl = Number.parseFloat(trade.profitLossAmount);
    if (pnl >= 0) {
      const ratio = Number.parseFloat((pnl / Number.parseFloat(trade.riskAmount)).toFixed(2));
      return ratio === 0 ? 0 : ratio;
    }
  }

  return null;
};

const resolveTradeRiskReward = (trade) => {
  if (!trade) return null;

  if (trade.isManualRiskReward === true && hasValue(trade.riskRewardRatio)) {
    const manualVal = Number.parseFloat(Number(trade.riskRewardRatio).toFixed(2));
    if (Number.isFinite(manualVal)) {
      return manualVal === 0 ? 0 : manualVal;
    }
  }

  if (trade.riskRewardRatio !== null && trade.riskRewardRatio !== undefined && !Number.isNaN(Number(trade.riskRewardRatio)) && Number(trade.riskRewardRatio) !== 0) {
    return Number(Number(trade.riskRewardRatio).toFixed(2));
  }

  const entry = hasValue(trade.entryPrice) ? Number.parseFloat(trade.entryPrice) : null;
  const tp = hasValue(trade.takeProfit) ? Number.parseFloat(trade.takeProfit) : null;
  const exit = hasValue(trade.exitPrice) ? Number.parseFloat(trade.exitPrice) : null;
  const dir = String(trade.direction || '').toUpperCase().trim();

  const { stopLoss: effectiveSl, riskDistance: effectiveRiskDistance } = resolveEffectiveRiskStopLoss(
    dir,
    entry,
    trade.stopLoss,
    trade.initialStopLoss
  );

  // 1. Realized RR from exitPrice and effective stopLoss (falls back to initialStopLoss if SL moved to BE)
  if (entry !== null && effectiveSl !== null && exit !== null && effectiveRiskDistance > 0) {
    const rewardDistance = dir === 'BUY' ? (exit - entry) : (entry - exit);
    const ratio = Number.parseFloat((rewardDistance / effectiveRiskDistance).toFixed(2));
    return ratio === 0 ? 0 : ratio;
  }

  // 2. Planned RR from takeProfit and effective stopLoss
  if (entry !== null && effectiveSl !== null && tp !== null) {
    const { riskRewardRatio } = calculateRiskReward(dir, entry, effectiveSl, tp);
    if (riskRewardRatio !== null) return riskRewardRatio;
  }

  // 3. PnL to Dollar Risk
  if (hasValue(trade.riskAmount) && Number.parseFloat(trade.riskAmount) > 0 && hasValue(trade.profitLossAmount)) {
    const ratio = Number.parseFloat((Number.parseFloat(trade.profitLossAmount) / Number.parseFloat(trade.riskAmount)).toFixed(2));
    return ratio === 0 ? 0 : ratio;
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
  parseRiskRewardInput,
  formatRiskReward,
  isStopLossAtOrPastEntry,
  resolveEffectiveRiskStopLoss,
  resolveTradePlannedRiskReward,
  resolveTradeRiskReward,
};
