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

export const calculateTradeResult = (status, profitLossAmount) => {
  if (status === 'PLANNED' || status === 'ACTIVE') return 'OPEN';
  if (!profitLossAmount) return 'OPEN';

  const pl = Number.parseFloat(profitLossAmount);
  if (pl > 0) return 'WIN';
  if (pl < 0) return 'LOSS';
  return 'BREAKEVEN';
};
