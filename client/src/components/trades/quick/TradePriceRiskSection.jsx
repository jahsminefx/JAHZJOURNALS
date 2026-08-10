import React from 'react';
import SignedNumericInput from '../../common/SignedNumericInput';

const TradePriceRiskSection = ({ register, status, setValue, watch }) => {
  return (
    <section>
      <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400 border-b border-border pb-2 mb-4">Price and Risk</h3>
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
