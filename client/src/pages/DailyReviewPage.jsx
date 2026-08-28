import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import api from '../utils/api';
import ShareDailyReviewModal from '../components/share/ShareDailyReviewModal';
import ShareTradeModal from '../components/share/ShareTradeModal';

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
      setError('Could not fetch daily review summary.');
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
      // Safety timeout: stop polling after 90 seconds
      timeoutTimer = setTimeout(() => {
        setAiLoading(false);
        setAiStatus('FAILED');
        setAiError('JAHZ AI is taking longer than expected. You can retry the review.');
        setAiRequestId(null);
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
            } else if (st === 'FAILED') {
              setAiLoading(false);
              setAiError(res.data.data.errorMessage || 'JAHZ AI review failed. Please try again.');
              setAiRequestId(null);
              if (timeoutTimer) clearTimeout(timeoutTimer);
            }
          }
        } catch (err) {
          console.error('AI status poll error:', err);
          if (err.response?.status === 404 || err.response?.status === 500) {
            setAiLoading(false);
            setAiError('Failed to check AI review status. Please try again.');
            setAiRequestId(null);
            if (timeoutTimer) clearTimeout(timeoutTimer);
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
        loadDailySummary();
      }
    } catch (err) {
      console.error('Error saving review:', err);
      setError('Failed to save daily review reflections.');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerAiReview = async () => {
    try {
      // First ensure review is saved
      await handleSaveReview('COMPLETED');

      const reviewId = summaryData?.review?.id;
      if (!reviewId) {
        // Retry save and fetch
        const resSave = await api.post('/daily-reviews', {
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
          status: 'COMPLETED',
        });
        
        if (!resSave.data?.data?.id) {
          setError('Please save your review first.');
          return;
        }
      }

      setAiLoading(true);
      setAiError(null);
      setAiStatus('QUEUED');

      const targetReviewId = summaryData?.review?.id;
      const res = await api.post(`/daily-reviews/${targetReviewId}/ai-review`, {});
      if (res.data?.success) {
        setAiRequestId(res.data.data.aiRequestId);
      }
    } catch (err) {
      console.error('Trigger AI review error:', err);
      setAiLoading(false);
      setAiError(err.response?.data?.message || 'Could not queue JAHZ AI Daily Review.');
    }
  };

  const changeDateByDays = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatCurrency = (amount, currencyStr) => {
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const num = Number(amount || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${symbol}${Math.abs(num).toLocaleString()} ${currencyStr || 'USD'}`;
  };

  const metrics = summaryData?.metrics;
  const trades = summaryData?.trades || [];
  const review = summaryData?.review;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Top Header & Context Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Daily Review</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              status === 'REVIEWED' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' :
              status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {status}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Review your trades, reflect on discipline, and get JAHZ AI performance coaching.
          </p>
        </div>

        {/* Date & Account Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Account Selector */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition"
          >
            <option value="">ALL ACCOUNTS (Normalized USD)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.currency})
              </option>
            ))}
          </select>

          {/* Date Picker */}
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
              title="Previous Day"
            >
              ◀
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm text-slate-200 px-2 py-1 focus:outline-none font-medium"
            />
            <button
              onClick={() => changeDateByDays(1)}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
              title="Next Day"
            >
              ▶
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-2 py-1 text-[11px] font-bold text-indigo-400 hover:bg-indigo-950/60 rounded-lg"
            >
              Today
            </button>
          </div>

          {/* Share Review Button */}
          {review?.id && (
            <button
              onClick={() => setShareReviewModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold rounded-xl transition"
            >
              <span>📤</span>
              <span>Share Review</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 animate-pulse text-sm">
          Loading daily review metrics...
        </div>
      ) : error ? (
        <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 p-4 rounded-xl text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* Multi-Currency Notice Banner */}
          {metrics?.isMultiAccount && (
            <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center space-x-2">
                <span>🌐</span>
                <span>
                  <strong>ALL ACCOUNTS View:</strong> Monetary metrics are normalized to USD using live FX rates. Native currency values are preserved in individual trade records.
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                metrics.fxStatus === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                metrics.fxStatus === 'CACHED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                FX: {metrics.fxStatus}
              </span>
            </div>
          )}

          {/* Metrics Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Trades</span>
              <span className="text-xl font-bold text-white">{metrics?.totalTrades || 0}</span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {metrics?.winningTrades || 0}W / {metrics?.losingTrades || 0}L / {metrics?.breakEvenTrades || 0}BE
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Win Rate</span>
              <span className="text-xl font-bold text-white">{metrics?.winRate || 0}%</span>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Net P/L</span>
              <span className={`text-xl font-bold ${
                (metrics?.netProfitLoss || 0) > 0 ? 'text-emerald-400' : (metrics?.netProfitLoss || 0) < 0 ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {formatCurrency(metrics?.netProfitLoss, metrics?.currency)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Total Pips</span>
              <span className="text-xl font-bold text-slate-200">
                {metrics?.totalPips !== null && metrics?.totalPips !== undefined ? `${metrics.totalPips > 0 ? '+' : ''}${metrics.totalPips}` : '—'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Profit Factor</span>
              <span className="text-xl font-bold text-slate-200">
                {metrics?.profitFactor !== null && metrics?.profitFactor !== undefined ? metrics.profitFactor : '—'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Avg R:R</span>
              <span className="text-xl font-bold text-slate-200">
                {metrics?.averageRiskReward !== null && metrics?.averageRiskReward !== undefined ? `1:${metrics.averageRiskReward}` : '—'}
              </span>
            </div>
          </div>

          {/* Section 1: Trades Executed Today */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>📊</span>
                <span>Trades Executed Today ({trades.length})</span>
              </h3>
            </div>

            {trades.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs sm:text-sm">
                No trades recorded for this trading date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Instrument</th>
                      <th className="py-3 px-3">Direction</th>
                      <th className="py-3 px-3">Result</th>
                      <th className="py-3 px-3">P/L</th>
                      <th className="py-3 px-3">Pips</th>
                      <th className="py-3 px-3">R:R</th>
                      <th className="py-3 px-3">Strategy</th>
                      <th className="py-3 px-3">Session</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {trades.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-bold text-white">{t.pair}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.result === 'WIN' ? 'text-emerald-400' : t.result === 'LOSS' ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {t.result}
                          </span>
                        </td>
                        <td className={`py-3 px-3 font-bold ${
                          t.profitLossAmount > 0 ? 'text-emerald-400' : t.profitLossAmount < 0 ? 'text-rose-400' : 'text-slate-300'
                        }`}>
                          {formatCurrency(t.profitLossAmount, t.tradingAccount?.currency)}
                        </td>
                        <td className="py-3 px-3">{t.pips !== null && t.pips !== undefined ? `${t.pips > 0 ? '+' : ''}${t.pips}` : '—'}</td>
                        <td className="py-3 px-3">{t.riskRewardRatio ? `1:${t.riskRewardRatio}` : '—'}</td>
                        <td className="py-3 px-3 text-slate-400">{t.strategy?.name || '—'}</td>
                        <td className="py-3 px-3 text-slate-400">{t.session || '—'}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              to={`/trades/${t.id}`}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold rounded-lg transition"
                            >
                              View Trade
                            </Link>
                            <button
                              onClick={() => {
                                setSelectedShareTrade(t);
                                setShareTradeModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-400 border border-indigo-700/50 text-[11px] font-semibold rounded-lg transition"
                            >
                              Share
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

          {/* Section 2: Trader Reflections Journal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>📝</span>
                  <span>Trader Reflection & Journal</span>
                </h3>
                <p className="text-xs text-slate-400">Document execution discipline, lessons learned, and mindset.</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSaveReview('DRAFT')}
                  disabled={saving}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSaveReview('COMPLETED')}
                  disabled={saving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg"
                >
                  {saving ? 'Saving...' : 'Save & Complete'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* What Went Well */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">What went well today?</label>
                <textarea
                  rows={3}
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  placeholder="e.g. Followed entry setup perfectly, patient on execution..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* What Went Wrong */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">What went wrong / mistakes?</label>
                <textarea
                  rows={3}
                  value={whatWentWrong}
                  onChange={(e) => setWhatWentWrong(e.target.value)}
                  placeholder="e.g. Overtraded during Asian session, moved stop loss..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Lessons Learned */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Lessons Learned</label>
                <textarea
                  rows={3}
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  placeholder="e.g. Always wait for 15m candle close before entry..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Tomorrow Focus */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tomorrow's Focus</label>
                <textarea
                  rows={3}
                  value={tomorrowFocus}
                  onChange={(e) => setTomorrowFocus(e.target.value)}
                  placeholder="e.g. Stick strictly to London Session A+ setup only..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Selects & Radio Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/60">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Followed Trading Plan?</label>
                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="planRadio"
                      checked={followedPlan === true}
                      onChange={() => setFollowedPlan(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="planRadio"
                      checked={followedPlan === false}
                      onChange={() => setFollowedPlan(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Emotional State</label>
                <select
                  value={emotionalState}
                  onChange={(e) => setEmotionalState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Market Conditions</label>
                <select
                  value={marketConditions}
                  onChange={(e) => setMarketConditions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
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

          {/* Section 3: JAHZ AI Daily Review */}
          <div className="bg-slate-900 border border-indigo-900/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>🤖</span>
                  <span>JAHZ AI Daily Performance Review</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Automated performance coaching using your deterministic trade data and reflections.
                </p>
              </div>

              <button
                onClick={handleTriggerAiReview}
                disabled={aiLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-2"
              >
                <span>{aiLoading ? '⏳' : '⚡'}</span>
                <span>{aiLoading ? 'Analyzing Trading Day...' : 'Review My Day with JAHZ AI'}</span>
              </button>
            </div>

            {/* AI Processing / Loading UX */}
            {aiLoading && (
              <div className="bg-slate-950/80 border border-indigo-800/60 rounded-xl p-6 text-center space-y-3 my-4">
                <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                <h4 className="text-sm font-bold text-white">JAHZ AI is reviewing your trading day...</h4>
                <p className="text-xs text-indigo-300">
                  Status: <strong className="uppercase">{aiStatus || 'QUEUED'}</strong> — Synthesizing metrics, risk control, and reflections.
                </p>
              </div>
            )}

            {/* AI Error UX */}
            {aiError && (
              <div className="bg-rose-950/50 border border-rose-900/60 rounded-xl p-4 text-xs text-rose-300 flex items-center justify-between mb-4">
                <span>{aiError}</span>
                <button
                  onClick={handleTriggerAiReview}
                  className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 text-white font-bold text-xs rounded-lg"
                >
                  Retry AI Review
                </button>
              </div>
            )}

            {/* AI Structured Output Display */}
            {aiOutput?.structured && (
              <div className="space-y-6 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5">
                {/* Executive Summary */}
                <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Executive Coaching Summary</h4>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    {aiOutput.structured.executiveSummary}
                  </p>
                </div>

                {/* Grid for Coaching Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* What You Did Well */}
                  {aiOutput.structured.whatYouDidWell?.length > 0 && (
                    <div className="bg-slate-900/90 border border-emerald-900/40 rounded-xl p-4">
                      <h5 className="font-bold text-emerald-400 uppercase tracking-wider mb-2">✅ Key Strengths Today</h5>
                      <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                        {aiOutput.structured.whatYouDidWell.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mistakes / Weaknesses */}
                  {aiOutput.structured.whatWentWrong?.length > 0 && (
                    <div className="bg-slate-900/90 border border-rose-900/40 rounded-xl p-4">
                      <h5 className="font-bold text-rose-400 uppercase tracking-wider mb-2">⚠️ Areas for Improvement</h5>
                      <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                        {aiOutput.structured.whatWentWrong.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risk Management */}
                  {aiOutput.structured.riskManagementReview?.length > 0 && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                      <h5 className="font-bold text-indigo-400 uppercase tracking-wider mb-2">🛡️ Risk Management</h5>
                      <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                        {aiOutput.structured.riskManagementReview.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Discipline & Emotion */}
                  {aiOutput.structured.emotionalObservations?.length > 0 && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                      <h5 className="font-bold text-amber-400 uppercase tracking-wider mb-2">🧠 Behavioral Patterns</h5>
                      <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                        {aiOutput.structured.emotionalObservations.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Key Lesson & Tomorrow Focus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3.5">
                    <span className="font-bold text-indigo-300 uppercase tracking-wider block mb-1">Key Takeaway Lesson</span>
                    <p className="text-slate-200 font-medium">{aiOutput.structured.keyLesson}</p>
                  </div>
                  <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3.5">
                    <span className="font-bold text-indigo-300 uppercase tracking-wider block mb-1">Tomorrow's Primary Focus</span>
                    <p className="text-slate-200 font-medium">{aiOutput.structured.tomorrowFocus}</p>
                  </div>
                </div>

                {/* Educational Safety Disclaimer */}
                <div className="border-t border-slate-800/80 pt-3 text-[10px] text-slate-500">
                  {aiOutput.structured.disclaimer || 'JAHZ AI provides educational analysis based on your journal data and does not provide financial advice.'}
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
