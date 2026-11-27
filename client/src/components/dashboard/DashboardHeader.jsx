import React from 'react';
import DashboardFilters from './DashboardFilters';
import FxConversionStatus from '../common/FxConversionStatus';

const DashboardHeader = ({ fxMetadata, isMultiAccountNormalized, summary, ...props }) => (
  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Your Sanctuary</h1>
        {isMultiAccountNormalized && (
          <span className="whitespace-nowrap text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/30 dark:border-blue-800/50 text-blue-700 dark:text-blue-400">
            Portfolio Normalized (USD)
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-muted">Watch your discipline take shape</p>
        {isMultiAccountNormalized && fxMetadata && (
          <FxConversionStatus fxMetadata={fxMetadata} usdAmount={summary?.netProfitLoss} />
        )}
      </div>
    </div>
    <DashboardFilters {...props} />
  </div>
);

export default DashboardHeader;
