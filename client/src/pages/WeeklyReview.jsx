import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, TrendingUp, TrendingDown, ExternalLink, Sparkles, CheckCircle2, XCircle, AlertTriangle, Brain, Target, ShieldCheck, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/useAuth';
import { generateWeeklyPdfReport } from '../utils/pdfReportService';

const getMondayDate = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().slice(0, 10);
};

const reflectionFields = [
  ['mainMistake', 'Main Mistake'],
  ['personalLesson', 'Personal Lesson'],
  ['nextWeekFocus', "Next Week's Focus"],
  ['generalReflection', 'General Reflection'],
  ['additionalNotes', 'Additional Notes'],
];

const inputStyle = "mt-1.5 block w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:bg-surface shadow-sm";

const WeeklyReview = () => {
  const [accounts, setAccounts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [form, setForm] = useState({ accountId: '', weekStartDate: getMondayDate() });
  const [reflections, setReflections] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const { user } = useAuth();

  const handleExportPdf = async () => {
    if (!selectedReview) {
      toast.error('Please select or generate a weekly review first.');
      return;
    }

    const plan = user?.subscriptionPlan || 'FREE';
    const role = user?.role;
    const isAllowed = ['PRO', 'MENTOR'].includes(plan) || ['SUPER_ADMIN', 'ADMIN', 'MENTOR'].includes(role);

    if (!isAllowed) {
      toast.error('PDF Report Export is exclusive to PRO & MENTOR plans. Please upgrade your account.');
      return;
    }

    try {
      setExportingPdf(true);
      toast.loading('Generating Weekly PDF Report...', { id: 'pdf-gen' });
      await generateWeeklyPdfReport({
        user,
        weeklyData: selectedReview,
        aiCoaching: aiInsight
      });
      toast.success('Weekly PDF report exported successfully!', { id: 'pdf-gen' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate weekly PDF report.', { id: 'pdf-gen' });
    } finally {
      setExportingPdf(false);
    }
  };

  const fetchReviews = async () => {
    const params = new URLSearchParams();
    if (form.accountId) params.append('accountId', form.accountId);
    const { data } = await api.get(`/weekly-reviews?${params.toString()}`);
    setReviews(data.data || []);
    if (!selectedReview && data.data?.length) {
      setSelectedReview(data.data[0]);
      setReflectionsFromReview(data.data[0]);
    }
  };

  const setReflectionsFromReview = (review) => {
    setReflections(Object.fromEntries(reflectionFields.map(([field]) => [field, review?.[field] || ''])));
    if (review?.aiSummary) {
      try {
        setAiInsight(JSON.parse(review.aiSummary));
      } catch (e) {
        setAiInsight({ weeklySummary: review.aiSummary });
      }
    } else {
      setAiInsight(null);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const accountsResponse = await api.get('/accounts');
        setAccounts(accountsResponse.data);
        const reviewsResponse = await api.get('/weekly-reviews');
        setReviews(reviewsResponse.data.data || []);
        if (reviewsResponse.data.data?.length) {
          setSelectedReview(reviewsResponse.data.data[0]);
          setReflectionsFromReview(reviewsResponse.data.data[0]);
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Couldn\'t pull in your weekly reviews right now.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const generateReview = async (event) => {
    event.preventDefault();
    setGenerating(true);
    try {
      const { data } = await api.post('/weekly-reviews/generate', {
        accountId: form.accountId || undefined,
        weekStartDate: form.weekStartDate,
      });
      setSelectedReview(data.data);
      setReflectionsFromReview(data.data);
      toast.success(data.message || 'Review built—time to reflect.');
      await fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to build your review. Try that again.');
    } finally {
      setGenerating(false);
    }
  };

  const selectReview = (review) => {
    setSelectedReview(review);
    setReflectionsFromReview(review);
  };

  const saveReflections = async () => {
    if (!selectedReview) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/weekly-reviews/${selectedReview.id}`, reflections);
      setSelectedReview(data);
      setReflectionsFromReview(data);
      await fetchReviews();
      toast.success('Thoughts saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t save your thoughts. Try once more.');
    } finally {
      setSaving(false);
    }
  };

  const requestAiCoach = async () => {
    if (!selectedReview) return;
    setIsGeneratingAi(true);
    toast.loading('Analyzing your weekly statistics...', { id: 'aiCoachToast' });
    try {
      await api.post(`/ai/weekly-reviews/${selectedReview.id}/coach`);
      toast.loading('Weekly analysis queued. Sit tight...', { id: 'aiCoachToast' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to queue AI coach.', { id: 'aiCoachToast' });
      setIsGeneratingAi(false);
    }
  };

  useEffect(() => {
    let intervalId;
    if (isGeneratingAi && selectedReview) {
      intervalId = setInterval(async () => {
        try {
          const { data } = await api.get(`/weekly-reviews?accountId=${form.accountId}`);
          const reviewList = data.data || [];
          const updatedReview = reviewList.find(r => r.id === selectedReview.id);
          
          if (updatedReview && updatedReview.aiSummary) {
            setSelectedReview(updatedReview);
            setReflectionsFromReview(updatedReview);
            setIsGeneratingAi(false);
            toast.success('AI Weekly Coach analysis complete!', { id: 'aiCoachToast' });
            clearInterval(intervalId);
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);
      
      setTimeout(() => {
        if (isGeneratingAi) {
           setIsGeneratingAi(false);
           clearInterval(intervalId);
        }
      }, 60000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isGeneratingAi, selectedReview, form.accountId]);

  const components = selectedReview?.disciplineScoreComponents || {};
  const netPnl = selectedReview ? Number(selectedReview.netProfitLoss || 0) : 0;

  return (
    <div className="space-y-6 text-foreground font-sans pb-16">
      <SEO title="Weekly Review & Reflection | JAHZJOURNALS" description="Analyze your weekly trading metrics, AI coaching insights, and discipline score." />
      <Breadcrumbs />

      {/* Page Header & Build Form Panel */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Weekly Reflection</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted">Gather the week's data, find the lessons disguised as losses, and plan your next week.</p>
          </div>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || !selectedReview}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20 transition disabled:opacity-50 self-start sm:self-auto"
          >
            <Download size={14} />
            <span>{exportingPdf ? 'Generating PDF...' : 'Export PDF Weekly Report'}</span>
          </button>
        </div>

        <form onSubmit={generateReview} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] pt-4 border-t border-border items-end">
          <div>
            <label htmlFor="review-account-id" className="block text-xs font-bold uppercase tracking-wider text-muted">
              Account
            </label>
            <select id="review-account-id" value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className={inputStyle}>
              <option value="" className="bg-surface text-foreground">All Accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id} className="bg-surface text-foreground">{account.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="review-week-start" className="block text-xs font-bold uppercase tracking-wider text-muted">
              Week Start Date
            </label>
            <input id="review-week-start" type="date" value={form.weekStartDate} onChange={(event) => setForm((current) => ({ ...current, weekStartDate: event.target.value }))} className={inputStyle} />
          </div>

          <button type="submit" disabled={generating} className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-2.5 text-xs font-bold text-slate-950 transition shadow-sm disabled:opacity-70">
            {generating ? 'Building...' : 'Build Review'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted font-medium shadow-sm">Loading your weekly reviews...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Previous Reviews Sidebar */}
          <aside className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden self-start">
            <div className="border-b border-border bg-surface-muted px-5 py-4 font-black text-xs uppercase tracking-wider text-muted">
              Previous Reviews
            </div>
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">No weekly reviews yet. Build one above.</div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {reviews.map((review) => {
                  const isSelected = selectedReview?.id === review.id;
                  const itemPnl = Number(review.netProfitLoss || 0);

                  return (
                    <button 
                      key={review.id} 
                      type="button" 
                      onClick={() => selectReview(review)} 
                      className={`block w-full p-4 text-left transition ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-l-4 border-emerald-500 text-foreground font-bold' 
                          : 'hover:bg-surface-muted text-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-foreground">
                          {new Date(review.weekStartDate).toLocaleDateString()} - {new Date(review.weekEndDate).toLocaleDateString()}
                        </p>
                        <span className={`text-xs font-bold ${itemPnl >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`}>
                          {itemPnl >= 0 ? '+' : ''}${itemPnl.toFixed(0)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted font-medium">
                        {review.tradingAccount?.name || 'All Accounts'} · {review.totalTrades} trades · {Number(review.winRate || 0).toFixed(1)}% win
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Selected Review Main Workspace */}
          {!selectedReview ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted font-medium shadow-sm">
              Pick a past week, or build a new one to start your reflection.
            </div>
          ) : (
            <div className="space-y-6 min-w-0">
              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Trades</span>
                  <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{selectedReview.totalTrades}</p>
                </div>

                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Win Rate</span>
                  <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{Number(selectedReview.winRate || 0).toFixed(1)}%</p>
                </div>

                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Net P/L</span>
                  <p className={`mt-2 text-2xl font-black tracking-tight ${netPnl >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Discipline Score</span>
                  <p className={`mt-2 text-2xl font-black tracking-tight ${selectedReview.disciplineScore >= 75 ? 'text-emerald-500 dark:text-emerald-400' : selectedReview.disciplineScore >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-500'}`}>
                    {selectedReview.disciplineScore === null ? 'N/A' : `${selectedReview.disciplineScore}/100`}
                  </p>
                </div>
              </div>

              {/* JAHZ AI Weekly Coach Panel */}
              {aiInsight ? (
                <div className="rounded-2xl border border-purple-500/40 bg-surface p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                    <h3 className="text-base font-black text-purple-700 dark:text-purple-400 flex items-center gap-2">
                      <Sparkles size={18} className="text-purple-600 dark:text-purple-400" /> JAHZ AI Weekly Coach
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-500/15 px-2.5 py-1 rounded-full border border-purple-500/30">
                      AI Analysis Ready
                    </span>
                  </div>
                  
                  {aiInsight.sampleSizeWarning && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-slate-900 shadow-sm dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-200">
                      <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>{aiInsight.sampleSizeWarning}</span>
                    </div>
                  )}

                  <p className="text-sm font-semibold text-foreground italic leading-relaxed bg-surface-muted p-4 rounded-xl border border-border">
                    "{aiInsight.weeklySummary}"
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-4">
                      {aiInsight.whatToContinueDoing && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                            <CheckCircle2 size={14} /> Continue Doing
                          </h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.whatToContinueDoing}</p>
                        </div>
                      )}
                      
                      {aiInsight.mainStrength && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Greatest Strength</h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.mainStrength}</p>
                        </div>
                      )}
                      
                      {aiInsight.mostUsefulPositiveHabit && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1">Positive Habit</h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.mostUsefulPositiveHabit}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {aiInsight.whatToStopDoing && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                            <XCircle size={14} /> Stop Doing
                          </h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.whatToStopDoing}</p>
                        </div>
                      )}
                      
                      {aiInsight.mainWeakness && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">Weakness</h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.mainWeakness}</p>
                        </div>
                      )}
                      
                      {aiInsight.mostImportantRepeatedMistake && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">Repeated Mistake</h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.mostImportantRepeatedMistake}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(aiInsight.psychologyInsight || aiInsight.riskManagementInsight) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-purple-500/20">
                      {aiInsight.psychologyInsight && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-foreground mb-1">Psychology Check</h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.psychologyInsight}</p>
                        </div>
                      )}
                      {aiInsight.riskManagementInsight && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-foreground mb-1">Risk Check</h4>
                          <p className="text-xs text-foreground font-medium leading-relaxed">{aiInsight.riskManagementInsight}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {aiInsight.measurableGoalForNextWeek && (
                    <div className="pt-4 border-t border-purple-500/20 text-center bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl">
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-1">Measurable Goal for Next Week</h4>
                      <p className="text-sm font-extrabold text-foreground">{aiInsight.measurableGoalForNextWeek}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-purple-500/30 bg-surface p-6 shadow-sm flex flex-col items-center justify-center space-y-3 text-center">
                  <Brain size={28} className="text-purple-500" />
                  <h3 className="text-base font-black text-foreground">Want deeper weekly insights?</h3>
                  <p className="text-xs text-muted max-w-md">Let JAHZ AI analyze these statistics and generate a structured psychological and risk breakdown.</p>
                  <button
                    onClick={requestAiCoach}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500 hover:bg-purple-400 px-5 py-2.5 text-xs font-bold text-white transition shadow-sm disabled:opacity-50 mt-1"
                  >
                    <Sparkles size={15} />
                    {isGeneratingAi ? 'Analyzing Data...' : 'Generate AI Weekly Coach'}
                  </button>
                </div>
              )}

              {/* The Hard Truth Card */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <Flame size={18} className="text-amber-500" /> The Hard Truth
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-surface-muted px-2.5 py-1 rounded-full border border-border">
                    Weekly Reality Check
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-surface-muted p-3.5 rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Profit Factor</span>
                    <span className={`text-base font-black ${Number(selectedReview?.profitFactor || 0) >= 1.5 ? 'text-emerald-500 dark:text-emerald-400' : Number(selectedReview?.profitFactor || 0) >= 1.0 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {selectedReview?.profitFactor === null || selectedReview?.profitFactor === undefined ? 'N/A' : Number(selectedReview.profitFactor || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-surface-muted p-3.5 rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Expectancy / Trade</span>
                    <span className={`text-base font-black ${Number(selectedReview.expectancy || 0) >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`}>
                      ${Number(selectedReview.expectancy || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-surface-muted p-3.5 rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Average Win</span>
                    <span className="text-base font-black text-emerald-500 dark:text-emerald-400">
                      ${Number(selectedReview.averageWin || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-surface-muted p-3.5 rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Average Loss</span>
                    <span className="text-base font-black text-rose-500">
                      ${Number(selectedReview.averageLoss || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between bg-surface-muted p-3 rounded-xl border border-border text-xs">
                    <span className="text-muted font-medium">Most Broken Rule</span>
                    <span className="font-bold text-foreground">{selectedReview.mostBrokenRule || 'None'}</span>
                  </div>

                  <div className="flex items-center justify-between bg-surface-muted p-3 rounded-xl border border-border text-xs">
                    <span className="text-muted font-medium">Most Common Emotion</span>
                    <span className="font-bold text-foreground">{selectedReview.mostCommonEmotion || 'None'}</span>
                  </div>

                  <div className="flex items-center justify-between bg-surface-muted p-3 rounded-xl border border-border text-xs">
                    <span className="text-muted font-medium">Plan-Following Rate</span>
                    <span className="font-bold text-foreground">
                      {selectedReview.planFollowingRate === null ? 'N/A' : `${Number(selectedReview.planFollowingRate || 0).toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-surface-muted p-3 rounded-xl border border-border text-xs">
                    <span className="text-muted font-medium">A+ Setup Win Rate</span>
                    <span className="font-bold text-foreground">
                      {Number(selectedReview.aPlusSetupWinRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {(selectedReview.bestTradeId || selectedReview.worstTradeId) && (
                  <div className="flex items-center gap-4 pt-3 border-t border-border">
                    {selectedReview.bestTradeId && (
                      <Link
                        to={`/trades/${selectedReview.bestTradeId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 dark:text-emerald-400 hover:underline transition-colors"
                      >
                        <TrendingUp size={14} /> Open best trade <ExternalLink size={12} />
                      </Link>
                    )}
                    {selectedReview.worstTradeId && (
                      <Link
                        to={`/trades/${selectedReview.worstTradeId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:underline transition-colors"
                      >
                        <TrendingDown size={14} /> Open worst trade <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Discipline Score Explanation Card */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-500" /> Discipline Score Explanation
                  </h3>
                  <span className="text-[10px] font-mono text-muted">
                    {selectedReview.disciplineScoreFormulaVersion || components.formulaVersion || 'discipline-v1'}
                  </span>
                </div>
                {components.reason ? (
                  <p className="text-xs text-muted leading-relaxed">{components.reason}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-surface-muted p-3 rounded-xl border border-border text-xs text-muted font-medium">Plan-following: <strong className="text-foreground font-bold">{components.planFollowingRate ?? 0}%</strong></div>
                    <div className="bg-surface-muted p-3 rounded-xl border border-border text-xs text-muted font-medium">Violations/trade: <strong className="text-foreground font-bold">{components.ruleViolationsPerTrade ?? 0}</strong></div>
                    <div className="bg-surface-muted p-3 rounded-xl border border-border text-xs text-muted font-medium">Post-trade notes: <strong className="text-foreground font-bold">{components.postTradeNoteCompletionRate ?? 0}%</strong></div>
                    <div className="bg-surface-muted p-3 rounded-xl border border-border text-xs text-muted font-medium">High emotion logs: <strong className="text-foreground font-bold">{components.highIntensityEmotionLogsPerTrade ?? 0}</strong></div>
                  </div>
                )}
              </div>

              {/* Your Reflection Form Card */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <h3 className="text-base font-black text-foreground">Your Reflection</h3>
                  <button 
                    type="button" 
                    onClick={saveReflections} 
                    disabled={saving} 
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2 text-xs font-bold text-slate-950 transition shadow-sm disabled:opacity-70"
                  >
                    {saving ? 'Saving...' : 'Save Reflection'}
                  </button>
                </div>

                <div className="space-y-4">
                  {reflectionFields.map(([field, label]) => (
                    <div key={field}>
                      <label htmlFor={`reflection-${field}`} className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                        {label}
                      </label>
                      <textarea 
                        id={`reflection-${field}`} 
                        value={reflections[field] || ''} 
                        onChange={(event) => setReflections((current) => ({ ...current, [field]: event.target.value }))} 
                        rows="3" 
                        placeholder={`Write your ${label.toLowerCase()}...`}
                        className="w-full resize-none rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-emerald-500 focus:bg-surface outline-none transition shadow-sm" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyReview;
