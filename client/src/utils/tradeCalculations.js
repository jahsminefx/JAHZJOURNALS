export const calculateRiskReward = (direction, entryPrice, stopLoss, takeProfit) => {
  if (!entryPrice) return { riskDistance: null, rewardDistance: null, riskRewardRatio: null };

  const entry = Number.parseFloat(entryPrice);
  const sl = stopLoss ? Number.parseFloat(stopLoss) : null;
  const tp = takeProfit ? Number.parseFloat(takeProfit) : null;

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

export const getTradingSessionLabel = (session) => {
  switch (session) {
    case 'LONDON': return 'London';
    case 'NEW_YORK': return 'New York';
    case 'ASIAN': return 'Asian';
    case 'LONDON_NEW_YORK_OVERLAP': return 'London/NY Overlap';
    case 'OTHER': return 'Other';
    default: return session || '—';
  }
};

export const resolveTradeRiskReward = (trade) => {
  if (!trade) return null;
  if (trade.riskRewardRatio !== null && trade.riskRewardRatio !== undefined && !Number.isNaN(Number(trade.riskRewardRatio)) && Number(trade.riskRewardRatio) !== 0) {
    return Number(Number(trade.riskRewardRatio).toFixed(2));
  }

  const entry = trade.entryPrice !== null && trade.entryPrice !== undefined && trade.entryPrice !== '' ? Number.parseFloat(trade.entryPrice) : null;
  const sl = trade.stopLoss !== null && trade.stopLoss !== undefined && trade.stopLoss !== '' ? Number.parseFloat(trade.stopLoss) : null;
  const tp = trade.takeProfit !== null && trade.takeProfit !== undefined && trade.takeProfit !== '' ? Number.parseFloat(trade.takeProfit) : null;
  const exit = trade.exitPrice !== null && trade.exitPrice !== undefined && trade.exitPrice !== '' ? Number.parseFloat(trade.exitPrice) : null;
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
  if (trade.riskAmount && Number.parseFloat(trade.riskAmount) > 0 && trade.profitLossAmount !== null && trade.profitLossAmount !== undefined) {
    return Number.parseFloat((Number.parseFloat(trade.profitLossAmount) / Number.parseFloat(trade.riskAmount)).toFixed(2));
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

export const calculateTradeResult = (status, profitLossAmount) => {
  if (status === 'PLANNED' || status === 'ACTIVE') return 'OPEN';
  if (profitLossAmount === undefined || profitLossAmount === null || profitLossAmount === '') return 'OPEN';

  const pl = Number.parseFloat(profitLossAmount);
  if (Number.isNaN(pl)) return 'OPEN';
  if (pl > 0) return 'WIN';
  if (pl < 0) return 'LOSS';
  return 'BREAKEVEN';
};
