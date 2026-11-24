import React, { useEffect, useRef } from 'react';
import SignedNumericInput from '../../common/SignedNumericInput';
import { calculatePositionSize } from '../../../services/riskCalculatorService';
import {
  isStopLossAtOrPastEntry,
  parseRiskRewardInput,
  resolveTradePlannedRiskReward,
} from '../../../utils/tradeCalculations';
import { Calculator, Info, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

const inputStyle = "mt-1.5 block w-full bg-surface-muted border border-border rounded-xl py-2.5 px-3.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 focus:bg-surface transition-all shadow-sm";

const TradePriceRiskSection = ({ register, status, setValue, watch }) => {
  const pair = watch('pair');
  const direction = watch('direction');
  const entryPrice = watch('entryPrice');
  const stopLoss = watch('stopLoss');
  const takeProfit = watch('takeProfit');
  const exitPrice = watch('exitPrice');
  const riskAmount = watch('riskAmount');
  const profitLossAmount = watch('profitLossAmount');
  const initialStopLoss = watch('initialStopLoss');
  const riskRewardRatio = watch('riskRewardRatio');
  const isManualRiskReward = Boolean(watch('isManualRiskReward'));
  const breakEvenActivated = Boolean(watch('breakEvenActivated'));

  const rrValidation = parseRiskRewardInput(riskRewardRatio);
  const stopAtBe = breakEvenActivated || isStopLossAtOrPastEntry(direction, entryPrice, stopLoss);
  const isRREmpty = riskRewardRatio === '' || riskRewardRatio === null || riskRewardRatio === undefined;

  const priceSig = JSON.stringify([
    direction || '',
    entryPrice ?? '',
    stopLoss ?? '',
    takeProfit ?? '',
    status || '',
    status === 'CLOSED' ? (exitPrice ?? '') : '',
    riskAmount ?? '',
    status === 'CLOSED' ? (profitLossAmount ?? '') : '',
  ]);
  const prevPriceSigRef = useRef(priceSig);
  const mountedRef = useRef(false);

  const computeAutoRR = () => resolveTradePlannedRiskReward({
    direction,
    entryPrice,
    stopLoss,
    initialStopLoss,
    takeProfit,
    exitPrice: status === 'CLOSED' ? exitPrice : null,
    riskAmount,
    profitLossAmount: status === 'CLOSED' ? profitLossAmount : null,
  });

  useEffect(() => {
    const pricesChanged = mountedRef.current && prevPriceSigRef.current !== priceSig;
    prevPriceSigRef.current = priceSig;
    const isInitialMount = !mountedRef.current;
    mountedRef.current = true;

    if (isManualRiskReward) return;
    if (isInitialMount && !isRREmpty) return;
    if (!isInitialMount && !pricesChanged && !isRREmpty) return;

    const autoRR = computeAutoRR();
    const nextStr = autoRR !== null && autoRR !== undefined ? String(autoRR) : '';
    if (String(riskRewardRatio ?? '') !== nextStr) {
      setValue('riskRewardRatio', nextStr, { shouldDirty: pricesChanged });
    }
  }, [priceSig, isManualRiskReward]);

  const handleResetToAuto = () => {
    const autoRR = computeAutoRR();
    setValue('isManualRiskReward', false, { shouldDirty: true });
    setValue('riskRewardRatio', autoRR !== null && autoRR !== undefined ? String(autoRR) : '', { shouldDirty: true });
  };

  const handleRiskRewardChange = (e) => {
    const val = e.target.value;
    setValue('riskRewardRatio', val, { shouldDirty: true });
    setValue('isManualRiskReward', val.trim() !== '', { shouldDirty: true });
  };

  const handleRiskRewardBlur = () => {
    const trimmed = String(riskRewardRatio ?? '').trim();
    if (!trimmed) return;
    const parsed = parseRiskRewardInput(trimmed);
    if (parsed.valid && parsed.value !== null && String(parsed.value) !== trimmed) {
      setValue('riskRewardRatio', String(parsed.value), { shouldDirty: true });
    }
  };

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

        <div>
          <div className="flex items-center justify-between mb-1 gap-2">
            <label htmlFor="quick-risk-reward" className="block text-xs font-bold uppercase tracking-wider text-muted">
              Risk / Reward Ratio
            </label>
            {isManualRiskReward ? (
              <button
                type="button"
                onClick={handleResetToAuto}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                title="Reset R:R back to automatic calculation"
              >
                <RotateCcw size={11} />
                <span>Reset to Auto</span>
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-muted">Auto</span>
            )}
          </div>
          <div className={`mt-1.5 flex items-center bg-surface-muted border rounded-xl overflow-hidden transition-all shadow-sm focus-within:bg-surface ${
            !rrValidation.valid
              ? 'border-rose-500 focus-within:border-rose-500'
              : 'border-border focus-within:border-emerald-500'
          }`}>
            <span className="pl-3.5 pr-1.5 text-sm font-bold text-muted select-none shrink-0">1 :</span>
            <input
              id="quick-risk-reward"
              type="text"
              inputMode="decimal"
              value={riskRewardRatio ?? ''}
              onChange={handleRiskRewardChange}
              onBlur={handleRiskRewardBlur}
              placeholder="e.g. 2.5"
              className="w-full bg-transparent py-2.5 pr-3.5 text-sm text-foreground focus:outline-none"
            />
          </div>
          {!rrValidation.valid ? (
            <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{rrValidation.error}</p>
          ) : stopAtBe && isRREmpty ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Info size={12} className="shrink-0" />
              <span>Stop loss is at break-even — enter your planned R:R above if needed.</span>
            </p>
          ) : null}
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
