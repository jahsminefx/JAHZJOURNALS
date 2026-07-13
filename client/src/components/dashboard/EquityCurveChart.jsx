import React, { useId, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatNumber } from '../../utils/dashboard';

const chartPeriods = [
  { label: '7D', range: '7d' },
  { label: '30D', range: '30d' },
  { label: '90D', range: '90d' },
  { label: '1Y', range: 'thisYear' },
  { label: 'All', range: 'all' },
];

const curveViews = [
  { key: 'cumulativePnl', label: 'Cumulative P/L' },
  { key: 'accountBalance', label: 'Account Balance' },
];

const eventLabels = {
  account_start: 'Account start',
  period_start: 'Period start',
  period_end: 'Period end',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  trade: 'Closed trade',
  trade_win: 'Closed trade',
  trade_loss: 'Closed trade',
  trade_breakeven: 'Closed trade',
  trade_day: 'Trading day',
  balance_adjustment: 'Balance adjustment',
};

const eventColors = {
  account_start: '#64748b',
  period_start: '#64748b',
  period_end: '#64748b',
  deposit: '#38bdf8',
  withdrawal: '#f59e0b',
  trade_win: '#10b981',
  trade_loss: '#ef4444',
  trade_breakeven: '#94a3b8',
  trade: '#10b981',
  trade_day: '#10b981',
  balance_adjustment: '#94a3b8',
};

const eventTextTones = {
  account_start: 'text-muted',
  period_start: 'text-muted',
  period_end: 'text-muted',
  deposit: 'text-sky-300',
  withdrawal: 'text-amber-300',
  trade_win: 'text-emerald-300',
  trade_loss: 'text-red-300',
  trade_breakeven: 'text-foreground',
  trade: 'text-emerald-300',
  trade_day: 'text-emerald-300',
  balance_adjustment: 'text-foreground',
};

const eventTone = (point) => {
  if (eventTextTones[point.eventType]) return eventTextTones[point.eventType];
  const change = Number(point.change ?? point.tradePnl ?? 0);
  if (change > 0) return 'text-emerald-300';
  if (change < 0) return 'text-red-300';
  return 'text-foreground';
};

const signedCurrency = (value, currency) => formatCurrency(value, currency, { signDisplay: 'always' });

