import React from 'react';
import { formatCurrency } from '../../utils/dashboard';

/**
 * FxConversionStatus UI Component
 * Renders converted reporting USD value alongside explicit FX status badge:
 * - LIVE: Green badge "Live FX"
 * - CACHED: Amber badge "Cached • 4m ago"
 * - UNAVAILABLE: Red badge "Conversion Unavailable"
 */
export const FxConversionStatus = ({
  usdAmount,
  fxMetadata = {},
  nativeAmount = null,
  nativeCurrency = 'USD',
  showNative = false,
  className = '',
}) => {
  const { source, timeAgo, isStale, status } = fxMetadata;

  if (nativeCurrency === 'USD' && !showNative) {
    return null;
  }

  if (status === 'UNAVAILABLE' || source === 'UNAVAILABLE' || usdAmount === null || usdAmount === undefined) {
    return (
      <div className={`inline-flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-md ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        <span>USD conversion unavailable</span>
      </div>
    );
  }

  const isLive = source === 'LIVE';
  const badgeColor = isLive
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400';
  const dotColor = isLive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400';

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      {showNative && nativeAmount !== null && (
        <span className="font-semibold text-foreground">
          {formatCurrency(nativeAmount, nativeCurrency)}
        </span>
      )}

      <span className="text-muted font-medium">
        ≈ {formatCurrency(usdAmount, 'USD')}
      </span>

      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${badgeColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {isLive ? 'Live FX' : `Cached • ${timeAgo || 'recent'}`}
      </span>
    </div>
  );
};

export default FxConversionStatus;
