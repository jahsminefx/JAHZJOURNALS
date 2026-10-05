import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Share2,
  Sparkles,
  Brain,
  Target,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  Flame,
  Save,
  Check,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import ShareDailyReviewModal from '../components/share/ShareDailyReviewModal';
import ShareTradeModal from '../components/share/ShareTradeModal';
import { formatCurrency } from '../utils/dashboard';
import {
  detectTradingSession,
  getTradingSessionLabel,
  resolveTradeRiskReward,
  resolveTradePips,
} from '../utils/tradeCalculations';

const inputStyle =
  'mt-1.5 block w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:bg-surface shadow-sm';

const getSessionBadge = (session) => {
  switch (session) {
    case 'LONDON':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          London
        </span>
      );
    case 'NEW_YORK':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          New York
        </span>
      );
    case 'LONDON_NEW_YORK_OVERLAP':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          London/NY Overlap
        </span>
      );
    case 'ASIAN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          Asian
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-muted text-muted border border-border">
          {session || 'Other'}
        </span>
      );
  }
};

const getDirectionBadge = (dir) => {
  const isBuy = String(dir || '').toUpperCase() === 'BUY';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
        isBuy
          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
      }`}
    >
      {isBuy ? 'BUY' : 'SELL'}
    </span>
  );
};

const getResultBadge = (res) => {
  switch (res) {
    case 'WIN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          WIN
        </span>
      );
    case 'LOSS':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          LOSS
        </span>
      );
    case 'BREAKEVEN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-muted text-muted border border-border">
          BE
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          OPEN
        </span>
      );
  }
};

const formatTradeTime = (timeStr) => {
  if (!timeStr) return '—';
  try {
    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return '—';
  }
};

export default function DailyReviewPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [error, setError] = useState(null);

  // Form reflection state
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [tomorrowFocus, setTomorrowFocus] = useState('');
  const [followedPlan, setFollowedPlan] = useState(null);
  const [emotionalState, setEmotionalState] = useState('');
  const [marketConditions, setMarketConditions] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [status, setStatus] = useState('DRAFT');

  // AI Review state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRequestId, setAiRequestId] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiOutput, setAiOutput] = useState(null);

  // Sharing Modal states
  const [shareReviewModalOpen, setShareReviewModalOpen] = useState(false);
  const [shareTradeModalOpen, setShareTradeModalOpen] = useState(false);
  const [selectedShareTrade, setSelectedShareTrade] = useState(null);

  // Load trading accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await api.get('/accounts');
        const accs = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setAccounts(accs);
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  // Fetch Daily Review summary for selected date and account
  const loadDailySummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/daily-reviews/day', {
        params: { date: selectedDate, accountId: selectedAccountId || undefined },
      });

      if (res.data?.success) {
        const data = res.data.data;
        setSummaryData(data);

        // Populate saved review fields if available
        if (data.review) {
          const r = data.review;
          setWhatWentWell(r.whatWentWell || '');
          setWhatWentWrong(r.whatWentWrong || '');
          setLessonsLearned(r.lessonsLearned || '');
          setTomorrowFocus(r.tomorrowFocus || '');
          setFollowedPlan(r.followedPlan);
          setEmotionalState(r.emotionalState || '');
          setMarketConditions(r.marketConditions || '');
          setGeneralNotes(r.generalNotes || '');
          setStatus(r.status || 'DRAFT');

          if (r.aiStructuredOutput || r.aiSummary) {
            setAiOutput({
              summary: r.aiSummary,
              structured: r.aiStructuredOutput,
              generatedAt: r.aiGeneratedAt,
            });
          } else {
            setAiOutput(null);
          }
        } else {
          // Reset reflections
          setWhatWentWell('');
          setWhatWentWrong('');
          setLessonsLearned('');
          setTomorrowFocus('');
          setFollowedPlan(null);
          setEmotionalState('');
          setMarketConditions('');
          setGeneralNotes('');
          setStatus('DRAFT');
          setAiOutput(null);
        }
      }
    } catch (err) {
      console.error('Error loading daily review:', err);
      setError(err.response?.data?.message || 'Could not fetch daily review summary.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedAccountId]);

  useEffect(() => {
    loadDailySummary();
  }, [loadDailySummary]);

  // AI status polling with 90s max duration guard
  useEffect(() => {
    let interval = null;
    let timeoutTimer = null;

    if (aiRequestId && (aiStatus === 'QUEUED' || aiStatus === 'PROCESSING')) {
      timeoutTimer = setTimeout(() => {
        setAiLoading(false);
        setAiStatus('FAILED');
        setAiError('JAHZ AI is taking longer than expected. You can retry the review.');
        setAiRequestId(null);
        toast.error('AI coaching analysis timed out. Please try again.', { id: 'daily-ai' });
      }, 90000);

      interval = setInterval(async () => {
        try {
          const res = await api.get(`/daily-reviews/ai-status/${aiRequestId}`);
          if (res.data?.success) {
            const st = res.data.data.status;
            setAiStatus(st);
            if (st === 'COMPLETED') {
              setAiLoading(false);
              setAiOutput({
                summary: res.data.data.summary,
                structured: res.data.data.structuredOutput,
                generatedAt: res.data.data.completedAt,
              });
              setAiRequestId(null);
              if (timeoutTimer) clearTimeout(timeoutTimer);
              loadDailySummary();
              toast.success('JAHZ AI performance coaching generated!', { id: 'daily-ai' });
            } else if (st === 'FAILED') {
              setAiLoading(false);
              setAiError(res.data.data.errorMessage || 'JAHZ AI review failed. Please try again.');
              setAiRequestId(null);
              if (timeoutTimer) clearTimeout(timeoutTimer);
              toast.error(res.data.data.errorMessage || 'JAHZ AI review failed.', { id: 'daily-ai' });
            }
          }
        } catch (err) {
          console.error('AI status poll error:', err);
          if (err.response?.status === 404 || err.response?.status === 500) {
            setAiLoading(false);
            setAiError('Failed to check AI review status. Please try again.');
            setAiRequestId(null);
            if (timeoutTimer) clearTimeout(timeoutTimer);
            toast.error('Failed to check AI review status.', { id: 'daily-ai' });
          }
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [aiRequestId, aiStatus, loadDailySummary]);

  const handleSaveReview = async (forcedStatus = null) => {
    try {
      setSaving(true);
      setError(null);
      const targetStatus = forcedStatus || status;

      const payload = {
        date: selectedDate,
        accountId: selectedAccountId || null,
        whatWentWell,
        whatWentWrong,
        lessonsLearned,
        tomorrowFocus,
        followedPlan,
        emotionalState,
        marketConditions,
        generalNotes,
        status: targetStatus,
      };

      const res = await api.post('/daily-reviews', payload);
      if (res.data?.success) {
        setStatus(targetStatus);
        if (res.data?.data) {
          setSummaryData((prev) => ({
            ...prev,
            review: res.data.data,
          }));
        }
        loadDailySummary();
        if (targetStatus === 'COMPLETED') {
          toast.success('Daily review reflections completed and saved!');
        } else {
          toast.success('Daily reflections saved as draft.');
        }
        return res.data.data;
      }
      return null;
    } catch (err) {
      console.error('Error saving review:', err);
      const msg = err.response?.data?.message || 'Failed to save daily review reflections.';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerAiReview = async () => {
    try {
      // First ensure review is saved
      const saved = await handleSaveReview('COMPLETED');
      const targetReviewId = saved?.id || summaryData?.review?.id;

      if (!targetReviewId) {
        toast.error('Please save your review reflections first.');
        return;
      }

      setAiLoading(true);
      setAiError(null);
      setAiStatus('QUEUED');
      toast.loading('Submitting to JAHZ AI performance coach...', { id: 'daily-ai' });

      const res = await api.post(`/daily-reviews/${targetReviewId}/ai-review`, {});
      if (res.data?.success) {
        setAiRequestId(res.data.data.aiRequestId);
      }
    } catch (err) {
      console.error('Trigger AI review error:', err);
      setAiLoading(false);
      const msg = err.response?.data?.message || 'Could not queue JAHZ AI Daily Review.';
      setAiError(msg);
      toast.error(msg, { id: 'daily-ai' });
    }
  };

  const changeDateByDays = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const metrics = summaryData?.metrics;
  const rawTrades = summaryData?.trades || [];
  const review = summaryData?.review;

  // Process trades to ensure session, pips, and RR are computed and ready for display
  const trades = rawTrades.map((t) => {
    const session = t.session || detectTradingSession(t.entryTime) || 'OTHER';
    const pips = t.pips !== null && t.pips !== undefined ? Number(t.pips) : resolveTradePips(t);
    const rr = resolveTradeRiskReward(t);
    return {
      ...t,
      session,
      sessionLabel: getTradingSessionLabel(session),
      pips,
      resolvedRR: rr,
    };
  });

  return (
    <div className="space-y-6 text-foreground font-sans pb-16">
      <SEO
        title="Daily Review & Journal | JAHZJOURNALS"
        description="Review your daily trades, execution discipline, sessions, RR, and get JAHZ AI performance coaching."
      />
      <Breadcrumbs />

      {/* Top Header & Context Selectors */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Daily Review
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  status === 'REVIEWED'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                    : status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : 'bg-surface-muted text-muted border border-border'
                }`}
              >
                {status}
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted">
              Review your trades, reflect on discipline, and get JAHZ AI performance coaching.
            </p>
          </div>

          {/* Share Review Button */}
          {review?.id && (
            <button
              type="button"
              onClick={() => setShareReviewModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20 transition self-start md:self-auto"
            >
              <Share2 size={14} />
              <span>Share Review</span>
            </button>
          )}
        </div>

        {/* Date & Account Selectors Bar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto] pt-4 border-t border-border items-end">
          <div>
            <label htmlFor="daily-review-account" className="block text-xs font-bold uppercase tracking-wider text-muted">
              Account Filter
            </label>
            <select
              id="daily-review-account"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className={inputStyle}
            >
              <option value="">ALL ACCOUNTS (Normalized USD)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker Controls */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Trading Date
            </label>
            <div className="flex items-center gap-1.5 bg-surface-muted border border-border rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => changeDateByDays(-1)}
                className="p-2 hover:bg-surface text-muted hover:text-foreground rounded-lg transition"
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar size={15} className="text-muted" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm text-foreground focus:outline-none font-medium cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => changeDateByDays(1)}
                className="p-2 hover:bg-surface text-muted hover:text-foreground rounded-lg transition"
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-2.5 py-1.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted font-medium shadow-sm flex items-center justify-center gap-3">
          <RefreshCw size={18} className="animate-spin text-emerald-500" />
          <span>Loading daily review metrics...</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-400 font-medium">
          {error}
        </div>
      ) : (
        <>
          {/* Multi-Currency Normalized Notice */}
          {metrics?.isMultiAccount && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-300">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-400 shrink-0" />
                <span>
                  <strong>ALL ACCOUNTS View:</strong> Portfolio metrics normalized to USD using live FX rates. Individual trade records show native broker figures.
                </span>
              </div>
              <span
                className={`self-start sm:self-auto px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                  metrics.fxStatus === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : metrics.fxStatus === 'CACHED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                FX: {metrics.fxStatus}
              </span>
            </div>
          )}

          {/* Metrics Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Trades Card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Total Trades
                </span>
                <BarChart3 size={15} className="text-muted" />
              </div>
              <span className="text-2xl font-black text-foreground">
                {metrics?.totalTrades || 0}
              </span>
              <span className="text-[11px] text-muted font-medium mt-1">
                {metrics?.winningTrades || 0}W · {metrics?.losingTrades || 0}L · {metrics?.breakEvenTrades || 0}BE
              </span>
            </div>

            {/* Win Rate Card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Win Rate
                </span>
                <Target size={15} className="text-muted" />
              </div>
              <span className="text-2xl font-black text-foreground">
                {metrics?.winRate ?? 0}%
              </span>
              <span className="text-[11px] text-muted font-medium mt-1">
                {metrics?.closedTrades || 0} closed
              </span>
            </div>

            {/* Net PnL Card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Net P&L
                </span>
                {(metrics?.netProfitLoss || 0) >= 0 ? (
                  <TrendingUp size={15} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={15} className="text-rose-500" />
                )}
              </div>
              <span
                className={`text-2xl font-black ${
                  (metrics?.netProfitLoss || 0) > 0
                    ? 'text-emerald-500'
                    : (metrics?.netProfitLoss || 0) < 0
                    ? 'text-rose-500'
                    : 'text-foreground'
                }`}
              >
                {formatCurrency(metrics?.netProfitLoss, metrics?.currency)}
              </span>
              <span className="text-[11px] text-muted font-medium mt-1">
                {metrics?.isMultiAccount ? 'Normalized USD' : metrics?.currency || 'USD'}
              </span>
            </div>

            {/* Net Pips Card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Net Pips
                </span>
                <Flame size={15} className="text-amber-500" />
              </div>
              <span
                className={`text-2xl font-black ${
                  (metrics?.totalPips || 0) > 0
                    ? 'text-emerald-500'
                    : (metrics?.totalPips || 0) < 0
                    ? 'text-rose-500'
                    : 'text-foreground'
                }`}
              >
                {metrics?.totalPips !== null && metrics?.totalPips !== undefined
                  ? `${metrics.totalPips > 0 ? '+' : ''}${metrics.totalPips}`
                  : '0.0'}
              </span>
              <span className="text-[11px] text-muted font-medium mt-1">Cumulative points</span>
            </div>

            {/* Profit Factor Card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Profit Factor
                </span>
                <Layers size={15} className="text-muted" />
              </div>
              <span className="text-2xl font-black text-foreground">
                {metrics?.profitFactor !== null && metrics?.profitFactor !== undefined
                  ? metrics.profitFactor
                  : '—'}
              </span>
              <span className="text-[11px] text-muted font-medium mt-1">Gross Win / Loss</span>
            </div>

            {/* Average RR Card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Avg Risk:Reward
                </span>
                <Clock size={15} className="text-muted" />
              </div>
              <span className="text-2xl font-black text-foreground">
                {metrics?.averageRiskReward !== null && metrics?.averageRiskReward !== undefined
                  ? `1:${metrics.averageRiskReward}`
                  : '—'}
              </span>
              <span className="text-[11px] text-muted font-medium mt-1">
                {metrics?.bestSession ? `Top: ${metrics.bestSession}` : 'Calculated RR'}
              </span>
            </div>
          </div>

          {/* Section 1: Trades Executed Today */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-emerald-500" />
                <h2 className="text-lg font-bold text-foreground">
                  Trades Executed Today ({trades.length})
                </h2>
              </div>
              {metrics?.bestSession && (
                <div className="text-xs text-muted flex items-center gap-1.5">
                  <span>Primary Session:</span>
                  <span className="font-bold text-foreground">{metrics.bestSession}</span>
                </div>
              )}
            </div>

            {trades.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted text-sm">
                No trades recorded for this date.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-surface-muted text-muted uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                    <tr>
                      <th className="py-3 px-3.5">Time</th>
                      <th className="py-3 px-3.5">Pair</th>
                      <th className="py-3 px-3.5">Direction</th>
                      <th className="py-3 px-3.5">Result</th>
                      <th className="py-3 px-3.5">Net P/L</th>
                      <th className="py-3 px-3.5">Net Pips</th>
                      <th className="py-3 px-3.5">Risk:Reward</th>
                      <th className="py-3 px-3.5">Session</th>
                      <th className="py-3 px-3.5">Strategy</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {trades.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-muted/50 transition">
                        <td className="py-3 px-3.5 text-muted whitespace-nowrap">
                          {formatTradeTime(t.entryTime)}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-foreground">
                          {t.pair}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {getDirectionBadge(t.direction)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {getResultBadge(t.result)}
                        </td>
                        <td
                          className={`py-3 px-3.5 font-bold whitespace-nowrap ${
                            (t.profitLossAmount || 0) > 0
                              ? 'text-emerald-500'
                              : (t.profitLossAmount || 0) < 0
                              ? 'text-rose-500'
                              : 'text-foreground'
                          }`}
                        >
                          {formatCurrency(t.profitLossAmount, t.tradingAccount?.currency || 'USD')}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {t.pips !== null && t.pips !== undefined ? (
                            <span
                              className={`font-semibold ${
                                t.pips > 0
                                  ? 'text-emerald-500'
                                  : t.pips < 0
                                  ? 'text-rose-500'
                                  : 'text-muted'
                              }`}
                            >
                              {t.pips > 0 ? `+${t.pips}` : t.pips} pips
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {t.resolvedRR !== null && t.resolvedRR !== undefined ? (
                            <span className="font-semibold text-foreground">
                              {t.resolvedRR > 0 ? `${t.resolvedRR}R` : `${t.resolvedRR}R`}
                            </span>
                          ) : t.riskRewardRatio ? (
                            <span className="font-semibold text-foreground">
                              1:{t.riskRewardRatio}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {getSessionBadge(t.session)}
                        </td>
                        <td className="py-3 px-3.5 text-muted truncate max-w-[120px]">
                          {t.strategy?.name || '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/trades/${t.id}`}
                              className="px-2.5 py-1 bg-surface-muted hover:bg-surface text-foreground border border-border text-[11px] font-semibold rounded-lg transition"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedShareTrade(t);
                                setShareTradeModalOpen(true);
                              }}
                              className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold rounded-lg transition"
                              title="Share trade"
                            >
                              <Share2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Trader Reflection & Journal */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-emerald-500" />
                  <h2 className="text-lg font-bold text-foreground">
                    Trader Reflection & Mindset Journal
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Document your execution discipline, emotional state, and takeaways from today's sessions.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleSaveReview('DRAFT')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted hover:bg-surface px-4 py-2 text-xs font-semibold text-foreground transition shadow-sm disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReview('COMPLETED')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2 text-xs font-bold text-slate-950 transition shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  <span>{saving ? 'Saving...' : 'Complete Review'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* What Went Well */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  What went well today?
                </label>
                <textarea
                  rows={3}
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  placeholder="e.g. Followed setup perfectly, patient on execution, stayed disciplined..."
                  className={inputStyle}
                />
              </div>

              {/* What Went Wrong */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  What went wrong / mistakes?
                </label>
                <textarea
                  rows={3}
                  value={whatWentWrong}
                  onChange={(e) => setWhatWentWrong(e.target.value)}
                  placeholder="e.g. Overtraded during Asian session, moved stop loss prematurely..."
                  className={inputStyle}
                />
              </div>

              {/* Lessons Learned */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Lessons Learned
                </label>
                <textarea
                  rows={3}
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  placeholder="e.g. Always wait for 15m candle close confirmation before entry..."
                  className={inputStyle}
                />
              </div>

              {/* Tomorrow's Focus */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Tomorrow's Focus
                </label>
                <textarea
                  rows={3}
                  value={tomorrowFocus}
                  onChange={(e) => setTomorrowFocus(e.target.value)}
                  placeholder="e.g. Strictly wait for London open liquidity sweep before entering..."
                  className={inputStyle}
                />
              </div>
            </div>

            {/* Reflection Selects & Radio Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Followed Trading Plan?
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="planRadio"
                      checked={followedPlan === true}
                      onChange={() => setFollowedPlan(true)}
                      className="accent-emerald-500"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="planRadio"
                      checked={followedPlan === false}
                      onChange={() => setFollowedPlan(false)}
                      className="accent-rose-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Emotional State
                </label>
                <select
                  value={emotionalState}
                  onChange={(e) => setEmotionalState(e.target.value)}
                  className={inputStyle}
                >
                  <option value="">Select Emotion</option>
                  <option value="Calm & Disciplined">Calm & Disciplined</option>
                  <option value="Confident">Confident</option>
                  <option value="Anxious / Hesitant">Anxious / Hesitant</option>
                  <option value="FOMO / Greedy">FOMO / Greedy</option>
                  <option value="Frustrated / Revenge Trading">Frustrated / Revenge Trading</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Market Conditions
                </label>
                <select
                  value={marketConditions}
                  onChange={(e) => setMarketConditions(e.target.value)}
                  className={inputStyle}
                >
                  <option value="">Select Condition</option>
                  <option value="Trending Cleanly">Trending Cleanly</option>
                  <option value="Ranging / Consolidating">Ranging / Consolidating</option>
                  <option value="High Volatility / News">High Volatility / News</option>
                  <option value="Low Liquidity / Chop">Low Liquidity / Chop</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: JAHZ AI Daily Coaching */}
          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-surface to-surface p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-400" />
                  <h2 className="text-lg font-bold text-foreground">
                    JAHZ AI Daily Performance Coaching
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Synthesize trade data, execution discipline, sessions, and reflections into actionable insights.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTriggerAiReview}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition shadow-md disabled:opacity-50 self-start sm:self-auto"
              >
                <Sparkles size={14} />
                <span>{aiLoading ? 'Analyzing Trading Day...' : 'Review My Day with JAHZ AI'}</span>
              </button>
            </div>

            {/* AI Loading State */}
            {aiLoading && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-6 text-center space-y-3">
                <RefreshCw size={24} className="animate-spin text-indigo-400 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">
                  JAHZ AI is reviewing your trading day...
                </h3>
                <p className="text-xs text-indigo-300">
                  Status: <strong className="uppercase">{aiStatus || 'QUEUED'}</strong> — Analyzing trades, session execution, and risk control.
                </p>
              </div>
            )}

            {/* AI Error State */}
            {aiError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-400 flex items-center justify-between">
                <span>{aiError}</span>
                <button
                  type="button"
                  onClick={handleTriggerAiReview}
                  className="px-3 py-1 bg-rose-500 text-white font-bold text-xs rounded-lg hover:bg-rose-600 transition"
                >
                  Retry AI Review
                </button>
              </div>
            )}

            {/* AI Coaching Output */}
            {aiOutput?.structured && (
              <div className="space-y-5 rounded-xl border border-border bg-surface-muted/50 p-5">
                {/* Executive Coaching Summary */}
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1.5 flex items-center gap-1.5">
                    <Brain size={14} />
                    <span>Executive Coaching Summary</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-foreground leading-relaxed font-medium">
                    {aiOutput.structured.executiveSummary}
                  </p>
                </div>

                {/* 2-Column Coaching Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Strengths */}
                  {aiOutput.structured.whatYouDidWell?.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/20 bg-surface p-4 space-y-2">
                      <h4 className="font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        <span>Key Strengths Today</span>
                      </h4>
                      <ul className="list-disc list-inside space-y-1.5 text-muted">
                        {aiOutput.structured.whatYouDidWell.map((item, idx) => (
                          <li key={idx} className="text-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Areas for Improvement */}
                  {aiOutput.structured.whatWentWrong?.length > 0 && (
                    <div className="rounded-xl border border-rose-500/20 bg-surface p-4 space-y-2">
                      <h4 className="font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>Areas for Improvement</span>
                      </h4>
                      <ul className="list-disc list-inside space-y-1.5 text-muted">
                        {aiOutput.structured.whatWentWrong.map((item, idx) => (
                          <li key={idx} className="text-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risk Management */}
                  {aiOutput.structured.riskManagementReview?.length > 0 && (
                    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                      <h4 className="font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        <span>Risk Management Review</span>
                      </h4>
                      <ul className="list-disc list-inside space-y-1.5 text-muted">
                        {aiOutput.structured.riskManagementReview.map((item, idx) => (
                          <li key={idx} className="text-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Behavioral / Emotional Patterns */}
                  {aiOutput.structured.emotionalObservations?.length > 0 && (
                    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                      <h4 className="font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Flame size={14} />
                        <span>Behavioral Observations</span>
                      </h4>
                      <ul className="list-disc list-inside space-y-1.5 text-muted">
                        {aiOutput.structured.emotionalObservations.map((item, idx) => (
                          <li key={idx} className="text-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Key Lesson & Tomorrow Focus Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <span className="font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                      Key Takeaway Lesson
                    </span>
                    <p className="text-foreground font-medium">
                      {aiOutput.structured.keyLesson}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <span className="font-bold text-emerald-500 uppercase tracking-wider block mb-1">
                      Tomorrow's Primary Focus
                    </span>
                    <p className="text-foreground font-medium">
                      {aiOutput.structured.tomorrowFocus}
                    </p>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="pt-3 border-t border-border text-[11px] text-muted">
                  {aiOutput.structured.disclaimer ||
                    'JAHZ AI provides educational analysis based on your journal data and does not provide financial advice.'}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Share Review Modal */}
      {review?.id && (
        <ShareDailyReviewModal
          isOpen={shareReviewModalOpen}
          onClose={() => setShareReviewModalOpen(false)}
          dailyReviewId={review.id}
          summaryData={summaryData}
        />
      )}

      {/* Share Individual Trade Modal */}
      {selectedShareTrade && (
        <ShareTradeModal
          isOpen={shareTradeModalOpen}
          onClose={() => {
            setShareTradeModalOpen(false);
            setSelectedShareTrade(null);
          }}
          trade={selectedShareTrade}
        />
      )}
    </div>
  );
}
