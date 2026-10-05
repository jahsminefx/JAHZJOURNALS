import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatPercent } from '../../utils/dashboard';
import { ArrowUpRight } from 'lucide-react';

const getWinRateBadge = (winRate) => {
  const rate = Number(winRate || 0);
  if (rate >= 50) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  }
  if (rate >= 40) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
  }
  return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
};

const getPnlColor = (pnl) => {
  const num = Number(pnl || 0);
  if (num > 0) return 'text-emerald-400';
  if (num < 0) return 'text-rose-400';
  return 'text-muted';
};

const TopWinningPairs = ({
  pairs = [],
  topPairs = [],
  worstPairs = [],
  currency,
  accountId,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'winners' | 'drawdowns'

  // If pairs (all pairs) is provided, use it; otherwise fallback to combining topPairs & worstPairs
  const allList = useMemo(() => {
    if (pairs && pairs.length > 0) return pairs;
    return [...(topPairs || []), ...(worstPairs || [])];
  }, [pairs, topPairs, worstPairs]);

  const winnersList = useMemo(() => {
    return allList
      .filter((p) => Number(p.netProfitLoss || 0) > 0)
      .sort((a, b) => Number(b.netProfitLoss || 0) - Number(a.netProfitLoss || 0));
  }, [allList]);

  const drawdownsList = useMemo(() => {
    return allList
      .filter((p) => Number(p.netProfitLoss || 0) < 0)
      .sort((a, b) => Number(a.netProfitLoss || 0) - Number(b.netProfitLoss || 0));
  }, [allList]);

  const displayedList = useMemo(() => {
    if (activeTab === 'winners') return winnersList;
    if (activeTab === 'drawdowns') return drawdownsList;
    return allList;
  }, [activeTab, allList, winnersList, drawdownsList]);

  return (
    <DashboardCard className={`p-5 flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <CardHeader title="Performance by Pair" />
          <div className="flex items-center rounded-xl bg-surface-muted/80 p-0.5 border border-border text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              All ({allList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('winners')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                activeTab === 'winners'
                  ? 'bg-emerald-500/15 text-emerald-400 shadow-xs'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Profit ({winnersList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drawdowns')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                activeTab === 'drawdowns'
                  ? 'bg-rose-500/15 text-rose-400 shadow-xs'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Loss ({drawdownsList.length})
            </button>
          </div>
        </div>

        {displayedList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
            {activeTab === 'winners'
              ? 'No profitable pairs recorded in this period.'
              : activeTab === 'drawdowns'
              ? 'No pairs in drawdown recorded in this period.'
              : 'Traded instruments will appear here after closed trades.'}
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {displayedList.map((item) => {
              const pnl = Number(item.netProfitLoss || 0);
              const winRate = Number(item.winRate || 0);
              const total = Number(item.totalTrades || 0);
              const wins = Number(item.wins || 0);
              const losses = Number(item.losses || 0);
              const linkUrl = `/trades?pair=${encodeURIComponent(item.pair)}${
                accountId ? `&accountId=${encodeURIComponent(accountId)}` : ''
              }`;

              return (
                <Link
                  key={item.pair}
                  to={linkUrl}
                  className="group block rounded-xl border border-border/60 bg-surface-muted/30 p-2.5 transition-all hover:border-emerald-500/30 hover:bg-surface-muted/70 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground tracking-tight group-hover:text-emerald-400 transition-colors">
                        {item.pair}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${getWinRateBadge(
                          winRate
                        )}`}
                      >
                        {formatPercent(winRate)} WR
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-sm font-bold ${getPnlColor(pnl)}`}>
                        {pnl > 0 ? '+' : ''}
                        {formatCurrency(pnl, currency)}
                      </span>
                      <ArrowUpRight
                        size={14}
                        className="text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      <strong className="text-foreground/90 font-medium">
                        {wins} positive
                      </strong>{' '}
                      ·{' '}
                      <strong className="text-foreground/90 font-medium">
                        {losses} negative
                      </strong>{' '}
                      out of {total} {total === 1 ? 'trade' : 'trades'}
                    </span>
                  </div>

                  {/* Visual ratio bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80 flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(winRate, 100)}%` }}
                    />
                    <div
                      className="h-full bg-rose-500/70 transition-all duration-500"
                      style={{ width: `${Math.max(0, 100 - winRate)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted">
        <span>Click any pair to inspect trades</span>
        <Link
          to={`/trades${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`}
          className="text-emerald-400 hover:text-emerald-300 font-semibold transition"
        >
          View all trades →
        </Link>
      </div>
    </DashboardCard>
  );
};

export default TopWinningPairs;
