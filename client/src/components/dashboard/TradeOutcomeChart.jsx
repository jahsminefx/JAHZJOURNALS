import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardCard, CardHeader } from './DashboardShell';

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

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader title="Trade Outcome" />
      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
          Your win/loss ratio will take shape here.
        </div>
      ) : (
        <div className="grid min-w-0 items-center gap-4">
          <div className="relative mx-auto h-40 w-full max-w-52 sm:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} innerRadius={40} outerRadius={62} dataKey="value" paddingAngle={2}>
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 10 }}
                  itemStyle={{ color: 'rgb(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-foreground">{total}</span>
              <span className="text-xs text-muted">Total Trades</span>
            </div>
          </div>
          <div className="min-w-0 space-y-3 text-sm">
            {[
              ['winners', 'Winners', wins],
              ['losers', 'Losers', losses],
              ['breakevens', 'Breakeven', breakevens],
            ].map(([key, label, value]) => (
              <div key={key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                  {value}
                </span>
                <span className="text-right text-muted">
                  {label} ({((value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
};

export default TradeOutcomeChart;
