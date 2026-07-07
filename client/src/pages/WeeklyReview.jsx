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
        toast.error(error.response?.data?.message || 'Failed to load weekly reviews');
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
      toast.success(data.message || 'Weekly review generated');
      await fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate weekly review');
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
      toast.success('Reflections saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save reflections');
    } finally {
      setSaving(false);
    }
  };

  const components = selectedReview?.disciplineScoreComponents || {};

  return (
    <div className="space-y-6 text-gray-100 font-sans">
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h2 className="text-2xl font-bold">Weekly Review</h2>
        <p className="mt-1 text-sm text-gray-400">Generate deterministic weekly stats from real trades, then add your written reflection.</p>
        <form onSubmit={generateReview} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm text-gray-300">
            Account
            <select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
              <option value="">All accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-300">
            Week Start
            <input type="date" value={form.weekStartDate} onChange={(event) => setForm((current) => ({ ...current, weekStartDate: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2" />
          </label>
          <button type="submit" disabled={generating} className="self-end rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
            {generating ? 'Generating...' : 'Generate Review'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-400">Loading weekly reviews...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.4fr]">
          <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
            <div className="border-b border-gray-700 p-4 font-bold">Previous Reviews</div>
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No weekly reviews yet.</div>
            ) : (
              <div className="divide-y divide-gray-700">
                {reviews.map((review) => (
                  <button key={review.id} type="button" onClick={() => selectReview(review)} className={`block w-full p-4 text-left hover:bg-gray-700/50 ${selectedReview?.id === review.id ? 'bg-gray-700/60' : ''}`}>
                    <p className="font-semibold text-gray-100">{new Date(review.weekStartDate).toLocaleDateString()} - {new Date(review.weekEndDate).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-400">{review.tradingAccount?.name || 'All accounts'} | {review.totalTrades} trades | {Number(review.winRate || 0).toFixed(1)}% win</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!selectedReview ? (
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-500">Select or generate a weekly review.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[
                  ['Total Trades', selectedReview.totalTrades],
                  ['Win Rate', `${Number(selectedReview.winRate || 0).toFixed(1)}%`],
                  ['Net P/L', `$${Number(selectedReview.netProfitLoss || 0).toFixed(2)}`],
                  ['Discipline', selectedReview.disciplineScore === null ? 'N/A' : `${selectedReview.disciplineScore}/100`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <p className="text-sm text-gray-400">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <h3 className="mb-4 text-lg font-bold text-green-400">Calculated Review</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <p className="text-sm text-gray-300">Profit factor: <span className="font-semibold text-white">{selectedReview.profitFactor === null ? 'N/A' : Number(selectedReview.profitFactor || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-gray-300">Expectancy: <span className="font-semibold text-white">${Number(selectedReview.expectancy || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-gray-300">Average win: <span className="font-semibold text-white">${Number(selectedReview.averageWin || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-gray-300">Average loss: <span className="font-semibold text-white">${Number(selectedReview.averageLoss || 0).toFixed(2)}</span></p>
                  <p className="text-sm text-gray-300">Most broken rule: <span className="font-semibold text-white">{selectedReview.mostBrokenRule || 'None'}</span></p>
                  <p className="text-sm text-gray-300">Most common emotion: <span className="font-semibold text-white">{selectedReview.mostCommonEmotion || 'None'}</span></p>
                  <p className="text-sm text-gray-300">Plan-following rate: <span className="font-semibold text-white">{selectedReview.planFollowingRate === null ? 'N/A' : `${Number(selectedReview.planFollowingRate || 0).toFixed(1)}%`}</span></p>
                  <p className="text-sm text-gray-300">A+ setup win rate: <span className="font-semibold text-white">{Number(selectedReview.aPlusSetupWinRate || 0).toFixed(1)}%</span></p>
                  {selectedReview.bestTradeId && <Link to={`/trades/${selectedReview.bestTradeId}`} className="text-sm text-green-400 hover:text-green-300">Open best trade</Link>}
                  {selectedReview.worstTradeId && <Link to={`/trades/${selectedReview.worstTradeId}`} className="text-sm text-red-400 hover:text-red-300">Open worst trade</Link>}
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <h3 className="text-lg font-bold text-green-400">Discipline Score Explanation</h3>
                <p className="mt-2 text-sm text-gray-400">Formula version: {selectedReview.disciplineScoreFormulaVersion || components.formulaVersion || 'discipline-v1'}</p>
                {components.reason ? (
                  <p className="mt-3 text-sm text-gray-500">{components.reason}</p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <p className="text-sm text-gray-300">Plan-following: {components.planFollowingRate ?? 0}%</p>
                    <p className="text-sm text-gray-300">Violations/trade: {components.ruleViolationsPerTrade ?? 0}</p>
                    <p className="text-sm text-gray-300">Post-trade notes: {components.postTradeNoteCompletionRate ?? 0}%</p>
                    <p className="text-sm text-gray-300">High emotion logs/trade: {components.highIntensityEmotionLogsPerTrade ?? 0}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-green-400">Trader Reflection</h3>
                  <button type="button" onClick={saveReflections} disabled={saving} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
                    {saving ? 'Saving...' : 'Save Reflection'}
                  </button>
                </div>
                <div className="space-y-4">
                  {reflectionFields.map(([field, label]) => (
                    <label key={field} className="block text-sm text-gray-300">
                      {label}
                      <textarea value={reflections[field] || ''} onChange={(event) => setReflections((current) => ({ ...current, [field]: event.target.value }))} rows="3" className="mt-2 w-full resize-none rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-400" />
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
