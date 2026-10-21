import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  BarChart, Bar, Cell, LineChart, Line, AreaChart, Area, 
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { 
  Filter, FilterX, ChevronDown, ChevronUp, TrendingUp, TrendingDown, 
  DollarSign, Award, Target, BarChart2, ShieldAlert, Sparkles, 
  Clock, Compass, Layers, Zap, CheckCircle2, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Activity, Calendar, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/useAuth';
import { generatePerformancePdfReport } from '../utils/pdfReportService';
import { createCacheKey, getCachedData, setCachedData } from '../utils/apiCache';

const groupOptions = [
  { id: 'pair', label: 'Pair / Symbol' },
  { id: 'session', label: 'Session' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'setup', label: 'Setup' },
  { id: 'direction', label: 'Direction' },
  { id: 'weekday', label: 'Day of Week' },
  { id: 'timeframe', label: 'Timeframe' },
  { id: 'emotion', label: 'Emotion' },
  { id: 'ruleViolation', label: 'Rule Violation' },
];

const emptyFilters = {
  accountId: '',
  startDate: '',
  endDate: '',
  pair: '',
  session: '',
  setup: '',
  strategy: '',
  direction: '',
  timeframe: '',
};

const inputStyle = "mt-1.5 block w-full rounded-xl border border-border/80 bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted/60 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20";

const Analytics = () => {
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [groupBy, setGroupBy] = useState('pair');
  const [performance, setPerformance] = useState(null);
  const [equityCurve, setEquityCurve] = useState([]);
  const [equityMetrics, setEquityMetrics] = useState(null);
  const [drawdown, setDrawdown] = useState(null);
  const [directionPerformance, setDirectionPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { user } = useAuth();

  const handleExportPdf = async () => {
    const plan = user?.subscriptionPlan || 'FREE';
    const role = user?.role;
    const isAllowed = ['PRO', 'MENTOR'].includes(plan) || ['SUPER_ADMIN', 'ADMIN', 'MENTOR'].includes(role);

    if (!isAllowed) {
      toast.error('PDF Report Export is exclusive to PRO & MENTOR plans. Please upgrade your account.');
      return;
    }

    try {
      setExportingPdf(true);
      toast.loading('Generating Performance PDF...', { id: 'pdf-gen' });
      await generatePerformancePdfReport({
        user,
        performance,
        equityMetrics,
        drawdown,
        filters,
        breakdownData: performance?.data || []
      });
      toast.success('PDF report exported successfully!', { id: 'pdf-gen' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF. Please try again.', { id: 'pdf-gen' });
    } finally {
      setExportingPdf(false);
    }
  };

  // Curve Mode & Date Preset Controls
  const [curveMode, setCurveMode] = useState('cumulative'); // 'cumulative' | 'balance'
  const [activeDatePreset, setActiveDatePreset] = useState('ALL');

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, val]) => val !== '').length;
  }, [filters]);

  const hasAdvancedFilters = useMemo(() => {
    return Boolean(filters.session || filters.direction || filters.timeframe || filters.setup || filters.strategy);
  }, [filters]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ groupBy });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return params;
  }, [filters, groupBy]);

  const filterQuery = useMemo(() => new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  ), [filters]);

  const fetchAnalytics = useCallback(async () => {
    const perfKey = createCacheKey(`/analytics/performance?${queryParams.toString()}`);
    const eqKey = createCacheKey(`/analytics/equity-curve?${filterQuery.toString()}`);
    const ddKey = createCacheKey(`/analytics/drawdown?${filterQuery.toString()}`);
    const dirKey = createCacheKey(`/analytics/performance?groupBy=direction&${filterQuery.toString()}`);

    const cachedPerf = getCachedData(perfKey);
    const cachedEq = getCachedData(eqKey);
    const cachedDd = getCachedData(ddKey);
    const cachedDir = getCachedData(dirKey);

    if (cachedPerf && cachedEq && cachedDd && cachedDir) {
      setPerformance(cachedPerf.data);
      setEquityCurve(cachedEq.data.data || []);
      setEquityMetrics(cachedEq.data.metrics || null);
      setDrawdown(cachedDd.data);
      setDirectionPerformance(cachedDir.data.data || []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const [performanceResponse, equityResponse, drawdownResponse, directionResponse] = await Promise.all([
        api.get(`/analytics/performance?${queryParams.toString()}`),
        api.get(`/analytics/equity-curve?${filterQuery.toString()}`),
        api.get(`/analytics/drawdown?${filterQuery.toString()}`),
        api.get(`/analytics/performance?groupBy=direction&${filterQuery.toString()}`),
      ]);

      setCachedData(perfKey, performanceResponse.data, { staleTime: 60000 });
      setCachedData(eqKey, equityResponse.data, { staleTime: 60000 });
      setCachedData(ddKey, drawdownResponse.data, { staleTime: 60000 });
      setCachedData(dirKey, directionResponse.data, { staleTime: 60000 });

      setPerformance(performanceResponse.data);
      setEquityCurve(equityResponse.data.data || []);
      setEquityMetrics(equityResponse.data.metrics || null);
      setDrawdown(drawdownResponse.data);
      setDirectionPerformance(directionResponse.data.data || []);
    } catch (error) {
      if (!cachedPerf) {
        toast.error(error.response?.data?.message || 'We had trouble pulling your analytics.');
      }
    } finally {
      setLoading(false);
    }
  }, [filterQuery, queryParams]);

  useEffect(() => {
    const accountsKey = createCacheKey('/accounts');
    const cachedAccounts = getCachedData(accountsKey);
    if (cachedAccounts) {
      setAccounts(Array.isArray(cachedAccounts.data) ? cachedAccounts.data : cachedAccounts.data.accounts || []);
    }

    const loadAccounts = async () => {
      try {
        const { data } = await api.get('/accounts');
        setCachedData(accountsKey, data, { staleTime: 120000 });
        setAccounts(data);
      } catch (error) {
        if (!cachedAccounts) {
          toast.error(error.response?.data?.message || 'We couldn\'t load your accounts.');
        }
      }
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const applyDatePreset = (preset) => {
    setActiveDatePreset(preset);
    const now = new Date();
    let startDate = '';

    if (preset === '7D') {
      startDate = new Date(now.setDate(now.getDate() - 7)).toISOString().slice(0, 10);
    } else if (preset === '30D') {
      startDate = new Date(now.setDate(now.getDate() - 30)).toISOString().slice(0, 10);
    } else if (preset === '90D') {
      startDate = new Date(now.setDate(now.getDate() - 90)).toISOString().slice(0, 10);
    } else if (preset === '1Y') {
      startDate = new Date(now.setDate(now.getDate() - 365)).toISOString().slice(0, 10);
    } else if (preset === 'ALL') {
      startDate = '';
    }

    setFilters((current) => ({
      ...current,
      startDate,
      endDate: '',
    }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setGroupBy('pair');
    setActiveDatePreset('ALL');
    setShowAdvancedFilters(false);
  };

  const handleRowClick = (groupKey) => {
    if (groupBy === 'pair') {
      updateFilter('pair', groupKey);
      toast.success(`Filtered analytics to pair: ${groupKey}`);
    } else if (groupBy === 'session') {
      updateFilter('session', groupKey);
      toast.success(`Filtered analytics to session: ${groupKey}`);
    } else if (groupBy === 'direction') {
      updateFilter('direction', groupKey);
      toast.success(`Filtered analytics to direction: ${groupKey}`);
    } else if (groupBy === 'timeframe') {
      updateFilter('timeframe', groupKey);
      toast.success(`Filtered analytics to timeframe: ${groupKey}`);
    }
  };

  // Base Summary Data
  const summary = performance?.summary || {};
  const groupedData = performance?.data || [];
  const hasData = groupedData.length > 0;
  const netPnl = Number(summary.netRealisedProfitLoss || 0);

  const capitalMetrics = useMemo(() => {
    if (equityMetrics) return equityMetrics;
    const totalDep = accounts.reduce((acc, a) => acc + Number(a.startingBalance || 0), 0);
    return {
      totalDeposits: totalDep,
      totalWithdrawals: 0,
      tradingPnl: netPnl,
      currentAccountBalance: totalDep + netPnl,
    };
  }, [equityMetrics, accounts, netPnl]);

  // Dynamic Edge Calculation
  const edgeSummary = useMemo(() => {
    if (!hasData || summary.totalTrades < 2) return null;

    // Sort by Net P/L
    const sortedByPnl = [...groupedData].sort((a, b) => Number(b.netRealisedProfitLoss || 0) - Number(a.netRealisedProfitLoss || 0));
    const bestPnlItem = sortedByPnl[0];
    const worstPnlItem = sortedByPnl[sortedByPnl.length - 1];

    // Sort by Win Rate (with min 2 trades)
    const sortedByWinRate = [...groupedData]
      .filter((item) => (item.associatedTradeCount ?? item.totalTrades ?? 0) >= 1)
      .sort((a, b) => Number(b.winRate || 0) - Number(a.winRate || 0));
    const bestWinRateItem = sortedByWinRate[0];

    // Sort by Risk:Reward
    const sortedByRR = [...groupedData]
      .filter((item) => item.averageRiskRewardRatio !== null && item.averageRiskRewardRatio !== undefined)
      .sort((a, b) => Number(b.averageRiskRewardRatio || 0) - Number(a.averageRiskRewardRatio || 0));
    const bestRRItem = sortedByRR[0];

    return {
      bestPnl: bestPnlItem && bestPnlItem.netRealisedProfitLoss > 0 ? bestPnlItem : null,
      worstPnl: worstPnlItem && worstPnlItem.netRealisedProfitLoss < 0 ? worstPnlItem : null,
      bestWinRate: bestWinRateItem || null,
      bestRR: bestRRItem || null,
    };
  }, [groupedData, hasData, summary.totalTrades]);

  // Top Performers & Weakest Performers (Top 3)
  const topPerformers = useMemo(() => {
    if (!hasData) return [];
    return [...groupedData]
      .filter((item) => Number(item.netRealisedProfitLoss || 0) > 0)
      .sort((a, b) => Number(b.netRealisedProfitLoss || 0) - Number(a.netRealisedProfitLoss || 0))
      .slice(0, 3);
  }, [groupedData, hasData]);

  const weakestPerformers = useMemo(() => {
    if (!hasData) return [];
    return [...groupedData]
      .filter((item) => Number(item.netRealisedProfitLoss || 0) < 0)
      .sort((a, b) => Number(a.netRealisedProfitLoss || 0) - Number(b.netRealisedProfitLoss || 0))
      .slice(0, 3);
  }, [groupedData, hasData]);

  // Long vs Short Performance Breakdown
  const longShortMetrics = useMemo(() => {
    if (!directionPerformance || directionPerformance.length === 0) return null;
    const longData = directionPerformance.find((d) => d.key === 'BUY') || null;
    const shortData = directionPerformance.find((d) => d.key === 'SELL') || null;
    return { longData, shortData };
  }, [directionPerformance]);

  // Extended Drawdown Analysis Metrics
  const drawdownAnalysis = useMemo(() => {
    if (!drawdown || !equityCurve || equityCurve.length === 0) return null;

    const maxDd = Number(drawdown.maximumDrawdown || 0);
    const lastEquityPoint = equityCurve[equityCurve.length - 1];
    const peakEquity = Math.max(...equityCurve.map((p) => Number(p.equity || 0)));
    const currentEquity = Number(lastEquityPoint?.equity || 0);
    const currentDd = Math.max(0, peakEquity - currentEquity);

    // Calculate Recovery Percentage
    const recoveryPct = peakEquity > 0 ? Math.min(100, Math.max(0, (currentEquity / peakEquity) * 100)) : 100;

    // Calculate Consecutive Drawdown Streak
    let maxStreak = 0;
    let currentStreak = 0;
    let runningPeak = 0;
    equityCurve.forEach((point) => {
      const eq = Number(point.equity || 0);
      if (eq > runningPeak) {
        runningPeak = eq;
        currentStreak = 0;
      } else if (eq < runningPeak) {
        currentStreak += 1;
        maxStreak = Math.max(maxStreak, currentStreak);
      }
    });

    return {
      maxDd,
      currentDd,
      recoveryPct: Number(recoveryPct.toFixed(1)),
      longestStreak: maxStreak,
      drawdownSeries: (drawdown.data || []).map((point) => ({
        timestamp: point.timestamp,
        dd: Number(point.drawdownAmount || 0),
      })),
    };
  }, [drawdown, equityCurve]);

  // Derived JAHZ AI Insights
  const aiInsights = useMemo(() => {
    if (!hasData || summary.totalTrades < 2) return null;

    const insights = [];

    if (edgeSummary?.bestPnl) {
      insights.push(`Your strongest edge in this dataset is ${groupBy.toUpperCase()}: "${edgeSummary.bestPnl.label}" generating +$${Number(edgeSummary.bestPnl.netRealisedProfitLoss).toFixed(2)} across ${edgeSummary.bestPnl.associatedTradeCount ?? edgeSummary.bestPnl.totalTrades} trades.`);
    }

    if (edgeSummary?.worstPnl) {
      insights.push(`Your largest profit leak is ${groupBy.toUpperCase()}: "${edgeSummary.worstPnl.label}" with -$${Math.abs(Number(edgeSummary.worstPnl.netRealisedProfitLoss)).toFixed(2)} net loss.`);
    }

    if (longShortMetrics?.longData && longShortMetrics?.shortData) {
      const longPnl = Number(longShortMetrics.longData.netRealisedProfitLoss || 0);
      const shortPnl = Number(longShortMetrics.shortData.netRealisedProfitLoss || 0);
      if (longPnl > shortPnl && shortPnl < 0) {
        insights.push(`Significant directional asymmetry detected: Long executions are profitable (+$${longPnl.toFixed(2)}) while Short executions are leaking capital (-$${Math.abs(shortPnl).toFixed(2)}).`);
      } else if (shortPnl > longPnl && longPnl < 0) {
        insights.push(`Significant directional asymmetry detected: Short executions are profitable (+$${shortPnl.toFixed(2)}) while Long executions are leaking capital (-$${Math.abs(longPnl).toFixed(2)}).`);
      }
    }

    if (summary?.profitFactor && Number(summary.profitFactor) > 1.5) {
      insights.push(`Solid risk management: Your Profit Factor of ${summary.profitFactor} indicates strong expectancy per dollar risked.`);
    } else if (summary?.profitFactor && Number(summary.profitFactor) < 1.0) {
      insights.push(`Caution: Profit Factor is below 1.00 (${summary.profitFactor}). Consider reducing position size on lower-confidence setups.`);
    }

    return insights.length > 0 ? insights : null;
  }, [edgeSummary, groupBy, hasData, longShortMetrics, summary]);

  return (
    <div className="space-y-6 text-foreground font-sans pb-12">
      <SEO title="Analytics Command Center | JAHZJOURNALS" description="Professional trading analytics, edge detection, drawdown recovery, and execution breakdown." />
      
      <Breadcrumbs />

      {/* 1. Header & Active Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Filter size={11} /> {activeFilterCount} active
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">
            Deep-dive performance metrics, equity trajectory, and execution edge.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {activeFilterCount > 0 && (
            <button 
              type="button" 
              onClick={clearFilters} 
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-muted transition"
            >
              <FilterX size={13} />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            <Download size={14} />
            <span>{exportingPdf ? 'Exporting...' : 'Export PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* 2. Structured Filter Panel */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Filter Executions</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
          >
            <span>{showAdvancedFilters ? 'Fewer filters' : hasAdvancedFilters ? 'Advanced filters (active)' : 'Advanced filters'}</span>
            {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Primary Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label htmlFor="analytics-account" className="block text-xs font-medium text-foreground">Account</label>
            <select id="analytics-account" value={filters.accountId} onChange={(e) => updateFilter('accountId', e.target.value)} className={inputStyle}>
              <option value="">All Accounts</option>
              {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="analytics-pair" className="block text-xs font-medium text-foreground">Pair / Symbol</label>
            <input id="analytics-pair" value={filters.pair} onChange={(e) => updateFilter('pair', e.target.value)} placeholder="e.g. EURUSD, XAUUSD" className={`${inputStyle} uppercase font-mono font-medium`} />
          </div>

          <div>
            <label htmlFor="analytics-start-date" className="block text-xs font-medium text-foreground">From Date</label>
            <input id="analytics-start-date" type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className={inputStyle} />
          </div>

          <div>
            <label htmlFor="analytics-end-date" className="block text-xs font-medium text-foreground">To Date</label>
            <input id="analytics-end-date" type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className={inputStyle} />
          </div>
        </div>

        {/* Advanced Filters Row (Collapsible) */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-3.5 border-t border-border/60">
            <div>
              <label htmlFor="analytics-direction" className="block text-xs font-medium text-foreground">Direction</label>
              <select id="analytics-direction" value={filters.direction} onChange={(e) => updateFilter('direction', e.target.value)} className={inputStyle}>
                <option value="">Any Direction</option>
                <option value="BUY">Long (Buy)</option>
                <option value="SELL">Short (Sell)</option>
              </select>
            </div>

            <div>
              <label htmlFor="analytics-session" className="block text-xs font-medium text-foreground">Session</label>
              <select id="analytics-session" value={filters.session} onChange={(e) => updateFilter('session', e.target.value)} className={inputStyle}>
                <option value="">Any Session</option>
                <option value="ASIAN">Asian</option>
                <option value="LONDON">London</option>
                <option value="NEW_YORK">New York</option>
                <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="analytics-timeframe" className="block text-xs font-medium text-foreground">Timeframe</label>
              <input id="analytics-timeframe" value={filters.timeframe} onChange={(e) => updateFilter('timeframe', e.target.value)} placeholder="e.g. 5M, 15M, 1H" className={inputStyle} />
            </div>

            <div>
              <label htmlFor="analytics-setup" className="block text-xs font-medium text-foreground">Setup ID</label>
              <input id="analytics-setup" value={filters.setup} onChange={(e) => updateFilter('setup', e.target.value)} placeholder="Filter by setup" className={inputStyle} />
            </div>

            <div>
              <label htmlFor="analytics-strategy" className="block text-xs font-medium text-foreground">Strategy ID</label>
              <input id="analytics-strategy" value={filters.strategy} onChange={(e) => updateFilter('strategy', e.target.value)} placeholder="Filter by strategy" className={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-12 text-center text-muted font-medium shadow-sm flex items-center justify-center gap-3">
          <Activity size={20} className="animate-spin text-emerald-500" />
          <span>Gathering your trading analytics...</span>
        </div>
      ) : (
        <>
          {/* 3. Core Performance KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
            {/* Net P/L */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Net Realised P/L</span>
                <DollarSign size={16} className={netPnl >= 0 ? "text-emerald-400" : "text-rose-400"} />
              </div>
              <div className="mt-3">
                <p className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-muted">{summary.closedTrades || 0} closed trades</p>
              </div>
            </div>

            {/* Win Rate */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Win Rate</span>
                <Award size={16} className="text-sky-400" />
              </div>
              <div className="mt-3">
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  {Number(summary.winRate || 0).toFixed(1)}%
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  <span className="text-emerald-400 font-semibold">{summary.winningTrades || 0}W</span> · <span className="text-rose-400 font-semibold">{summary.losingTrades || 0}L</span> · <span className="text-muted">{summary.breakEvenTrades || 0}BE</span>
                </p>
              </div>
            </div>

            {/* Profit Factor */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Profit Factor</span>
                <TrendingUp size={16} className="text-emerald-400" />
              </div>
              <div className="mt-3">
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  {summary?.profitFactor === null || summary?.profitFactor === undefined ? 'N/A' : Number(summary.profitFactor || 0).toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-muted">Gross win / Gross loss</p>
              </div>
            </div>

            {/* Expectancy */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Expectancy</span>
                <Target size={16} className="text-indigo-400" />
              </div>
              <div className="mt-3">
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  ${Number(summary.expectancy || 0).toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-muted">Expected return / trade</p>
              </div>
            </div>

            {/* Avg Win / Avg Loss */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Avg Win / Loss</span>
                <BarChart2 size={16} className="text-muted" />
              </div>
              <div className="mt-3">
                <p className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
                  <span className="text-emerald-400">${Number(summary.averageWin || 0).toFixed(0)}</span>
                  <span className="text-muted font-normal text-xs"> / </span>
                  <span className="text-rose-400">${Number(summary.averageLoss || 0).toFixed(0)}</span>
                </p>
                <p className="mt-1 text-[11px] text-muted">Avg payout ratio</p>
              </div>
            </div>

            {/* Avg R:R */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Avg R:R</span>
                <Compass size={16} className="text-teal-400" />
              </div>
              <div className="mt-3">
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  {summary.averageRiskRewardRatio === null ? 'N/A' : `1 : ${Number(summary.averageRiskRewardRatio || 0).toFixed(2)}`}
                </p>
                <p className="mt-1 text-[11px] text-muted">Planned R:R ratio</p>
              </div>
            </div>
          </div>

          {/* 4. Performance Curve & Edge Summary Section (2:1 Grid) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.8fr_1fr]">
            {/* Performance Curve Chart */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                      Performance Curve
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-surface-muted text-muted">
                        {curveMode === 'cumulative' ? 'Pure Trading P/L' : 'Real Capital Trajectory'}
                      </span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {curveMode === 'cumulative' 
                        ? 'Tracks realized trading edge independently of deposits/withdrawals.' 
                        : 'Tracks actual account balance over time (Deposits + Trading P/L - Withdrawals).'}
                    </p>
                  </div>

                  {/* Mode Toggle & Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl border border-border/80 bg-surface p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setCurveMode('cumulative')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${curveMode === 'cumulative' ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-muted hover:text-foreground'}`}
                      >
                        Cumulative P/L
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurveMode('balance')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${curveMode === 'balance' ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-muted hover:text-foreground'}`}
                      >
                        Account Balance
                      </button>
                    </div>

                    <div className="inline-flex rounded-xl border border-border/80 bg-surface p-1 text-[11px] font-semibold">
                      {['7D', '30D', '90D', '1Y', 'ALL'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyDatePreset(preset)}
                          className={`rounded-lg px-2 py-0.5 transition ${activeDatePreset === preset ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-muted hover:text-foreground'}`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Compact Capital Summary Bar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5 p-3.5 rounded-xl border border-border/70 bg-surface-muted/60">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Total Deposits</span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      ${Number(capitalMetrics.totalDeposits || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Total Withdrawals</span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      ${Number(capitalMetrics.totalWithdrawals || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Trading P/L</span>
                    <span className={`text-sm font-bold font-mono ${Number(capitalMetrics.tradingPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(capitalMetrics.tradingPnl || 0) >= 0 ? '+' : ''}${Number(capitalMetrics.tradingPnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Current Balance</span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      ${Number(capitalMetrics.currentAccountBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {equityCurve.length === 0 ? (
                  <div className="flex h-72 items-center justify-center text-muted text-xs font-medium">No closed trades yet. Your equity curve will build over time.</div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={equityCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="label" stroke="rgb(var(--muted-foreground))" axisLine={false} tickLine={false} hide />
                        <YAxis stroke="rgb(var(--muted-foreground))" axisLine={false} tickLine={false} tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgb(var(--surface-elevated))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', borderRadius: '0.75rem', fontSize: '12px' }}
                          formatter={(val) => [`$${Number(val || 0).toFixed(2)}`, curveMode === 'cumulative' ? 'Cumulative P/L' : 'Account Balance']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey={curveMode === 'cumulative' ? 'cumulativeProfitLoss' : 'accountBalance'} 
                          stroke={curveMode === 'cumulative' ? '#10b981' : '#6366f1'} 
                          strokeWidth={2.5} 
                          dot={false} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Edge Summary Card */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-emerald-400" />
                    <h3 className="text-base font-semibold tracking-tight text-foreground">Edge Summary</h3>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">By {groupBy}</span>
                </div>

                {!edgeSummary ? (
                  <div className="py-12 text-center space-y-2">
                    <ShieldAlert size={28} className="mx-auto text-muted/40" />
                    <p className="text-xs font-semibold text-foreground">Not enough trade data</p>
                    <p className="text-[11px] text-muted">Log at least 2 trades to calculate dynamic edge highlights.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Strongest Area */}
                    {edgeSummary.bestPnl && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Strongest {groupBy}</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">{edgeSummary.bestPnl.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-emerald-400">+${Number(edgeSummary.bestPnl.netRealisedProfitLoss).toFixed(2)}</p>
                          <p className="text-[10px] text-muted font-medium">{edgeSummary.bestPnl.winRate}% Win Rate</p>
                        </div>
                      </div>
                    )}

                    {/* Weakest Area */}
                    {edgeSummary.worstPnl && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Weakest {groupBy}</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">{edgeSummary.worstPnl.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-rose-400">-${Math.abs(Number(edgeSummary.worstPnl.netRealisedProfitLoss)).toFixed(2)}</p>
                          <p className="text-[10px] text-muted font-medium">{edgeSummary.worstPnl.winRate}% Win Rate</p>
                        </div>
                      </div>
                    )}

                    {/* Highest Win Rate */}
                    {edgeSummary.bestWinRate && (
                      <div className="rounded-xl border border-border/80 bg-surface-muted/50 p-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Highest Accuracy</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">{edgeSummary.bestWinRate.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-sky-400">{edgeSummary.bestWinRate.winRate}%</p>
                          <p className="text-[10px] text-muted font-medium">{edgeSummary.bestWinRate.associatedTradeCount ?? edgeSummary.bestWinRate.totalTrades} trades</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Performance Breakdown & Drawdown Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.8fr_1fr]">
            {/* Grouped Performance Bar Chart with Dimension Switcher */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">Performance Breakdown</h3>
                    <p className="text-xs text-muted mt-0.5">Compare profitability across different execution dimensions.</p>
                  </div>
                </div>

                {/* Dimension Switcher Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-5 border-b border-border/70 scrollbar-none">
                  {groupOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGroupBy(opt.id)}
                      className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        groupBy === opt.id 
                          ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm' 
                          : 'border border-border/70 bg-surface text-muted hover:text-foreground hover:bg-surface-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {!hasData ? (
                  <div className="flex h-64 items-center justify-center text-muted text-xs font-medium">No records found for current dimension filters.</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groupedData.slice(0, 12)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="label" stroke="rgb(var(--muted-foreground))" axisLine={false} tickLine={false} tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis stroke="rgb(var(--muted-foreground))" axisLine={false} tickLine={false} tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgb(var(--surface-elevated))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', borderRadius: '0.75rem', fontSize: '12px' }} />
                        <Bar dataKey="netRealisedProfitLoss" radius={[6, 6, 0, 0]}>
                          {groupedData.slice(0, 12).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={Number(entry.netRealisedProfitLoss || 0) >= 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Best vs Worst Performers Micro-Lists */}
              {hasData && (topPerformers.length > 0 || weakestPerformers.length > 0) && (
                <div className="mt-6 pt-4 border-t border-border/70 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mb-2">Top Performers ({groupBy})</span>
                    <div className="space-y-1.5">
                      {topPerformers.map((item) => (
                        <div key={item.key} className="flex items-center justify-between text-xs rounded-xl bg-emerald-500/5 px-3 py-2 border border-emerald-500/10">
                          <span className="font-medium text-foreground truncate">{item.label}</span>
                          <span className="font-bold font-mono text-emerald-400">+${Number(item.netRealisedProfitLoss).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 block mb-2">Weakest Performers ({groupBy})</span>
                    <div className="space-y-1.5">
                      {weakestPerformers.map((item) => (
                        <div key={item.key} className="flex items-center justify-between text-xs rounded-xl bg-rose-500/5 px-3 py-2 border border-rose-500/10">
                          <span className="font-medium text-foreground truncate">{item.label}</span>
                          <span className="font-bold font-mono text-rose-400">-${Math.abs(Number(item.netRealisedProfitLoss)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawdown Analysis Section */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-rose-400" />
                    <h3 className="text-base font-semibold tracking-tight text-foreground">Drawdown Analysis</h3>
                  </div>
                </div>

                {!drawdownAnalysis ? (
                  <div className="py-12 text-center text-xs text-muted">No drawdown analytics recorded.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/80 bg-surface-muted/50 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Max Drawdown</span>
                        <p className="text-base font-bold font-mono text-rose-400 mt-1">-${drawdownAnalysis.maxDd.toFixed(2)}</p>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-surface-muted/50 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Current Drawdown</span>
                        <p className="text-base font-bold font-mono text-foreground mt-1">-${drawdownAnalysis.currentDd.toFixed(2)}</p>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-surface-muted/50 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Recovery Rate</span>
                        <p className="text-base font-bold font-mono text-emerald-400 mt-1">{drawdownAnalysis.recoveryPct}%</p>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-surface-muted/50 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Longest DD Streak</span>
                        <p className="text-base font-bold font-mono text-foreground mt-1">{drawdownAnalysis.longestStreak} trades</p>
                      </div>
                    </div>

                    {/* Compact Drawdown Depth Chart */}
                    {drawdownAnalysis.drawdownSeries.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-2">Drawdown Curve Depth ($)</span>
                        <div className="h-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={drawdownAnalysis.drawdownSeries} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis dataKey="timestamp" hide />
                              <YAxis stroke="rgb(var(--muted-foreground))" axisLine={false} tickLine={false} tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 10 }} />
                              <Tooltip contentStyle={{ backgroundColor: 'rgb(var(--surface-elevated))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', borderRadius: '0.5rem', fontSize: '11px' }} />
                              <Area type="monotone" dataKey="dd" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6. Trading Behaviour & Execution Asymmetry Section */}
          {longShortMetrics && (longShortMetrics.longData || longShortMetrics.shortData) && (
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-border/70 pb-3">
                <Compass size={16} className="text-indigo-400" />
                <h3 className="text-base font-semibold tracking-tight text-foreground">Long vs Short Execution Asymmetry</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Long (Buy) Card */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      <ArrowUpRight size={15} /> Long (Buy) Trades
                    </span>
                    <span className="text-xs font-medium text-muted">{longShortMetrics.longData?.associatedTradeCount ?? longShortMetrics.longData?.totalTrades ?? 0} Executions</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-surface p-2.5 rounded-xl border border-border/80">
                      <span className="text-[10px] text-muted font-medium block uppercase tracking-wider">Win Rate</span>
                      <span className="text-sm font-bold font-mono text-foreground">{longShortMetrics.longData?.winRate || 0}%</span>
                    </div>
                    <div className="bg-surface p-2.5 rounded-xl border border-border/80">
                      <span className="text-[10px] text-muted font-medium block uppercase tracking-wider">Net P/L</span>
                      <span className={`text-sm font-bold font-mono ${Number(longShortMetrics.longData?.netRealisedProfitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${Number(longShortMetrics.longData?.netRealisedProfitLoss || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-surface p-2.5 rounded-xl border border-border/80">
                      <span className="text-[10px] text-muted font-medium block uppercase tracking-wider">Profit Factor</span>
                      <span className="text-sm font-bold font-mono text-foreground">{longShortMetrics.longData?.profitFactor ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Short (Sell) Card */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-rose-400">
                      <ArrowDownRight size={15} /> Short (Sell) Trades
                    </span>
                    <span className="text-xs font-medium text-muted">{longShortMetrics.shortData?.associatedTradeCount ?? longShortMetrics.shortData?.totalTrades ?? 0} Executions</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-surface p-2.5 rounded-xl border border-border/80">
                      <span className="text-[10px] text-muted font-medium block uppercase tracking-wider">Win Rate</span>
                      <span className="text-sm font-bold font-mono text-foreground">{longShortMetrics.shortData?.winRate || 0}%</span>
                    </div>
                    <div className="bg-surface p-2.5 rounded-xl border border-border/80">
                      <span className="text-[10px] text-muted font-medium block uppercase tracking-wider">Net P/L</span>
                      <span className={`text-sm font-bold font-mono ${Number(longShortMetrics.shortData?.netRealisedProfitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${Number(longShortMetrics.shortData?.netRealisedProfitLoss || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-surface p-2.5 rounded-xl border border-border/80">
                      <span className="text-[10px] text-muted font-medium block uppercase tracking-wider">Profit Factor</span>
                      <span className="text-sm font-bold font-mono text-foreground">{longShortMetrics.shortData?.profitFactor ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Interactive Performance Table */}
          <div className="rounded-2xl border border-border/80 bg-surface/90 overflow-hidden shadow-sm">
            <div className="border-b border-border/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-base text-foreground">Performance Table ({groupBy})</h3>
                <p className="text-xs text-muted mt-0.5">Click any row to filter analytics by that item.</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted">Max Drawdown: </span>
                <strong className="text-xs font-bold font-mono text-rose-400">${Number(drawdown?.maximumDrawdown || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted uppercase tracking-wider font-semibold border-b border-border/70">
                  <tr>
                    <th className="px-6 py-3">Group ({groupBy})</th>
                    <th className="px-6 py-3">Trades</th>
                    <th className="px-6 py-3">Win Rate</th>
                    <th className="px-6 py-3">Net P/L</th>
                    <th className="px-6 py-3">Profit Factor</th>
                    <th className="px-6 py-3">Expectancy</th>
                    <th className="px-6 py-3">Avg R:R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground font-medium">
                  {!hasData ? (
                    <tr><td colSpan="7" className="px-6 py-8 text-center text-muted">No records to display right now.</td></tr>
                  ) : groupedData.map((row) => (
                    <tr 
                      key={row.key} 
                      onClick={() => handleRowClick(row.key)}
                      className="hover:bg-emerald-500/5 cursor-pointer transition-colors"
                      title={`Click to filter by ${row.label}`}
                    >
                      <td className="px-6 py-3.5 font-semibold text-foreground flex items-center gap-1.5">
                        <span>{row.label}</span>
                      </td>
                      <td className="px-6 py-3.5 text-muted">{row.associatedTradeCount ?? row.totalTrades}</td>
                      <td className="px-6 py-3.5 text-muted font-mono">{Number(row.winRate || 0).toFixed(1)}%</td>
                      <td className={`px-6 py-3.5 font-bold font-mono ${row.netRealisedProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {row.netRealisedProfitLoss >= 0 ? '+' : ''}${Number(row.netRealisedProfitLoss || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5 text-muted font-mono">{row?.profitFactor === null || row?.profitFactor === undefined ? 'N/A' : Number(row.profitFactor || 0).toFixed(2)}</td>
                      <td className="px-6 py-3.5 text-muted font-mono">${Number(row.expectancy || 0).toFixed(2)}</td>
                      <td className="px-6 py-3.5 text-muted font-mono">{row.averageRiskRewardRatio === null ? 'N/A' : `1 : ${row.averageRiskRewardRatio}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 8. JAHZ AI Insights Section (Non-Blocking & Fast) */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-400" />
              <h3 className="text-base font-semibold tracking-tight text-foreground">JAHZ AI Insights</h3>
            </div>
            
            {!aiInsights ? (
              <p className="text-xs text-muted">Log more trades across sessions and pairs to trigger personalized AI edge observations.</p>
            ) : (
              <ul className="space-y-2">
                {aiInsights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-medium text-foreground leading-relaxed">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
