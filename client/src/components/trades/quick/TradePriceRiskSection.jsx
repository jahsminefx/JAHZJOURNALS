import React from 'react';
import SignedNumericInput from '../../common/SignedNumericInput';
import { calculatePositionSize } from '../../../services/riskCalculatorService';
import { Calculator } from 'lucide-react';
import toast from 'react-hot-toast';

const TradePriceRiskSection = ({ register, status, setValue, watch }) => {
  const pair = watch('pair');
  const direction = watch('direction');
  const entryPrice = watch('entryPrice');
  const stopLoss = watch('stopLoss');
  const takeProfit = watch('takeProfit');

  const handleAutoCalculatePositionSize = () => {
    if (!entryPrice || !stopLoss) {
      toast.error('Please enter Entry Price and Stop Loss first');
      return;
    }

    const result = calculatePositionSize({
      balance: 10000, // Fallback balance or standard 1%
      riskPercent: 1.0,
      entryPrice,
      stopLoss,
      takeProfit,
      direction: direction || 'BUY',
      pair: pair || 'EURUSD',
    });

    if (result.isInvalidSetup) {
      toast.error(result.setupErrorMessage || 'Invalid setup price levels');
      return;
    }

    if (result.safeLotSize > 0) {
      setValue('lotSize', result.safeLotSize);
      setValue('riskAmount', result.actualCapitalAtRisk);
      toast.success(`Calculated: ${result.safeLotSize} lots ($${result.actualCapitalAtRisk} risk at ${result.stopLossPips} pips)`);
    } else {
      toast.error('Unable to calculate lot size from given prices');
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
        <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Price and Risk</h3>
        <button
          type="button"
          onClick={handleAutoCalculatePositionSize}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all"
        >
          <Calculator size={14} />
          <span>Calculate Position Size</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <label className="text-sm text-muted">
          {status === 'PLANNED' ? 'Intended Entry Price' : 'Entry Price'}
          <input type="number" step="0.00001" inputMode="decimal" min="0" {...register('entryPrice')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
        </label>
        
        <label className="text-sm text-muted">
          Stop Loss
          <input type="number" step="0.00001" inputMode="decimal" min="0" {...register('stopLoss')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
        </label>
        
        <label className="text-sm text-muted">
          Take Profit
          <input type="number" step="0.00001" inputMode="decimal" min="0" {...register('takeProfit')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
        </label>

        <label className="text-sm text-muted">
          Position Size (Lots)
          <input type="number" step="0.01" inputMode="decimal" min="0" {...register('lotSize')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
        </label>

        <label className="text-sm text-muted">
          {status === 'PLANNED' ? 'Planned Risk Amount' : 'Risk Amount'} ($)
          <input type="number" step="0.01" inputMode="decimal" min="0" {...register('riskAmount')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
        </label>

        {status === 'CLOSED' && (
          <>
            <label className="text-sm text-muted">
              Exit Price
              <input type="number" step="0.00001" inputMode="decimal" min="0" {...register('exitPrice')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
            </label>
            <SignedNumericInput
              label="Realised P/L ($)"
              name="profitLossAmount"
              register={register}
              setValue={setValue}
              watch={watch}
              step="0.01"
              placeholder="0.00"
            />
          </>
        )}
      </div>
    </section>
  );
};

export default TradePriceRiskSection;
