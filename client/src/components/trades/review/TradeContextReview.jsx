import React from 'react';

const TradeContextReview = ({ register }) => {
  return (
    <section className="bg-surface-muted p-6 rounded-xl border border-border space-y-4">
      <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Trade Context</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <label className="text-sm text-muted">
          Session
          <select {...register('session')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
            <option value="">Unspecified</option>
            <option value="ASIAN">Asian</option>
            <option value="LONDON">London</option>
            <option value="NEW_YORK">New York</option>
            <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Higher Timeframe
          <input {...register('higherTimeframe')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" placeholder="e.g. 4H" />
        </label>
        <label className="text-sm text-muted">
          Entry Timeframe
          <input {...register('entryTimeframe')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" placeholder="e.g. 15M" />
        </label>
        <label className="text-sm text-muted">
          HTF Bias
          <select {...register('htfBias')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
            <option value="">Unspecified</option>
            <option value="BULLISH">Bullish</option>
            <option value="BEARISH">Bearish</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </label>
      </div>
    </section>
  );
};

export default TradeContextReview;
