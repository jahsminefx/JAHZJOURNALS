import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatPercent } from '../../utils/dashboard';

const COLORS = {
  winners: '#10b981',
  losers: '#ef4444',
  breakevens: '#94a3b8',
};

const TradeOutcomeChart = ({ outcomes = {}, className = '' }) => {
  const wins = Number(outcomes.wins || 0);
  const losses = Number(outcomes.losses || 0);
  const breakevens = Number(outcomes.breakevens || 0);
  const total = wins + losses + breakevens;
  const data = [
    { key: 'winners', name: 'Winners', value: wins },
    { key: 'losers', name: 'Losers', value: losses },
    { key: 'breakevens', name: 'Breakeven', value: breakevens },
  ].filter((item) => item.value > 0);

  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;
  const bePct = total > 0 ? (breakevens / total) * 100 : 0;

  return (
    <DashboardCard className={`p-5 flex flex-col justify-between ${className}`}>
      <CardHeader 
        title="Trade Outcome" 
        eyebrow="Distribution of closed trades"
        action={(
          <span className="text-xs font-mono font-bold text-foreground bg-surface-muted px-2 py-0.5 rounded-lg border border-border">
            {total} Trades
          </span>
        )}
      />

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted text-center">
          Win/loss ratio will take shape here.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative h-28 w-28 shrink-0 max-w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} innerRadius={28} outerRadius={46} dataKey="value" paddingAngle={2}>
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 8, fontSize: '11px' }}
                    itemStyle={{ color: 'rgb(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-black text-foreground">{total}</span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Wins ({wins})
                </span>
                <span className="font-bold text-emerald-400 font-mono">{formatPercent(winPct)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Losses ({losses})
                </span>
                <span className="font-bold text-rose-400 font-mono">{formatPercent(lossPct)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  BE ({breakevens})
                </span>
                <span className="font-bold text-muted font-mono">{formatPercent(bePct)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
};

export default TradeOutcomeChart;
