const hasValue = (value) => value !== undefined && value !== null && value !== '' && !Number.isNaN(Number(value));

export const calculateRiskReward = (direction, entryPrice, stopLoss, takeProfit) => {
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

export const calculatePips = ({ pair, direction, entryPrice, exitPrice, pips } = {}) => {
  if (pips !== undefined && pips !== null && pips !== '' && !Number.isNaN(Number(pips))) {
    return Math.round(Number(pips) * 10) / 10;
  }

  const entry = Number(entryPrice);
  const exit = Number(exitPrice);

  if (!entry || !exit || Number.isNaN(entry) || Number.isNaN(exit) || !pair || !direction) {
    return null;
  }

  const pairStr = String(pair).toUpperCase().trim();
  let pipSize = 0.0001; // Default Forex pip size

  if (pairStr.includes('JPY')) {
    pipSize = 0.01;
  } else if (pairStr.startsWith('XAU') || pairStr.includes('GOLD')) {
    pipSize = 0.1;
  } else if (pairStr.startsWith('XAG') || pairStr.includes('SILVER')) {
    pipSize = 0.01;
  } else if (
    pairStr.includes('BTC') ||
    pairStr.includes('ETH') ||
    pairStr.includes('US30') ||
    pairStr.includes('NAS100') ||
    pairStr.includes('SPX') ||
    pairStr.includes('GER30') ||
    pairStr.includes('DE30') ||
    pairStr.includes('UK100') ||
    pairStr.includes('US500')
  ) {
    pipSize = 1.0;
  }

  const diff = String(direction).toUpperCase().trim() === 'BUY' ? exit - entry : entry - exit;
  const calculatedPips = diff / pipSize;

  return Math.round(calculatedPips * 10) / 10;
};

export const detectTradingSession = (entryTime) => {
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

export const getTradingSessionLabel = (session, fallback = 'N/A') => {
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

export const parseRiskRewardInput = (raw) => {
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

export const formatRiskReward = (value, fallback = 'N/A') => {
  if (!hasValue(value)) return fallback;
  const num = Number.parseFloat(Number(value).toFixed(2));
  if (!Number.isFinite(num)) return fallback;
  return `1 : ${num === 0 ? 0 : num}`;
};

export const isStopLossAtOrPastEntry = (direction, entryPrice, stopLoss) => {
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

export const resolveEffectiveRiskStopLoss = (direction, entryPrice, stopLoss, initialStopLoss) => {
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

export const resolveTradePlannedRiskReward = (trade) => {
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

export const resolveTradeRiskReward = (trade) => {
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

  // 1. Realized RR from exitPrice and effective stopLoss
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
  if (trade.riskAmount && Number.parseFloat(trade.riskAmount) > 0 && trade.profitLossAmount !== null && trade.profitLossAmount !== undefined) {
    const ratio = Number.parseFloat((Number.parseFloat(trade.profitLossAmount) / Number.parseFloat(trade.riskAmount)).toFixed(2));
    return ratio === 0 ? 0 : ratio;
  }

  return null;
};

export const resolveTradePips = (trade) => {
  if (!trade) return null;
  if (trade.pips !== null && trade.pips !== undefined && trade.pips !== '' && !Number.isNaN(Number(trade.pips))) {
    return Math.round(Number(trade.pips) * 10) / 10;
  }
  return calculatePips({
    pair: trade.pair,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
  });
};

export const calculateTradeResult = (status, profitLossAmount, tolerance = 2.50) => {
  if (status === 'PLANNED' || status === 'ACTIVE' || status === 'CANCELLED') return 'OPEN';
  if (profitLossAmount === undefined || profitLossAmount === null || profitLossAmount === '') return 'OPEN';

  const pl = Number.parseFloat(profitLossAmount);
  if (Number.isNaN(pl)) return 'OPEN';
  const tol = Number(tolerance) >= 0 ? Number(tolerance) : 2.50;
  if (pl > tol) return 'WIN';
  if (pl < -tol) return 'LOSS';
  return 'BREAKEVEN';
};
