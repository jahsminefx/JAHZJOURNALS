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
      <div className={`inline-flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2.5 py-1 rounded-md ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        <span>USD conversion unavailable</span>
      </div>
    );
  }

  const isLive = source === 'LIVE';
  const badgeColor = isLive
    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
    : 'bg-amber-950/40 border-amber-800/50 text-amber-400';
  const dotColor = isLive ? 'bg-emerald-400' : 'bg-amber-400';

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-slate-300 ${className}`}>
      {showNative && nativeAmount !== null && (
        <span className="font-semibold text-slate-100">
          {formatCurrency(nativeAmount, nativeCurrency)}
        </span>
      )}

      <span className="text-slate-400 font-medium">
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