const signedPercent = (value) => {
  const number = Number(value || 0);
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatNumber(number, 2)}%`;
};

const getDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatTimestamp = (value, { includeTime = false, includeYear = false } = {}) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Start';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
};

const getRepeatedDateKeys = (points = []) => {
  const counts = new Map();
  points.forEach((point) => {
    const key = getDateKey(point.date);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
};

const getCumulativeDomain = (points = []) => {
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (!values.length) return [-10, 10];
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(max - min, 1);
  const padding = Math.max(range * 0.15, 10);
  return [min - padding, max + padding];
};

const getBalanceDomain = (points = []) => {
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  if (!values.length) return [0, 50];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const padding = Math.max(range * 0.08, 50);
  return [
    minValue >= 0 ? Math.max(0, minValue - padding) : minValue - padding,
    maxValue + padding,
  ];
};

const EventDot = ({ cx, cy, payload }) => {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = eventColors[payload.eventType] || '#94a3b8';
  const isStart = payload.eventType === 'account_start' || payload.eventType === 'period_start';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isStart ? 3 : 3.75}
      fill={color}
      stroke="rgb(var(--background))"
      strokeWidth={1.5}
    />
  );
};

const ActiveEventDot = ({ cx, cy, payload }) => {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = eventColors[payload.eventType] || '#10b981';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={color}
      stroke="rgb(var(--background))"
      strokeWidth={2}
    />
  );
};

const PerformanceTooltip = ({ active, payload, view, currency }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload || {};
  const isCumulative = view === 'cumulativePnl';

  return (
    <div className="max-w-[min(17rem,calc(100vw-2rem))] rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-[0_20px_45px_rgba(2,6,23,0.6)]">
      <p className="font-bold text-foreground">{formatTimestamp(point.date, { includeTime: true, includeYear: true })}</p>
      {isCumulative ? (
        <>
          <p className={Number(point.value || 0) < 0 ? 'mt-2 text-red-300' : 'mt-2 text-emerald-300'}>
            Cumulative P/L: {formatCurrency(point.value, currency)}
          </p>
          {(String(point.eventType || '').startsWith('trade') || point.eventType === 'trade_day') && (
            <p className={eventTone(point)}>
              {point.eventType === 'trade_day' ? 'Day result' : 'Trade result'}: {signedCurrency(point.tradePnl ?? point.change, currency)}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-emerald-300">Balance: {formatCurrency(point.value, currency)}</p>
          <p className={eventTone(point)}>Event: {point.label || eventLabels[point.eventType] || 'Activity'}</p>
          <p className={Number(point.change || 0) > 0 ? 'text-emerald-300' : Number(point.change || 0) < 0 ? 'text-red-300' : 'text-muted'}>
            Change: {signedCurrency(point.change, currency)}
          </p>
        </>
      )}
    </div>
  );
};

const SummaryStrip = ({ view, summary = {}, currency }) => {
  const isCumulative = view === 'cumulativePnl';
  const items = isCumulative
    ? [
      { label: 'Net P/L', value: signedCurrency(summary.netTradingPnl, currency), tone: Number(summary.netTradingPnl || 0) < 0 ? 'text-red-300' : 'text-emerald-300' },
      { label: 'Return', value: signedPercent(summary.tradingReturnPercentage), tone: Number(summary.tradingReturnPercentage || 0) < 0 ? 'text-red-300' : 'text-emerald-300' },
      { label: 'Closed trades', value: formatNumber(summary.closedTrades || 0, 0), tone: 'text-foreground' },
    ]
    : [
      { label: 'Total deposits', value: formatCurrency(summary.totalDeposits, currency), tone: Number(summary.totalDeposits || 0) > 0 ? 'text-sky-300' : 'text-muted' },
      { label: 'Total withdrawals', value: formatCurrency(summary.totalWithdrawals, currency), tone: Number(summary.totalWithdrawals || 0) > 0 ? 'text-amber-300' : 'text-muted' },
      { label: 'Current balance', value: formatCurrency(summary.currentBalance, currency), tone: Number(summary.currentBalance || 0) > 0 ? 'text-emerald-300' : Number(summary.currentBalance || 0) < 0 ? 'text-red-300' : 'text-foreground' },
    ];

  return (
    <div className="mb-4 grid gap-2 text-xs sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-md border border-border bg-surface px-3 py-2">
          <p className="font-semibold text-muted">{item.label}</p>
          <p className={`mt-1 truncate font-black ${item.tone}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border bg-surface px-4 text-center text-sm font-semibold text-muted">
    {message}
  </div>
);

