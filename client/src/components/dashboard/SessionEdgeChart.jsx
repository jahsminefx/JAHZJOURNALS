import React from 'react';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatProfitFactor } from '../../utils/dashboard';

const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f97316', '#64748b'];

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
                    contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid #334155', borderRadius: 12 }}
                    formatter={(value, name, item) => [`${value} trades`, item.payload.label]}
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
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <div className="min-w-0">
                    <p className="break-words font-semibold leading-5 text-foreground">{session.label}</p>
                    <p className="text-xs leading-5 text-muted">{formatCurrency(session?.netProfitLoss, currency)} | PF {formatProfitFactor(session?.profitFactor)}</p>
                  </div>
                  <span className="col-start-2 text-xs font-bold text-foreground 2xl:col-start-auto 2xl:text-right 2xl:text-sm">{session.percentage}% ({session.totalTrades})</span>
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
