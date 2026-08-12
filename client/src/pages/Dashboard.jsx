import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, ShieldAlert, Target, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import api from '../utils/api';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import MetricCard from '../components/dashboard/MetricCard';
import PerformanceCurveChart from '../components/dashboard/EquityCurveChart';
import SessionEdgeChart from '../components/dashboard/SessionEdgeChart';
import TradingCalendar from '../components/dashboard/TradingCalendar';
import PerformanceBreakdown from '../components/dashboard/PerformanceBreakdown';
import TopWinningPairs from '../components/dashboard/TopWinningPairs';
import TradeOutcomeChart from '../components/dashboard/TradeOutcomeChart';
import WeeklyGoalProgress from '../components/dashboard/WeeklyGoalProgress';
import RecentTrades from '../components/dashboard/RecentTrades';
import UpgradeCard from '../components/dashboard/UpgradeCard';
import DisciplineBanner from '../components/dashboard/DisciplineBanner';
import AnnouncementBanner from '../components/AnnouncementBanner';
import DashboardPromotionBanner from '../components/DashboardPromotionBanner';
import EdgeFinderWidget from '../components/dashboard/EdgeFinderWidget';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import DashboardEmptyState from '../components/dashboard/DashboardEmptyState';
import DashboardErrorState from '../components/dashboard/DashboardErrorState';
import { formatCurrency, formatNumber, formatPercent, getDateRange } from '../utils/dashboard';

const getInitialRange = (searchParams) => {
  if (searchParams.get('range')) return searchParams.get('range');
  if (searchParams.get('startDate') || searchParams.get('endDate')) return 'custom';
  return 'all';
};

const getInitialDates = (range, searchParams) => {
  if (range === 'custom') {
    return {
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
    };
  }

  const dates = getDateRange(range);
  return {
    startDate: dates.startDate || '',
    endDate: dates.endDate || '',
  };
};

const formatRatio = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plural = (count, singular, pluralLabel = `${singular}s`) => `${formatNumber(count, 0)} ${count === 1 ? singular : pluralLabel}`;



