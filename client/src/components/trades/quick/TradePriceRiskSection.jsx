import React from 'react';
import SignedNumericInput from '../../common/SignedNumericInput';
import { calculatePositionSize } from '../../../services/riskCalculatorService';
import { Calculator } from 'lucide-react';
import toast from 'react-hot-toast';

const inputStyle = "mt-1.5 block w-full bg-surface-muted border border-border rounded-xl py-2.5 px-3.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 focus:bg-surface transition-all shadow-sm";

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
      balance: 10000,
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
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-5">
        <h3 className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Price and Risk</h3>
        <button
          type="button"
          onClick={handleAutoCalculatePositionSize}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all shadow-sm"
        >
          <Calculator size={14} />
          <span>Calculate Position Size</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div>
          <label htmlFor="quick-entry-price" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            {status === 'PLANNED' ? 'Intended Entry Price' : 'Entry Price'}
          </label>
          <input id="quick-entry-price" type="number" step="0.00001" inputMode="decimal" min="0" {...register('entryPrice')} className={inputStyle} />
        </div>
        
        <div>
          <label htmlFor="quick-stop-loss" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Stop Loss
          </label>
          <input id="quick-stop-loss" type="number" step="0.00001" inputMode="decimal" min="0" {...register('stopLoss')} className={inputStyle} />
        </div>
        
        <div>
          <label htmlFor="quick-take-profit" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Take Profit
          </label>
          <input id="quick-take-profit" type="number" step="0.00001" inputMode="decimal" min="0" {...register('takeProfit')} className={inputStyle} />
        </div>

        <div>
          <label htmlFor="quick-lot-size" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Position Size (Lots)
          </label>
          <input id="quick-lot-size" type="number" step="0.01" inputMode="decimal" min="0" {...register('lotSize')} className={inputStyle} />
        </div>

        <div>
          <label htmlFor="quick-risk-amount" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            {status === 'PLANNED' ? 'Planned Risk Amount' : 'Risk Amount'} ($)
          </label>
          <input id="quick-risk-amount" type="number" step="0.01" inputMode="decimal" min="0" {...register('riskAmount')} className={inputStyle} />
        </div>

        {status === 'CLOSED' && (
          <>
            <div>
              <label htmlFor="quick-exit-price" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Exit Price
              </label>
              <input id="quick-exit-price" type="number" step="0.00001" inputMode="decimal" min="0" {...register('exitPrice')} className={inputStyle} />
            </div>
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
