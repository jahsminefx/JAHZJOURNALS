import React from 'react';
import {
  calculateRiskReward,
  calculateTradeResult,
  formatRiskReward,
  parseRiskRewardInput,
  resolveTradePlannedRiskReward,
} from '../../../utils/tradeCalculations';

const CalculatedTradeSummary = ({ watch, status }) => {
  const direction = watch('direction');
  const entryPrice = watch('entryPrice');
  const stopLoss = watch('stopLoss');
  const takeProfit = watch('takeProfit');
  const exitPrice = watch('exitPrice');
  const riskAmount = watch('riskAmount');
  const profitLossAmount = watch('profitLossAmount');
  const initialStopLoss = watch('initialStopLoss');
  const riskRewardRatioInput = watch('riskRewardRatio');
  const isManualRiskReward = Boolean(watch('isManualRiskReward'));

  const { riskDistance, rewardDistance } = calculateRiskReward(direction, entryPrice, stopLoss, takeProfit);
  const parsedManualRR = parseRiskRewardInput(riskRewardRatioInput);
  const effectiveRR = (parsedManualRR.valid && parsedManualRR.value !== null)
    ? parsedManualRR.value
    : resolveTradePlannedRiskReward({
        direction,
        entryPrice,
        stopLoss,
        initialStopLoss,
        takeProfit,
        exitPrice: status === 'CLOSED' ? exitPrice : null,
        riskAmount,
        profitLossAmount: status === 'CLOSED' ? profitLossAmount : null,
      });
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
          <div className="flex items-center gap-1.5">
            <span className="block text-xs text-muted">Risk / Reward</span>
            {effectiveRR !== null && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-muted border border-border text-muted">
                {isManualRiskReward ? 'Manual' : 'Auto'}
              </span>
            )}
          </div>
          <span className="block text-base text-emerald-600 dark:text-emerald-400 font-medium">
            {formatRiskReward(effectiveRR, '-')}
          </span>
        </div>
        <div>
          <span className="block text-xs text-muted">Auto Result</span>
          <span className={`block text-base font-medium ${
            result === 'WIN' ? 'text-emerald-600 dark:text-emerald-400' :
            result === 'LOSS' ? 'text-red-600 dark:text-red-400' :
            result === 'BREAKEVEN' ? 'text-amber-500 dark:text-amber-400' :
            'text-blue-600 dark:text-blue-400'
          }`}>
            {result}
          </span>
        </div>
      </div>
    </section>
  );
};

export default CalculatedTradeSummary;
