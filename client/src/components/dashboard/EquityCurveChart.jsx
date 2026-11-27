import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatNumber } from '../../utils/dashboard';
import {
  calculateYAxisDomain,
  detectInitialDepositJump,
  formatAxisCurrency,
  formatAxisDate,
  generateXAxisTicks,
  prepareAccountBalanceDisplayPoints,
} from '../../utils/chartAxis';

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
  account_start: 'Account created',
  opening_balance: 'Opening balance',
  period_start: 'Period start',
  period_end: 'Period end',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  payout: 'Payout',
  fee: 'Fee',
  trade: 'Closed trade',
  trade_win: 'Closed trade',
  trade_loss: 'Closed trade',
  trade_breakeven: 'Closed trade',
  trade_day: 'Trading day',
  balance_adjustment: 'Balance adjustment',
};

const eventColors = {
  account_start: '#64748b',
  opening_balance: '#64748b',
  period_start: '#64748b',
  period_end: '#64748b',
  deposit: '#38bdf8',
  withdrawal: '#f59e0b',
  payout: '#8b5cf6',
  fee: '#f43f5e',
  trade_win: '#10b981',
  trade_loss: '#ef4444',
  trade_breakeven: '#94a3b8',
  trade: '#10b981',
  trade_day: '#10b981',
  balance_adjustment: '#6366f1',
};

const eventTextTones = {
  account_start: 'text-muted',
  opening_balance: 'text-muted',
  period_start: 'text-muted',
  period_end: 'text-muted',
  deposit: 'text-sky-600 dark:text-sky-300',
  withdrawal: 'text-amber-600 dark:text-amber-300',
  payout: 'text-violet-600 dark:text-violet-300',
  fee: 'text-rose-600 dark:text-rose-300',
  trade_win: 'text-emerald-600 dark:text-emerald-300',
  trade_loss: 'text-red-600 dark:text-red-300',
  trade_breakeven: 'text-foreground',
  trade: 'text-emerald-600 dark:text-emerald-300',
  trade_day: 'text-emerald-600 dark:text-emerald-300',
  balance_adjustment: 'text-indigo-600 dark:text-indigo-300',
};

const eventTone = (point) => {
  if (eventTextTones[point.eventType]) return eventTextTones[point.eventType];
  const change = Number(point.change ?? point.tradePnl ?? 0);
  if (change > 0) return 'text-emerald-600 dark:text-emerald-300';
  if (change < 0) return 'text-red-600 dark:text-red-300';
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

const getCumulativeDomain = (points = []) => calculateYAxisDomain(points, { mode: 'cumulativePnl' }).domain;

const getBalanceDomain = (points = []) => calculateYAxisDomain(points, { mode: 'accountBalance' }).domain;

const EventDot = ({ cx, cy, payload, totalPoints = 0, isMobile = false }) => {
  if (cx === undefined || cy === undefined || !payload) return null;

  const isFunding = payload.eventType === 'opening_balance'
    || payload.eventType === 'deposit'
    || payload.eventType === 'withdrawal'
    || payload.eventType === 'payout'
    || payload.eventType === 'fee'
    || payload.eventType === 'balance_adjustment';
  const isBoundary = payload.eventType === 'account_start'
    || payload.eventType === 'period_start'
    || payload.eventType === 'period_end';

  // Hide boundary anchors once multiple events exist to prevent overlapping start markers
  if (isBoundary && totalPoints > 6) return null;

  const color = eventColors[payload.eventType] || '#94a3b8';

  if (isFunding) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isMobile ? 3.5 : 4}
        fill={color}
        stroke="rgb(var(--surface))"
        strokeWidth={1.75}
      />
    );
  }

  const denseThreshold = isMobile ? 16 : 24;
  if (totalPoints > denseThreshold) return null;

  const mediumThreshold = isMobile ? 9 : 14;
  const radius = isBoundary ? 2.75 : (totalPoints > mediumThreshold ? 2.25 : 3.25);
  const strokeWidth = totalPoints > mediumThreshold ? 1 : 1.5;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={color}
      fillOpacity={totalPoints > mediumThreshold ? 0.88 : 1}
      stroke="rgb(var(--surface))"
      strokeWidth={strokeWidth}
    />
  );
};

