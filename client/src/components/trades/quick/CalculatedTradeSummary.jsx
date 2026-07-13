import React from 'react';
import { calculateRiskReward, calculateTradeResult } from '../../../utils/tradeCalculations';

const CalculatedTradeSummary = ({ watch, status }) => {
  const direction = watch('direction');
  const entryPrice = watch('entryPrice');
  const stopLoss = watch('stopLoss');
  const takeProfit = watch('takeProfit');
  const profitLossAmount = watch('profitLossAmount');

  const { riskDistance, rewardDistance, riskRewardRatio } = calculateRiskReward(direction, entryPrice, stopLoss, takeProfit);
  const result = calculateTradeResult(status, profitLossAmount);

  return (
    <section className="bg-surface rounded-xl p-4 border border-border shadow-inner">
      <h4 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">Calculated Summary</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="block text-xs text-muted">Risk Distance</span>
          <span className="block text-base text-foreground font-medium">{riskDistance ?? '-'}</span>
        </div>
        <div>
          <span className="block text-xs text-muted">Reward Distance</span>
          <span className="block text-base text-foreground font-medium">{rewardDistance ?? '-'}</span>
        </div>
        <div>
          <span className="block text-xs text-muted">Risk / Reward</span>
          <span className="block text-base text-green-400 font-medium">
            {riskRewardRatio ? `1 : ${riskRewardRatio}` : '-'}
          </span>
        </div>
        <div>
          <span className="block text-xs text-muted">Auto Result</span>
          <span className={`block text-base font-medium ${result === 'WIN' ? 'text-green-500' : result === 'LOSS' ? 'text-red-500' : 'text-blue-400'}`}>
            {result}
          </span>
        </div>
      </div>
    </section>
  );
};

export default CalculatedTradeSummary;
