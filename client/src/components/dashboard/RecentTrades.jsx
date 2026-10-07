import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency } from '../../utils/dashboard';

const badgeClass = (direction) => (
  direction === 'SELL'
    ? 'bg-red-500/15 text-red-300'
    : 'bg-emerald-500/15 text-emerald-300'
);

const pnlClass = (value) => {
  const amount = Number(value || 0);
  if (amount > 0) return 'text-emerald-400';
  if (amount < 0) return 'text-red-400';
  return 'text-muted';
};

const formatTradeDate = (value) => {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getTradeStateLabel = (trade) => {
  if (trade.status === 'CLOSED') return trade.result === 'OPEN' ? 'CLOSED' : trade.result;
  if (trade.status === 'ACTIVE') return 'OPEN';
  return trade.status || trade.result || 'OPEN';
};

const RecentTrades = ({ trades = [], currency, className = '' }) => (
  <DashboardCard className={`p-5 ${className}`}>
    <CardHeader
      title="Recent Trades"
      action={(
        <Link to="/trades" className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:border-emerald-500/40 hover:text-foreground">
          View All
        </Link>
      )}
    />
    {trades.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
        Your latest trades will appear here once logged.
      </div>
    ) : (
      <div className="divide-y divide-slate-800">
        {trades.map((trade) => {
          const amount = Number(trade.profitLossAmount || 0);
          return (
            <Link key={trade.id} to={`/trades/${trade.id}`} className="grid grid-cols-[1fr_auto] gap-3 py-3 transition hover:bg-surface/60">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">{trade.pair}</span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass(trade.direction)}`}>{trade.direction === 'SELL' ? 'Short' : 'Long'}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{formatTradeDate(trade.exitTime || trade.entryTime || trade.createdAt || trade.timestamp)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${pnlClass(amount)}`}>{amount > 0 ? '+' : ''}{formatCurrency(amount, currency)}</p>
                <p className="mt-1 text-xs text-muted">{getTradeStateLabel(trade)}</p>
              </div>
            </Link>
          );
        })}
        <p className="pt-4 text-xs text-muted">Showing {trades.length} recent trade{trades.length === 1 ? '' : 's'}</p>
      </div>
    )}
  </DashboardCard>
);

export default RecentTrades;
