import React from 'react';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatProfitFactor } from '../../utils/dashboard';

const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f97316', '#64748b'];

const getPnlColor = (pnl) => {
  const val = Number(pnl || 0);
  if (val > 0) return 'text-emerald-400 font-bold';
  if (val < 0) return 'text-red-400 font-bold';
  return 'text-muted font-medium';
};

const getWinRateColor = (winRate) => {
  const val = Number(winRate || 0);
  if (val >= 50) return 'text-emerald-400 font-bold';
  if (val >= 40) return 'text-amber-400 font-bold';
  return 'text-red-400 font-bold';
};

const SessionEdgeChart = ({ data = [], currency, className = '' }) => {
  const totalTrades = data.reduce((total, session) => total + session.totalTrades, 0);
  const strongest = data.find((session) => session.isStrongest);

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader title="Execution Edge by Session" eyebrow="Where you perform best" />

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
          No session data yet. Keep executing.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid min-w-0 items-center gap-4">
            <div className="relative mx-auto h-44 w-full max-w-56 sm:h-48 xl:h-40 2xl:h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="totalTrades" nameKey="label" innerRadius={42} outerRadius={64} paddingAngle={2}>
                    {data.map((entry, index) => (
                      <Cell key={entry.key} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const entry = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-surface p-3 shadow-lg text-xs space-y-1.5">
                          <p className="font-bold text-foreground text-sm">{entry.label}</p>
                          <p className="text-muted font-medium">
                            <span className="font-bold text-foreground">{entry.totalTrades} trades</span> ({entry.percentage}% of total)
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-emerald-400 font-bold">{entry.wins ?? 0} positive</span>
                            <span className="text-muted">·</span>
                            <span className="text-red-400 font-bold">{entry.losses ?? 0} negative</span>
                            {(entry.breakevens ?? 0) > 0 && <span className="text-muted">· {entry.breakevens} BE</span>}
                          </div>
                          <p className="text-muted">
                            Win Rate: <span className={getWinRateColor(entry.winRate)}>{entry.winRate}%</span>
                          </p>
                          <p className="text-muted">
                            Net P/L: <span className={getPnlColor(entry.netProfitLoss)}>{formatCurrency(entry.netProfitLoss, currency, { signDisplay: 'always' })}</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-black text-foreground">{totalTrades}</p>
                <p className="text-xs text-muted">Total Trades</p>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              {data.map((session, index) => (
                <div key={session.key} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-sm 2xl:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                  <div className="min-w-0">
                    <p className="break-words font-semibold leading-5 text-foreground">{session.label}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                        {session.wins ?? 0} positive
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />
                        {session.losses ?? 0} negative
                      </span>
                      {(session.breakevens ?? 0) > 0 && (
                        <span className="inline-flex items-center font-medium text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border text-[11px]">
                          {session.breakevens} BE
                        </span>
                      )}
                      <span className="text-muted text-[11px]">
                        out of {session.totalTrades} {session.totalTrades === 1 ? 'trade' : 'trades'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs leading-4">
                      <span className={getPnlColor(session?.netProfitLoss)}>
                        {formatCurrency(session?.netProfitLoss, currency, { signDisplay: 'always' })}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="text-muted font-medium">PF {formatProfitFactor(session?.profitFactor)}</span>
                      <span className="text-muted">·</span>
                      <span className={getWinRateColor(session?.winRate)}>
                        {session.winRate}% WR
                      </span>
                    </div>
                  </div>
                  <div className="col-start-2 2xl:col-start-auto text-left 2xl:text-right">
                    <span className="text-xs font-bold text-foreground 2xl:text-sm block">
                      {session.percentage}%
                    </span>
                    <span className={`text-[11px] block ${getWinRateColor(session?.winRate)}`}>
                      {session.winRate}% WR
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
            {strongest ? (
              <div className="flex gap-3">
                <ShieldCheck size={20} className="mt-0.5 text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{strongest.label} is currently your strongest session.</p>
                  <p className="mt-1 text-xs text-emerald-100/70">Based on positive P/L, profit factor, and enough trade samples.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Every execution holds a lesson. Keep building your record to find your edge.</p>
            )}
          </div>
        </div>
      )}
    </DashboardCard>
  );
};

export default SessionEdgeChart;
