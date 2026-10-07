import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/dashboard';

const GoalRow = ({ label, current, target, progress, suffix = '', goodWhenLower = false, currency, currentLabel, targetLabel }) => {
  const complete = Number(progress || 0);
  const overLimit = goodWhenLower && complete > 100;
  const displayCurrent = currentLabel || (currency ? formatCurrency(current, currency) : `${Number(current || 0).toLocaleString()}${suffix}`);
  const displayTarget = targetLabel || (currency ? formatCurrency(target, currency) : `${Number(target || 0).toLocaleString()}${suffix}`);

  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted">{displayCurrent} / {displayTarget}</p>
        </div>
        <span className={`text-sm font-bold ${overLimit ? 'text-red-400' : 'text-foreground'}`}>{Math.round(complete)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full ${overLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(Math.abs(complete), 100)}%` }}
        />
      </div>
    </div>
  );
};

const formatGoalValue = (goal, value, currency) => {
  if (goal.format === 'currency') return formatCurrency(value, currency);
  if (goal.format === 'percent') return formatPercent(value, 1);
  return `${formatNumber(value, 0)}${goal.format === 'integer' && goal.key === 'tradeCountTarget' ? ' trades' : ''}`;
};

const WeeklyGoalProgress = ({ goals = [], currency, className = '' }) => (
  <DashboardCard className={`p-4 ${className}`}>
    <CardHeader title="Weekly Goal Progress" eyebrow="Discipline & profit targets" />
    {goals.length === 0 ? (
      <div className="rounded-xl border border-dashed border-border p-4 text-xs">
        <p className="font-semibold text-foreground">Set weekly goals to track your progress.</p>
        <Link to="/settings?section=trading" className="mt-2.5 inline-flex rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400">
          Goal Settings
        </Link>
      </div>
    ) : (
      <div className="space-y-2.5">
        {goals.map((goal) => (
          <GoalRow
            key={goal.key}
            label={goal.label}
            currentLabel={formatGoalValue(goal, goal.currentValue, currency)}
            targetLabel={formatGoalValue(goal, goal.targetValue, currency)}
            progress={goal.percentageComplete}
            goodWhenLower={goal.inverse}
          />
        ))}
      </div>
    )}
  </DashboardCard>
);

export default WeeklyGoalProgress;
