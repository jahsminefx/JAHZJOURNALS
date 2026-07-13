import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency } from '../../utils/dashboard';

const TopWinningPairs = ({ pairs = [], currency, className = '' }) => (
  <DashboardCard className={`p-5 ${className}`}>
    <CardHeader title="Top Winning Pairs" />
    {pairs.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
        Profitable instruments will appear here after closed winning trades.
      </div>
    ) : (
      <div className="space-y-4">
        {pairs.map((pair) => (
          <Link
            key={pair.pair}
            to={`/trades?pair=${encodeURIComponent(pair.pair)}`}
            className="block rounded-lg border border-transparent p-1 transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{pair.pair}</span>
              <span className="font-bold text-emerald-400">+{formatCurrency(pair.netProfitLoss, currency)}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(Number(pair.contributionPercentage || 0), 100)}%` }} />
              </div>
              <span className="w-10 text-right text-xs text-muted">{Math.round(Number(pair.contributionPercentage || 0))}%</span>
            </div>
          </Link>
        ))}
      </div>
    )}
  </DashboardCard>
);

export default TopWinningPairs;
