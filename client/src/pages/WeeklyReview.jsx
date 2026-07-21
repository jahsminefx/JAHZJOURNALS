import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

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
        setAiInsight({ weeklySummary: review.aiSummary }); // fallback for legacy text
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
    // We poll if there's no aiSummary but we requested it, or if we want to determine queued status from a global state.
    // For simplicity, if we triggered generation, we just poll the review until aiSummary appears
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
          // We don't have AiRequest attached to the review payload yet, so if it fails silently it might poll forever. 
          // Stop after 20 tries (60 seconds)
        } catch (e) {
          console.error(e);
        }
      }, 3000);
      
      // Stop after 20 tries
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

  return (
    <div className="space-y-6 text-foreground font-sans">
      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <h2 className="text-2xl font-bold">Weekly Reflection</h2>
        <p className="mt-1 text-sm text-muted">Gather the week's data, find the lessons disguised as losses, and plan your next week.</p>
        <form onSubmit={generateReview} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm text-muted">
            Account
            <select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">All accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">
            Week Start
            <input type="date" value={form.weekStartDate} onChange={(event) => setForm((current) => ({ ...current, weekStartDate: event.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" />
          </label>
          <button type="submit" disabled={generating} className="self-end rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
            {generating ? 'Building...' : 'Build Review'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-surface-muted p-8 text-center text-muted">Loading your weeks...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.4fr]">
          <div className="rounded-xl border border-border bg-surface-muted overflow-hidden">
            <div className="border-b border-border p-4 font-bold">Previous Reviews</div>
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-muted">No weekly reviews yet.</div>
            ) : (
              <div className="divide-y divide-gray-700">
                {reviews.map((review) => (
                  <button key={review.id} type="button" onClick={() => selectReview(review)} className={`block w-full p-4 text-left hover:bg-gray-700/50 ${selectedReview?.id === review.id ? 'bg-gray-700/60' : ''}`}>
                    <p className="font-semibold text-foreground">{new Date(review.weekStartDate).toLocaleDateString()} - {new Date(review.weekEndDate).toLocaleDateString()}</p>
                    <p className="text-sm text-muted">{review.tradingAccount?.name || 'All accounts'} | {review.totalTrades} trades | {Number(review.winRate || 0).toFixed(1)}% win</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!selectedReview ? (
            <div className="rounded-xl border border-border bg-surface-muted p-8 text-center text-muted">Pick a past week, or build a new one to reflect on.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[
                  ['Total Trades', selectedReview.totalTrades],
                  ['Win Rate', `${Number(selectedReview.winRate || 0).toFixed(1)}%`],
                  ['Net P/L', `$${Number(selectedReview.netProfitLoss || 0).toFixed(2)}`],
                  ['Discipline', selectedReview.disciplineScore === null ? 'N/A' : `${selectedReview.disciplineScore}/100`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-surface-muted p-5">
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {aiInsight ? (
                <div className="bg-purple-500/10 p-6 rounded-xl border border-purple-500/30 shadow-lg mt-6 mb-6">
                  <h3 className="text-lg font-bold text-purple-400 border-b border-purple-500/30 pb-2 mb-4 flex items-center gap-2">
                    JAHZ AI Weekly Coach
                  </h3>
                  
                  {aiInsight.sampleSizeWarning && (
                    <div className="bg-yellow-500/20 text-yellow-500 text-sm p-3 rounded-lg border border-yellow-500/30 mb-4">
                      {aiInsight.sampleSizeWarning}
                    </div>
                  )}

                  <p className="text-sm text-foreground/90 italic leading-relaxed mb-6">
                    "{aiInsight.weeklySummary}"
                  </p>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-green-400 mb-2">Continue Doing</h4>
                      <p className="text-sm text-muted">{aiInsight.whatToContinueDoing}</p>
                      
                      <h4 className="font-semibold text-green-400 mt-4 mb-2">Greatest Strength</h4>
                      <p className="text-sm text-muted">{aiInsight.mainStrength}</p>
                      
                      <h4 className="font-semibold text-purple-400 mt-4 mb-2">Positive Habit</h4>
                      <p className="text-sm text-muted">{aiInsight.mostUsefulPositiveHabit}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-red-400 mb-2">Stop Doing</h4>
                      <p className="text-sm text-muted">{aiInsight.whatToStopDoing}</p>
                      
                      <h4 className="font-semibold text-red-400 mt-4 mb-2">Weakness</h4>
                      <p className="text-sm text-muted">{aiInsight.mainWeakness}</p>
                      
                      <h4 className="font-semibold text-orange-400 mt-4 mb-2">Repeated Mistake</h4>
                      <p className="text-sm text-muted">{aiInsight.mostImportantRepeatedMistake}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-purple-500/30">
                     <div>
                       <h4 className="font-semibold text-muted mb-2">Psychology Check</h4>
                       <p className="text-sm text-muted">{aiInsight.psychologyInsight}</p>
                     </div>
                     <div>
                       <h4 className="font-semibold text-muted mb-2">Risk Check</h4>
                       <p className="text-sm text-muted">{aiInsight.riskManagementInsight}</p>
                     </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-purple-500/30 text-center">
                    <h4 className="font-bold text-purple-300 text-lg mb-2">Measurable Goal for Next Week</h4>
                    <p className="text-md text-foreground">{aiInsight.measurableGoalForNextWeek}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-muted p-6 rounded-xl border border-purple-500/30 mt-6 mb-6 flex flex-col items-center justify-center space-y-3">
                   <h3 className="text-lg font-bold text-purple-400">Want deeper insight?</h3>
                   <p className="text-sm text-muted text-center">Let JAHZ AI analyze these statistics and give you a structured psychological and risk breakdown.</p>
                   <button
                     onClick={requestAiCoach}
                     disabled={isGeneratingAi}
                     className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-4 py-2 text-sm font-bold text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 border border-purple-500/50 mt-2"
                   >
                     {isGeneratingAi ? 'Analyzing Data...' : 'Generate AI Weekly Coach'}
                   </button>
                </div>
              )}

              <div className="rounded-xl border border-border bg-surface-muted p-6">
                <h3 className="mb-4 text-lg font-bold text-green-400">The Hard Truth</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <p className="text-sm text-muted">Profit factor: <span className="font-semibold text-foreground">{selectedReview.profitFactor === null ? 'N/A' : Number(selectedReview.profitFactor || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-muted">Expectancy: <span className="font-semibold text-foreground">${Number(selectedReview.expectancy || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-muted">Average win: <span className="font-semibold text-foreground">${Number(selectedReview.averageWin || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-muted">Average loss: <span className="font-semibold text-foreground">${Number(selectedReview.averageLoss || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-muted">Most broken rule: <span className="font-semibold text-foreground">{selectedReview.mostBrokenRule || 'None'}</span></p>
                  <p className="text-sm text-muted">Most common emotion: <span className="font-semibold text-foreground">{selectedReview.mostCommonEmotion || 'None'}</span></p>
                  <p className="text-sm text-muted">Plan-following rate: <span className="font-semibold text-foreground">{selectedReview.planFollowingRate === null ? 'N/A' : `${Number(selectedReview.planFollowingRate || 0).toFixed(1)}%`}</span></p>
                  <p className="text-sm text-muted">A+ setup win rate: <span className="font-semibold text-foreground">{Number(selectedReview.aPlusSetupWinRate || 0).toFixed(1)}%</span></p>
                  {selectedReview.bestTradeId && <Link to={`/trades/${selectedReview.bestTradeId}`} className="text-sm text-green-400 hover:text-green-300">Open best trade</Link>}
                  {selectedReview.worstTradeId && <Link to={`/trades/${selectedReview.worstTradeId}`} className="text-sm text-red-400 hover:text-red-300">Open worst trade</Link>}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted p-6">
                <h3 className="text-lg font-bold text-green-400">Discipline Score Explanation</h3>
                <p className="mt-2 text-sm text-muted">Formula version: {selectedReview.disciplineScoreFormulaVersion || components.formulaVersion || 'discipline-v1'}</p>
                {components.reason ? (
                  <p className="mt-3 text-sm text-muted">{components.reason}</p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <p className="text-sm text-muted">Plan-following: {components.planFollowingRate ?? 0}%</p>
                    <p className="text-sm text-muted">Violations/trade: {components.ruleViolationsPerTrade ?? 0}</p>
                    <p className="text-sm text-muted">Post-trade notes: {components.postTradeNoteCompletionRate ?? 0}%</p>
                    <p className="text-sm text-muted">High emotion logs/trade: {components.highIntensityEmotionLogsPerTrade ?? 0}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-surface-muted p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-green-400">Your Reflection</h3>
                  <button type="button" onClick={saveReflections} disabled={saving} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
                    {saving ? 'Saving...' : 'Save Reflection'}
                  </button>
                </div>
                <div className="space-y-4">
                  {reflectionFields.map(([field, label]) => (
                    <label key={field} className="block text-sm text-muted">
                      {label}
                      <textarea value={reflections[field] || ''} onChange={(event) => setReflections((current) => ({ ...current, [field]: event.target.value }))} rows="3" className="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-green-400" />
                    </label>
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