const EquityCurveChart = ({
  data = {},
  currency,
  activeRange,
  onRangeChange,
  hasAccountSelection = true,
  className = '',
}) => {
  const [view, setView] = useState('cumulativePnl');
  const chartId = useId().replace(/:/g, '');
  const points = useMemo(() => data?.[view] || [], [data, view]);
  const repeatedDateKeys = useMemo(() => getRepeatedDateKeys(points), [points]);
  const summary = data?.summary || {};
  const hasFinancialActivity = Number(summary.totalDeposits || 0) > 0
    || Number(summary.totalWithdrawals || 0) > 0
    || Number(summary.closedTrades || 0) > 0
    || Number(summary.balanceAdjustments || 0) !== 0
    || points.length > 1;
  const hasClosedTrades = Number(summary.closedTrades || 0) > 0;
  const isCumulative = view === 'cumulativePnl';
  const endingValue = Number(points[points.length - 1]?.value || 0);
  const isNegativePerformance = isCumulative && endingValue < 0;
  const stroke = isNegativePerformance ? '#ef4444' : '#10b981';
  const activeDotFill = isNegativePerformance ? '#ef4444' : '#10b981';
  const cursorStroke = isNegativePerformance ? '#f87171' : '#34d399';
  const gradientId = `performanceFill-${view}-${chartId}`;
  const glowId = `performanceGlow-${view}-${chartId}`;
  const yDomain = isCumulative ? getCumulativeDomain(points) : getBalanceDomain(points);
  const curveType = isCumulative ? 'monotone' : 'stepAfter';
  const chartMargin = isCumulative
    ? { left: 0, right: 8, top: 12, bottom: 4 }
    : { left: 2, right: 10, top: 12, bottom: 4 };
  const formatAxisTick = (value) => formatTimestamp(value, {
    includeTime: !isCumulative && (activeRange === '7d' || repeatedDateKeys.has(getDateKey(value))),
  });
  const statusMessage = !hasAccountSelection
    ? isCumulative ? 'Select an account to view its journey.' : 'Select an account to review deposits and withdrawals.'
    : !hasFinancialActivity
      ? 'Your financial journey hasn\'t started yet.'
      : isCumulative && !hasClosedTrades
        ? 'No closed trades yet. Your capital movements are tracked, but true performance requires execution.'
        : null;
  const shouldRenderChart = hasAccountSelection && hasFinancialActivity && points.length > 1;
  const screenReaderSummary = isCumulative
    ? `Net trading P/L is ${formatCurrency(summary.netTradingPnl, currency)} across ${summary.closedTrades || 0} closed trades.`
    : `Current balance is ${formatCurrency(summary.currentBalance, currency)} from ${formatCurrency(summary.totalDeposits, currency)} in deposits, ${formatCurrency(summary.totalWithdrawals, currency)} in withdrawals, and ${formatCurrency(summary.balanceAdjustments, currency)} in balance adjustments.`;

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader
        title={(
          <span className="inline-flex items-center gap-2">
            Performance Curve
            <Info size={14} className="text-muted" aria-hidden="true" />
          </span>
        )}
        eyebrow="Track cumulative trading results without deposits affecting performance."
        action={(
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border/80 bg-surface p-1 " aria-label="Performance curve view">
              {curveViews.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setView(item.key)}
                  aria-pressed={view === item.key}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${view === item.key ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' : 'text-muted hover:text-foreground'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-border/80 bg-surface p-1 " aria-label="Performance curve time range">
              {chartPeriods.map((period) => (
                <button
                  key={period.range}
                  type="button"
                  onClick={() => onRangeChange(period.range)}
                  aria-pressed={activeRange === period.range}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${activeRange === period.range ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' : 'text-muted hover:text-foreground'}`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        )}
      />

      <p className="sr-only">{screenReaderSummary}</p>
      <SummaryStrip view={view} summary={summary} currency={currency} />

      {!shouldRenderChart ? (
        <EmptyState message={statusMessage || 'No executions recorded during this time.'} />
      ) : (
        <>
          {statusMessage && (
            <p className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted">
              {statusMessage}
            </p>
          )}
          <div className="h-72 min-w-0 rounded-lg border border-border/60 bg-surface-muted px-1 pt-3 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={chartMargin}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.42} />
                    <stop offset="55%" stopColor={stroke} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0.04} />
                  </linearGradient>
                  <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.72} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatAxisTick} stroke="rgb(var(--muted-foreground))" tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis domain={yDomain} stroke="rgb(var(--muted-foreground))" tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value, currency, { maximumFractionDigits: 0 })} width={62} />
                <Tooltip
                  cursor={{ stroke: cursorStroke, strokeOpacity: 0.42, strokeWidth: 1 }}
                  content={<PerformanceTooltip view={view} currency={currency} />}
                />
                <Area type={curveType} dataKey="value" stroke={stroke} strokeWidth={7} strokeOpacity={0.18} fill="none" dot={false} activeDot={false} filter={`url(#${glowId})`} isAnimationActive={false} />
                <Area
                  type={curveType}
                  dataKey="value"
                  stroke={stroke}
                  strokeWidth={3}
                  fill={`url(#${gradientId})`}
                  dot={isCumulative ? false : <EventDot />}
                  activeDot={isCumulative ? { r: 5, stroke: '#ecfdf5', strokeWidth: 2, fill: activeDotFill } : <ActiveEventDot />}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </DashboardCard>
  );
};

export default EquityCurveChart;
