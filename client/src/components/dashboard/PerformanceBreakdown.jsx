import React from 'react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency } from '../../utils/dashboard';

const BreakdownItem = ({ label, value, percent, tone = 'green', currency }) => (
  <div className="rounded-lg border border-border bg-background p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className={`mt-1 text-sm font-bold ${tone === 'red' ? 'text-red-300' : 'text-foreground'}`}>{formatCurrency(value, currency)}</p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
      <div className={`h-full rounded-full ${tone === 'red' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
    <p className="mt-2 text-right text-xs text-muted">{Math.round(percent)}%</p>
  </div>
);

const PerformanceBreakdown = ({ data = {}, currency, className = '' }) => {
  const grossProfit = Number(data.grossProfit || 0);
  const grossLoss = Number(data.grossLoss || 0);
  const total = grossProfit + grossLoss;
  const profitPercent = total ? (grossProfit / total) * 100 : 0;
  const lossPercent = total ? (grossLoss / total) * 100 : 0;

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader title="Performance Breakdown" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BreakdownItem label="Gross Profit" value={grossProfit} percent={profitPercent} currency={currency} />
        <BreakdownItem label="Gross Loss" value={grossLoss} percent={lossPercent} tone="red" currency={currency} />
        <BreakdownItem label="Avg Win" value={data.averageWin || 0} percent={profitPercent} currency={currency} />
        <BreakdownItem label="Avg Loss" value={data.averageLoss || 0} percent={lossPercent} tone="red" currency={currency} />
      </div>
    </DashboardCard>
  );
};

export default PerformanceBreakdown;
