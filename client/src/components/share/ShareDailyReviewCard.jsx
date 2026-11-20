import React from 'react';
import BrandLogo from '../BrandLogo';

export default function ShareDailyReviewCard({ summary, cardRef }) {
  if (!summary || !summary.metrics) return null;

  const metrics = summary.metrics;
  const isProfitable = metrics.netProfitLoss > 0;
  const dateFormatted = summary.dateStr || 'Daily Review';

  const formatCurrency = (amount, currencyStr) => {
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const num = Number(amount || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${symbol}${Math.abs(num).toLocaleString()} ${currencyStr || 'USD'}`;
  };

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[620px] bg-gradient-to-br from-surface via-indigo-50/70 to-surface dark:from-[#090d16] dark:via-[#1e1b4b] dark:to-[#0f172a] border border-border rounded-2xl p-6 shadow-xl dark:shadow-2xl text-foreground font-sans relative overflow-hidden select-none"
    >
      {/* Decorative ambient background */}
      <div className={`absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl opacity-20 dark:opacity-25 ${
        isProfitable ? 'bg-emerald-500' : metrics.netProfitLoss < 0 ? 'bg-rose-500' : 'bg-indigo-500'
      }`} />

      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-5 relative z-10">
        <div>
          <BrandLogo size="sm" to={null} />
          <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium tracking-wide mt-1">DAILY REVIEW SUMMARY</p>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-foreground block">{dateFormatted}</span>
          {metrics.isMultiAccount && (
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-500/15 dark:bg-indigo-950/80 border border-indigo-500/30 dark:border-indigo-800/60 px-2 py-0.5 rounded">
              ALL ACCOUNTS (USD)
            </span>
          )}
        </div>
      </div>

      {/* Main Net P/L & Win Rate Banner */}
      <div className="grid grid-cols-2 gap-4 mb-5 relative z-10 bg-surface-muted/80 dark:bg-slate-950/70 border border-border rounded-xl p-4">
        <div>
          <span className="text-xs text-muted font-medium uppercase tracking-wider block mb-1">Net Daily P/L</span>
          <span className={`text-2xl font-black tracking-tight ${
            isProfitable ? 'text-emerald-600 dark:text-emerald-400' : metrics.netProfitLoss < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
          }`}>
            {formatCurrency(metrics.netProfitLoss, metrics.currency)}
          </span>
        </div>

        <div className="text-right border-l border-border pl-4">
          <span className="text-xs text-muted font-medium uppercase tracking-wider block mb-1">Win Rate</span>
          <div className="flex items-center justify-end space-x-2">
            <span className="text-2xl font-black tracking-tight text-foreground">{metrics.winRate}%</span>
            <span className="text-xs text-muted font-medium">({metrics.winningTrades}W / {metrics.losingTrades}L)</span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4 gap-2 mb-5 relative z-10 text-center">
        <div className="bg-surface-muted/80 dark:bg-slate-950/50 border border-border rounded-xl p-2.5">
          <span className="text-[10px] text-muted font-medium uppercase block">Trades</span>
          <span className="text-sm font-bold text-foreground">{metrics.totalTrades}</span>
        </div>
        <div className="bg-surface-muted/80 dark:bg-slate-950/50 border border-border rounded-xl p-2.5">
          <span className="text-[10px] text-muted font-medium uppercase block">Total Pips</span>
          <span className="text-sm font-bold text-foreground">{metrics.totalPips !== null ? `${metrics.totalPips > 0 ? '+' : ''}${metrics.totalPips}` : '—'}</span>
        </div>
        <div className="bg-surface-muted/80 dark:bg-slate-950/50 border border-border rounded-xl p-2.5">
          <span className="text-[10px] text-muted font-medium uppercase block">Profit Factor</span>
          <span className="text-sm font-bold text-foreground">{metrics?.profitFactor !== null && metrics?.profitFactor !== undefined ? metrics.profitFactor : '—'}</span>
        </div>
        <div className="bg-surface-muted/80 dark:bg-slate-950/50 border border-border rounded-xl p-2.5">
          <span className="text-[10px] text-muted font-medium uppercase block">Avg R:R</span>
          <span className="text-sm font-bold text-foreground">{metrics.averageRiskReward !== null ? `1:${metrics.averageRiskReward}` : '—'}</span>
        </div>
      </div>

      {/* Highlights (Best Strategy & Session) */}
      {(metrics.bestStrategy || metrics.bestSession) && (
        <div className="flex items-center justify-between bg-indigo-500/10 dark:bg-indigo-950/40 border border-indigo-500/20 dark:border-indigo-900/40 rounded-xl px-3 py-2 mb-5 relative z-10 text-xs">
          {metrics.bestStrategy && (
            <div>
              <span className="text-indigo-700 dark:text-indigo-300 font-medium">Top Strategy: </span>
              <span className="text-foreground font-bold">{metrics.bestStrategy}</span>
            </div>
          )}
          {metrics.bestSession && (
            <div>
              <span className="text-indigo-700 dark:text-indigo-300 font-medium">Best Session: </span>
              <span className="text-foreground font-bold">{metrics.bestSession}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer Branding */}
      <div className="flex items-center justify-between border-t border-border/80 pt-3 relative z-10 text-[11px] text-muted">
        <span>Verified Performance Journal</span>
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">jahzjournal.com</span>
      </div>
    </div>
  );
}