const getProfitFactorDisplay = ({ closedTrades, grossProfit, grossLoss, profitFactor }) => {
  if (!closedTrades || (!grossProfit && !grossLoss)) return '--';
  if (grossProfit === 0 && grossLoss > 0) return '0.00';
  if (grossLoss === 0 && grossProfit > 0) return '∞';
  if (profitFactor === null || profitFactor === undefined) return '--';
  return formatRatio(profitFactor);
};

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = getInitialRange(searchParams);
  const initialDates = getInitialDates(initialRange, searchParams);
  const [accountId, setAccountId] = useState(searchParams.get('accountId') || '');
  const [dateRange, setDateRange] = useState(initialRange);
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [dashboard, setDashboard] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (accountId) nextParams.set('accountId', accountId);
    if (dateRange) nextParams.set('range', dateRange);
    if (startDate) nextParams.set('startDate', startDate);
    if (endDate) nextParams.set('endDate', endDate);
    setSearchParams(nextParams, { replace: true });
  }, [accountId, dateRange, endDate, setSearchParams, startDate]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      setDashboard(null);

      try {
        const params = {};
        if (accountId) params.accountId = accountId;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        params._refresh = retryCount;

        const { data } = await api.get('/analytics/dashboard', {
          params,
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });

        setDashboard(data);
        setAccounts(data.accounts || []);
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED' || requestError.name === 'CanceledError') return;
        setError(requestError.response?.data?.message || 'We couldn\'t load your dashboard right now.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchDashboard();
    return () => controller.abort();
  }, [accountId, endDate, retryCount, startDate]);

  useEffect(() => {
    const refreshDashboard = () => setRetryCount((count) => count + 1);
    const handleStorageChange = (event) => {
      if (event.key === 'jahzjournal:data-version') refreshDashboard();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshDashboard();
    };

    window.addEventListener('jahzjournal:data-changed', refreshDashboard);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', refreshDashboard);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('jahzjournal:data-changed', refreshDashboard);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', refreshDashboard);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const currency = dashboard?.currency || 'USD';
  const summary = useMemo(() => dashboard?.summary || {}, [dashboard]);
  const outcomes = useMemo(() => dashboard?.tradeOutcomes || {}, [dashboard]);
  const performanceBreakdown = useMemo(() => dashboard?.performanceBreakdown || {}, [dashboard]);

  const metricCards = useMemo(() => {
    const totalTrades = Number(summary.totalTrades || 0);
    const closedTrades = Number(summary.closedTrades || 0);
    const openTrades = Math.max(totalTrades - closedTrades, 0);
    const netProfitLoss = Number(summary.netProfitLoss || 0);
    const wins = Number(outcomes.wins || 0);
    const losses = Number(outcomes.losses || 0);
    const breakevens = Number(outcomes.breakevens || 0);
    const grossProfit = Number(performanceBreakdown.grossProfit || 0);
    const grossLoss = Number(performanceBreakdown.grossLoss || 0);
    const drawdownPercentage = Number(summary.maximumDrawdownPercentage || 0);
    const noClosedTradeText = 'Log your first closed trade to unlock analytics.';
    const netTone = netProfitLoss > 0 ? 'positive' : netProfitLoss < 0 ? 'negative' : 'neutral';
    const netStatus = netProfitLoss > 0 ? 'Positive' : netProfitLoss < 0 ? 'Negative' : 'Breakeven';
    const winRateText = closedTrades
      ? `${plural(wins, 'win')} | ${plural(losses, 'loss', 'losses')} | ${formatNumber(breakevens, 0)} BE`
      : noClosedTradeText;
    const profitFactorValue = getProfitFactorDisplay({
      closedTrades,
      grossProfit,
      grossLoss,
      profitFactor: summary.profitFactor,
    });
    const profitFactorContext = !closedTrades
      ? noClosedTradeText
      : grossProfit === 0 && grossLoss > 0
        ? 'No gross profit yet'
        : grossLoss === 0 && grossProfit > 0
          ? 'No gross loss yet'
          : 'Gross profit / gross loss';

    return [
      {
        label: 'Total Net P/L',
        value: formatCurrency(netProfitLoss, currency, { signDisplay: netProfitLoss === 0 ? 'auto' : 'always' }),
        accent: netTone,
        valueTone: netTone,
        status: netStatus,
        statusTone: netTone,
        supportingText: closedTrades ? `${plural(closedTrades, 'closed trade')} contributing` : noClosedTradeText,
        icon: netProfitLoss < 0 ? TrendingDown : TrendingUp,
      },
      {
        label: 'Win Rate',
        value: closedTrades ? formatPercent(summary.winRate || 0) : '--',
        accent: 'blue',
        valueTone: closedTrades ? 'blue' : 'muted',
        status: !closedTrades ? 'No data' : closedTrades < 3 ? 'Low sample' : null,
        statusTone: 'neutral',
        supportingText: winRateText,
        icon: Target,
      },
      {
        label: 'Total Trades',
        value: formatNumber(totalTrades, 0),
        accent: 'purple',
        valueTone: 'purple',
        supportingText: totalTrades
          ? `${formatNumber(closedTrades, 0)} closed | ${formatNumber(openTrades, 0)} open`
          : 'Log your first trade to start tracking.',
        icon: Activity,
      },
      {
        label: 'Profit Factor',
        value: profitFactorValue,
        accent: 'amber',
        valueTone: profitFactorValue === '--' ? 'muted' : 'amber',
        supportingText: profitFactorContext,
        icon: Trophy,
      },
      {
        label: 'Maximum Drawdown',
        value: formatPercent(drawdownPercentage || 0),
        accent: 'negative',
        valueTone: drawdownPercentage > 0 ? 'negative' : 'neutral',
        supportingText: 'Largest peak-to-trough decline',
        icon: ShieldAlert,
      },
    ];
  }, [currency, outcomes, performanceBreakdown, summary]);

  const handleDateRangeChange = (nextRange) => {
    setDateRange(nextRange);
    if (nextRange === 'custom') return;

    const dates = getDateRange(nextRange);
    setStartDate(dates.startDate || '');
    setEndDate(dates.endDate || '');
  };

  const handleCustomDateChange = (field, value) => {
    setDateRange('custom');
    if (field === 'startDate') setStartDate(value);
    if (field === 'endDate') setEndDate(value);
  };

  return (
    <div className="space-y-4 pb-6">
      <DashboardHeader
        accounts={accounts}
        accountId={accountId}
        dateRange={dateRange}
        startDate={startDate}
        endDate={endDate}
        onAccountChange={setAccountId}
        onDateRangeChange={handleDateRangeChange}
        onCustomDateChange={handleCustomDateChange}
      />

      <AnnouncementBanner />
      <DashboardPromotionBanner />

      {loading && <DashboardSkeleton />}

      {!loading && error && (
        <DashboardErrorState message={error} onRetry={() => setRetryCount((count) => count + 1)} />
      )}

      {!loading && !error && dashboard && (
        <>
          <section className="grid min-w-0 gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {metricCards.map((card) => <MetricCard key={card.label} {...card} />)}
          </section>

          {accounts.length === 0 ? (
            <DashboardEmptyState type="accounts" />
          ) : Number(summary.totalTrades || 0) === 0 ? (
            <DashboardEmptyState type="trades" />
          ) : null}

          <section className="grid gap-4 xl:grid-cols-12">
            <PerformanceCurveChart
              className="xl:col-span-6"
              data={dashboard.performanceCurve || {}}
              currency={currency}
              activeRange={dateRange}
              onRangeChange={handleDateRangeChange}
              hasAccountSelection={accounts.length > 0 && (dashboard.selectedAccountIds || []).length > 0}
            />
            <SessionEdgeChart className="xl:col-span-3" data={dashboard.sessionPerformance || []} currency={currency} />
            <TradingCalendar className="xl:col-span-3" data={dashboard.calendar || []} currency={currency} />
            <PerformanceBreakdown className="xl:col-span-9" data={dashboard.performanceBreakdown || {}} currency={currency} />
            <RecentTrades className="xl:col-span-3 xl:row-span-2" trades={dashboard.recentTrades || []} currency={currency} />
            <TopWinningPairs className="xl:col-span-3" pairs={dashboard.topPairs || []} currency={currency} />
            <TradeOutcomeChart className="xl:col-span-3" outcomes={dashboard.tradeOutcomes || {}} />
            <WeeklyGoalProgress className="xl:col-span-3" goals={dashboard.weeklyGoals || []} currency={currency} />
            <div className="md:hidden xl:col-span-3">
              <UpgradeCard />
            </div>
          </section>
          
          <EdgeFinderWidget />

          <DisciplineBanner />
        </>
      )}
    </div>
  );
};

export default Dashboard;
