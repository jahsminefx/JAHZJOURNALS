import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/dashboard';

const GoalRow = ({
  label,
  progress,
  goodWhenLower = false,
  isNegative = false,
  isCompleted = false,
  isExceeded = false,
  isWarning = false,
  currentLabel,
  targetLabel,
}) => {
  const complete = Number(progress || 0);
  const clampedComplete = Math.min(Math.max(complete, 0), 100);
  const overLimit = goodWhenLower && (isExceeded || complete > 100);
  const nearLimit = goodWhenLower && !overLimit && (isWarning || complete >= 80);
  const goalMet = !goodWhenLower && (isCompleted || complete >= 100);

  const barColor = overLimit
    ? 'bg-red-500'
    : nearLimit
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const pctColor = overLimit
    ? 'text-red-600 dark:text-red-400'
    : nearLimit
      ? 'text-amber-600 dark:text-amber-400'
      : goalMet
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-foreground';

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {overLimit && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                <AlertTriangle size={10} />
                Limit exceeded
              </span>
            )}
            {nearLimit && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                Near limit
              </span>
            )}
            {goalMet && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={10} />
                Achieved
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            <span className={isNegative ? 'font-semibold text-red-600 dark:text-red-400' : 'text-foreground/90'}>
              {currentLabel}
            </span>
            <span> / {targetLabel}</span>
          </p>
        </div>
        <span className={`shrink-0 text-sm font-bold ${pctColor}`}>
          {Math.round(complete)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clampedComplete}%` }}
        />
      </div>
    </div>
  );
};

const formatGoalValue = (goal, value, fallbackCurrency) => {
  const effectiveCurrency = goal.currency || fallbackCurrency || 'USD';
  if (goal.format === 'currency') return formatCurrency(value, effectiveCurrency);
  if (goal.format === 'percent') return formatPercent(value, 1);
  return `${formatNumber(value, 0)}${goal.format === 'integer' && goal.key === 'tradeCountTarget' ? ' trades' : ''}`;
};

const WeeklyGoalProgress = ({ goals = [], currency, accountId = '', className = '' }) => {
  const firstGoal = goals[0] || null;
  const scopeLabel = firstGoal?.scopeLabel || (firstGoal?.tradingAccountId ? firstGoal?.accountName : 'All Accounts');
  const scopeType = firstGoal?.scopeType || (firstGoal?.tradingAccountId ? 'ACCOUNT' : 'ALL_ACCOUNTS');
  const isMismatch = Boolean(
    firstGoal && (
      firstGoal.isDifferentFromDashboardAccount
      || (accountId && scopeType === 'ALL_ACCOUNTS')
      || (accountId && firstGoal.tradingAccountId && String(firstGoal.tradingAccountId) !== String(accountId))
    ),
  );
  const weekCaption = firstGoal?.weekStart && firstGoal?.weekEnd
    ? `Current week (UTC): ${firstGoal.weekStart} to ${firstGoal.weekEnd}`
    : 'Current week (UTC · Mon–Sun)';

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader
        title={(
          <div className="flex flex-wrap items-center gap-2">
            <span>Weekly Goal Progress</span>
            {goals.length > 0 && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                {scopeLabel}
              </span>
            )}
          </div>
        )}
        eyebrow={goals.length > 0 ? weekCaption : undefined}
        action={goals.length > 0 ? (
          <Link
            to="/settings?section=trading"
            className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400 whitespace-nowrap"
          >
            Edit Goals
          </Link>
        ) : undefined}
      />

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5">
          <p className="text-sm font-semibold text-foreground">Set weekly goals to track your progress.</p>
          <p className="mt-1 text-xs text-muted">Track profit, trade count, win rate, or maximum loss for the current week (Mon–Sun UTC).</p>
          <Link
            to="/settings?section=trading"
            className="mt-4 inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
          >
            Goal Settings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {isMismatch && (
            <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
              <Info size={14} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
              <span>
                {scopeType === 'ACCOUNT'
                  ? `Scoped to ${scopeLabel} — progress reflects only ${scopeLabel} trades this week.`
                  : 'Scoped to All Accounts — progress aggregates eligible accounts this week.'}
              </span>
            </div>
          )}

          {goals.map((goal) => (
            <GoalRow
              key={goal.key}
              label={goal.label}
              currentLabel={formatGoalValue(goal, goal.currentValue, currency)}
              targetLabel={formatGoalValue(goal, goal.targetValue, currency)}
              progress={goal.percentageComplete}
              goodWhenLower={goal.inverse}
              isNegative={goal.isNegative}
              isCompleted={goal.isCompleted}
              isExceeded={goal.isExceeded}
              isWarning={goal.isWarning}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
};

export default WeeklyGoalProgress;