const ActiveEventDot = ({ cx, cy, payload, fallbackColor = '#10b981' }) => {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = eventColors[payload.eventType] || fallbackColor;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.2} />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="rgb(var(--surface))"
        strokeWidth={2}
      />
    </g>
  );
};

const formatResultBadge = (result) => {
  if (!result) return '';
  const upper = String(result).toUpperCase();
  if (upper === 'WIN') return ' (Win)';
  if (upper === 'LOSS') return ' (Loss)';
  if (upper === 'BREAKEVEN') return ' (Breakeven)';
  return '';
};

const PerformanceTooltip = ({ active, payload, view, currency }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload || {};
  const isCumulative = view === 'cumulativePnl';
  const eventType = String(point.eventType || '');
  const isTrade = eventType.startsWith('trade');
  const isFunding = eventType === 'opening_balance'
    || eventType === 'deposit'
    || eventType === 'withdrawal'
    || eventType === 'payout'
    || eventType === 'fee'
    || eventType === 'balance_adjustment';
  const isBoundary = eventType === 'account_start' || eventType === 'period_start' || eventType === 'period_end';
  const changeAmount = Number(point.change || 0);

  return (
    <div className="max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface px-3 py-2.5 text-xs shadow-lg dark:shadow-[0_20px_45px_rgba(2,6,23,0.65)]">
      <p className="font-bold text-foreground">
        {formatTimestamp(point.date, { includeTime: true, includeYear: true })}
      </p>

      {isCumulative ? (
        <div className="mt-1.5 space-y-0.5">
          <p className={Number(point.value || 0) < 0 ? 'font-semibold text-red-600 dark:text-red-300' : 'font-semibold text-emerald-600 dark:text-emerald-300'}>
            Cumulative P/L: {formatCurrency(point.value, currency)}
          </p>
          {(isTrade || eventType === 'trade_day') && (
            <p className={eventTone(point)}>
              {eventType === 'trade_day'
                ? `Day result${point.tradeCount > 1 ? ` (${point.tradeCount} trades)` : ''}`
                : 'Trade result'}
              : {signedCurrency(point.tradePnl ?? point.change, currency)}
            </p>
          )}
          {isBoundary && (
            <p className="text-[11px] text-muted">{point.label || eventLabels[eventType]}</p>
          )}
          {point.accountName && (
            <p className="text-[11px] text-muted">Account: {point.accountName}</p>
          )}
        </div>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          <p className="font-semibold text-emerald-600 dark:text-emerald-300">
            Balance: {formatCurrency(point.value, currency)}
          </p>
          {eventType === 'opening_balance' && (
            <>
              <p className={eventTone(point)}>Event: Opening balance</p>
              <p className="text-muted">
                Baseline: {formatCurrency(point.initialFundingAmount ?? point.change ?? point.value, currency)}
              </p>
            </>
          )}
          {eventType === 'deposit' && (
            <>
              <p className={eventTone(point)}>
                Event: {(point.isInitialFundingStart || point.source === 'startingBalance') ? 'Initial deposit (Starting balance)' : (point.label || 'Deposit')}
              </p>
              <p className="text-sky-600 dark:text-sky-300">
                {point.isInitialFundingStart ? 'Initial funding' : 'Deposit'}:{' '}
                {point.isInitialFundingStart
                  ? formatCurrency(point.initialFundingAmount ?? point.change ?? point.value, currency)
                  : signedCurrency(point.change, currency)}
              </p>
            </>
          )}
          {eventType === 'withdrawal' && (
            <>
              <p className={eventTone(point)}>Event: {point.label || 'Withdrawal'}</p>
              <p className="text-amber-600 dark:text-amber-300">
                Withdrawal: {signedCurrency(point.change, currency)}
              </p>
            </>
          )}
          {eventType === 'payout' && (
            <>
              <p className={eventTone(point)}>Event: {point.label || 'Payout'}</p>
              <p className="text-violet-600 dark:text-violet-300">
                Payout: {signedCurrency(point.change, currency)}
              </p>
            </>
          )}
          {eventType === 'fee' && (
            <>
              <p className={eventTone(point)}>Event: {point.label || 'Fee'}</p>
              <p className="text-rose-600 dark:text-rose-300">
                Fee: {signedCurrency(point.change, currency)}
              </p>
            </>
          )}
          {eventType === 'balance_adjustment' && (
            <>
              <p className={eventTone(point)}>Event: {point.label || 'Balance adjustment'}</p>
              <p className="text-indigo-600 dark:text-indigo-300">Adjustment: {signedCurrency(point.change, currency)}</p>
            </>
          )}
          {isFunding && point.note && (
            <p className="text-[11px] text-muted truncate max-w-[16rem]">Note: {point.note}</p>
          )}
          {isTrade && (
            <>
              <p className={eventTone(point)}>
                Event: {point.label || 'Closed trade'}{formatResultBadge(point.result)}
              </p>
              <p className={Number(point.tradePnl ?? point.change ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-300' : Number(point.tradePnl ?? point.change ?? 0) < 0 ? 'text-red-600 dark:text-red-300' : 'text-muted'}>
                Realized P/L: {signedCurrency(point.tradePnl ?? point.change, currency)}
              </p>
            </>
          )}
          {!isFunding && !isTrade && (
            <>
              <p className={eventTone(point)}>Event: {point.label || eventLabels[eventType] || 'Snapshot'}</p>
              {!isBoundary && changeAmount !== 0 && (
                <p className={changeAmount > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
                  Change: {signedCurrency(changeAmount, currency)}
                </p>
              )}
            </>
          )}
          {point.accountName && (
            <p className="text-[11px] text-muted">Account: {point.accountName}</p>
          )}
        </div>
      )}
    </div>
  );
};

const SummaryStrip = ({ view, summary = {}, currency }) => {
  const isCumulative = view === 'cumulativePnl';
  const returnLabel = summary.returnMethod === 'TWR' ? 'Return (TWR)' : 'Return';
  const returnUnavailable = summary.returnMethod === 'UNAVAILABLE' || summary.tradingReturnPercentage === null;
  const items = isCumulative
    ? [
      { label: 'Net P/L', value: signedCurrency(summary.netTradingPnl, currency), tone: Number(summary.netTradingPnl || 0) < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300' },
      { label: returnLabel, value: returnUnavailable ? '--' : signedPercent(summary.tradingReturnPercentage), tone: returnUnavailable ? 'text-muted' : Number(summary.tradingReturnPercentage || 0) < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300' },
      { label: 'Closed trades', value: formatNumber(summary.closedTrades || 0, 0), tone: 'text-foreground' },
    ]
    : [
      { label: 'Total deposits', value: formatCurrency(summary.totalDeposits, currency), tone: Number(summary.totalDeposits || 0) > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-muted' },
      { label: 'Total withdrawals', value: formatCurrency(summary.totalWithdrawals, currency), tone: Number(summary.totalWithdrawals || 0) > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-muted' },
      ...(summary.payouts > 0 || summary.fees > 0 || summary.balanceAdjustments !== 0 ? [{
        label: 'Net cash flow',
        value: signedCurrency(summary.netCashFlow || 0, currency),
        tone: Number(summary.netCashFlow || 0) >= 0 ? 'text-sky-600 dark:text-sky-300' : 'text-amber-600 dark:text-amber-300',
      }] : []),
      { label: 'Current balance', value: formatCurrency(summary.currentBalance, currency), tone: Number(summary.currentBalance || 0) > 0 ? 'text-emerald-600 dark:text-emerald-300' : Number(summary.currentBalance || 0) < 0 ? 'text-red-600 dark:text-red-300' : 'text-foreground' },
    ];

  return (
    <div className={`mb-4 grid gap-2 text-xs ${items.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
  const [containerWidth, setContainerWidth] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : 1024
  ));
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  ));
  const chartId = useId().replace(/:/g, '');
  const rawPoints = useMemo(() => data?.[view] || [], [data, view]);
  const points = useMemo(
    () => (view === 'accountBalance' ? prepareAccountBalanceDisplayPoints(rawPoints) : rawPoints),
    [rawPoints, view],
  );
  const chartPoints = useMemo(
    () => points.map((point, index) => ({
      ...point,
      xKey: `${point.date || 'point'}__${index}`,
    })),
    [points],
  );
  const chartWrapperRef = useRef(null);

  useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if (event.key === 'Tab' || event.key?.startsWith('Arrow')) {
        chartWrapperRef.current?.setAttribute('data-focus-source', 'keyboard');
      }
    };
    const handleWindowPointer = () => {
      chartWrapperRef.current?.setAttribute('data-focus-source', 'pointer');
    };
    window.addEventListener('keydown', handleWindowKeyDown, true);
    window.addEventListener('pointerdown', handleWindowPointer, true);
    window.addEventListener('touchstart', handleWindowPointer, true);
    window.addEventListener('mousedown', handleWindowPointer, true);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true);
      window.removeEventListener('pointerdown', handleWindowPointer, true);
      window.removeEventListener('touchstart', handleWindowPointer, true);
      window.removeEventListener('mousedown', handleWindowPointer, true);
    };
  }, []);

  const repeatedDateKeys = useMemo(() => getRepeatedDateKeys(points), [points]);
  const summary = data?.summary || {};
  const hasFinancialActivity = Number(summary.totalDeposits || 0) > 0
    || Number(summary.totalWithdrawals || 0) > 0
    || Number(summary.payouts || 0) > 0
    || Number(summary.fees || 0) > 0
    || Number(summary.closedTrades || 0) > 0
    || Number(summary.balanceAdjustments || 0) !== 0
    || points.length > 1;
  const hasClosedTrades = Number(summary.closedTrades || 0) > 0;
  const isCumulative = view === 'cumulativePnl';
  const shouldRenderChart = hasAccountSelection && hasFinancialActivity && points.length > 1;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewport = () => {
      setIsMobileViewport(window.innerWidth < 640);
      if (chartWrapperRef.current) {
        const nextWidth = Math.round(chartWrapperRef.current.getBoundingClientRect().width);
        if (nextWidth > 0) setContainerWidth(nextWidth);
      }
    };
    syncViewport();

    let observer;
    if (typeof ResizeObserver !== 'undefined' && chartWrapperRef.current) {
      observer = new ResizeObserver((entries) => {
        const entryWidth = Math.round(entries?.[0]?.contentRect?.width || 0);
        if (entryWidth > 0) setContainerWidth(entryWidth);
      });
      observer.observe(chartWrapperRef.current);
    }

    window.addEventListener('resize', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      observer?.disconnect();
    };
  }, [shouldRenderChart]);

  const endingValue = Number(points[points.length - 1]?.value || 0);
  const isNegativePerformance = isCumulative && endingValue < 0;
  const stroke = isNegativePerformance ? '#ef4444' : '#10b981';
  const activeDotFill = isNegativePerformance ? '#ef4444' : '#10b981';
  const cursorStroke = isNegativePerformance ? '#f87171' : '#34d399';
  const gradientId = `performanceFill-${view}-${chartId}`;
  const glowId = `performanceGlow-${view}-${chartId}`;

  const yDomain = useMemo(
    () => (isCumulative ? getCumulativeDomain(points) : getBalanceDomain(points)),
    [isCumulative, points],
  );
  const yAxisConfig = useMemo(
    () => calculateYAxisDomain(points, {
      mode: view,
      targetTickCount: isMobileViewport ? 5 : 5,
      maxTickCount: 7,
    }),
    [points, view, isMobileViewport],
  );
  const yTicks = yAxisConfig.ticks;
  const xAxisConfig = useMemo(
    () => generateXAxisTicks(chartPoints, {
      activeRange,
      isMobile: isMobileViewport,
      containerWidth,
    }),
    [chartPoints, activeRange, isMobileViewport, containerWidth],
  );
  const depositJumpInfo = useMemo(
    () => (isCumulative ? { hasInitialDepositJump: false, fundingPoints: [] } : detectInitialDepositJump(chartPoints)),
    [isCumulative, chartPoints],
  );

  const maxYTickLength = useMemo(() => {
    const labels = yTicks.map((tick) => formatAxisCurrency(tick, currency, { step: yAxisConfig.step }).length);
    return Math.max(4, ...labels);
  }, [yTicks, currency, yAxisConfig.step]);
  const yAxisWidth = Math.min(Math.max(maxYTickLength * 7 + 14, isMobileViewport ? 50 : 54), 84);
  const showZeroReferenceLine = yDomain[0] <= 0 && yDomain[1] >= 0;
  const curveType = 'monotone';
  const chartMargin = { left: 2, right: 16, top: 12, bottom: 6 };
  const formatAxisTick = (value) => formatAxisDate(value, {
    activeRange,
    ...xAxisConfig.meta,
    repeatedDateCount: repeatedDateKeys.size,
  });

  const statusMessage = !hasAccountSelection
    ? isCumulative ? 'Select an account to view its journey.' : 'Select an account to review deposits and withdrawals.'
    : !hasFinancialActivity
      ? 'Your financial journey hasn\'t started yet.'
      : isCumulative && !hasClosedTrades
        ? 'No closed trades yet. Your capital movements are tracked, but true performance requires execution.'
        : null;
  const screenReaderSummary = isCumulative
    ? `Net trading P/L is ${formatCurrency(summary.netTradingPnl, currency)} across ${summary.closedTrades || 0} closed trades.`
    : `Current balance is ${formatCurrency(summary.currentBalance, currency)} from ${formatCurrency(summary.totalDeposits, currency)} in deposits, ${formatCurrency(summary.totalWithdrawals, currency)} in withdrawals, and ${formatCurrency(summary.balanceAdjustments, currency)} in balance adjustments.`;

  return (
    <DashboardCard className={`p-4 sm:p-5 ${className}`}>
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
          {!isCumulative && (
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-muted/50 px-3 py-1.5 text-[11px] text-muted">
              {(depositJumpInfo.hasInitialFundingStart || depositJumpInfo.hasInitialDepositJump) && depositJumpInfo.initialDepositPoint ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400" aria-hidden="true" />
                    Initial deposit:{' '}
                    <strong className="font-semibold text-foreground">
                      {formatCurrency(
                        depositJumpInfo.initialDepositPoint.initialFundingAmount
                          ?? depositJumpInfo.initialDepositPoint.change
                          ?? depositJumpInfo.initialDepositPoint.value,
                        currency,
                      )}
                    </strong>{' '}
                    ({formatTimestamp(depositJumpInfo.initialDepositPoint.date, { includeYear: true })})
                  </span>
                  {depositJumpInfo.postDepositMin !== null && depositJumpInfo.postDepositMax !== null && depositJumpInfo.postDepositMax > depositJumpInfo.postDepositMin && (
                    <span>
                      Post-funding range:{' '}
                      <strong className="font-semibold text-foreground">
                        {formatCurrency(depositJumpInfo.postDepositMin, currency)} – {formatCurrency(depositJumpInfo.postDepositMax, currency)}
                      </strong>
                    </span>
                  )}
                </div>
              ) : (
                <span>Reflects deposits, withdrawals, payouts, fees, balance adjustments, and realized trading P/L.</span>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden="true" />
                  Deposit
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
                  Withdrawal
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true" />
                  Payout
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                  Fee
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
                  Adjustment
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Trade
                </span>
              </div>
            </div>
          )}
          <div
            ref={chartWrapperRef}
            data-focus-source="pointer"
            onPointerDownCapture={(e) => e.currentTarget.setAttribute('data-focus-source', 'pointer')}
            onTouchStartCapture={(e) => e.currentTarget.setAttribute('data-focus-source', 'pointer')}
            onMouseDownCapture={(e) => e.currentTarget.setAttribute('data-focus-source', 'pointer')}
            className="h-[330px] min-[375px]:h-[350px] min-w-0 rounded-xl border border-border/60 bg-surface-muted/70 dark:bg-surface-muted px-1.5 sm:px-2 pt-3 pb-1 sm:h-80 [&_.recharts-wrapper:focus]:outline-none [&_.recharts-wrapper_*:focus]:outline-none [&_.recharts-surface:focus]:outline-none [&[data-focus-source='keyboard']_.recharts-surface:focus-visible]:outline-solid [&[data-focus-source='keyboard']_.recharts-surface:focus-visible]:outline-2 [&[data-focus-source='keyboard']_.recharts-surface:focus-visible]:outline-emerald-500/70 [&[data-focus-source='keyboard']_.recharts-surface:focus-visible]:-outline-offset-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints} margin={chartMargin}>
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
                <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.55} vertical={false} />
                <XAxis
                  dataKey="xKey"
                  ticks={xAxisConfig.ticks}
                  tickFormatter={formatAxisTick}
                  stroke="rgb(var(--muted-foreground))"
                  tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={isMobileViewport ? 18 : 24}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  stroke="rgb(var(--muted-foreground))"
                  tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatAxisCurrency(value, currency, { step: yAxisConfig.step })}
                  width={yAxisWidth}
                />
                {showZeroReferenceLine && (
                  <ReferenceLine
                    y={0}
                    stroke="rgb(var(--muted-foreground))"
                    strokeOpacity={isCumulative ? 0.5 : 0.32}
                    strokeDasharray="4 4"
                  />
                )}
                {!isCumulative && !chartPoints[0]?.isInitialFundingStart && depositJumpInfo.hasInitialDepositJump && (depositJumpInfo.initialDepositPoint?.xKey || depositJumpInfo.initialDepositPoint?.date) && (
                  <ReferenceLine
                    x={depositJumpInfo.initialDepositPoint.xKey || depositJumpInfo.initialDepositPoint.date}
                    stroke="#38bdf8"
                    strokeOpacity={0.45}
                    strokeDasharray="3 3"
                  />
                )}
                <Tooltip
                  cursor={{ stroke: cursorStroke, strokeOpacity: 0.45, strokeWidth: 1.25 }}
                  content={<PerformanceTooltip view={view} currency={currency} />}
                />
                <Area type={curveType} dataKey="value" stroke={stroke} strokeWidth={7} strokeOpacity={0.18} fill="none" dot={false} activeDot={false} filter={`url(#${glowId})`} isAnimationActive={false} />
                <Area
                  type={curveType}
                  dataKey="value"
                  stroke={stroke}
                  strokeWidth={2.75}
                  fill={`url(#${gradientId})`}
                  dot={isCumulative
                    ? false
                    : (dotProps) => {
                      const { key, ...rest } = dotProps;
                      return (
                        <EventDot
                          key={key ?? rest.index}
                          {...rest}
                          totalPoints={points.length}
                          isMobile={isMobileViewport}
                        />
                      );
                    }}
                  activeDot={(dotProps) => {
                    const { key, ...rest } = dotProps;
                    return (
                      <ActiveEventDot
                        key={key ?? rest.index}
                        {...rest}
                        fallbackColor={activeDotFill}
                      />
                    );
                  }}
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
