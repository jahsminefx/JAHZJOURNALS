import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Calendar, Loader2, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiWeeklyCoachPage = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [coachSummaries, setCoachSummaries] = useState({});

  const fetchReviews = async () => {
    try {
      const { data } = await api.get('/weekly-reviews');
      const sorted = (data || []).sort((a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate));
      setReviews(sorted);

      const summaries = {};
      for (const r of sorted) {
        if (r.aiSummary) {
          try {
            summaries[r.id] = typeof r.aiSummary === 'string' ? JSON.parse(r.aiSummary) : r.aiSummary;
          } catch (_) {
            summaries[r.id] = { weeklySummary: r.aiSummary };
          }
        }
      }
      setCoachSummaries(summaries);
    } catch (err) {
      toast.error('Failed to load your weekly reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const pollRequestStatus = async (requestId, reviewId) => {
    let attempts = 0;
    const maxAttempts = 30; // 60s max
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        attempts++;
        try {
          const { data } = await api.get(`/ai/requests/${requestId}`);
          if (data.status === 'COMPLETED') {
            clearInterval(interval);
            resolve(data.structuredOutput);
          } else if (data.status === 'FAILED') {
            clearInterval(interval);
            reject(new Error(data.errorMessage || 'Weekly Coach analysis failed.'));
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error('Weekly Coach analysis timed out. Please try again.'));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 2000);
    });
  };

  const handleGenerateCoach = async (reviewId) => {
    setProcessingId(reviewId);
    try {
      const { data } = await api.post(`/ai/weekly-reviews/${reviewId}/coach`);
      toast.success('Weekly Coach analysis started...');

      let result = null;
      if (data.structuredOutput) {
        result = data.structuredOutput;
      } else if (data.requestId) {
        result = await pollRequestStatus(data.requestId, reviewId);
      }

      if (result) {
        setCoachSummaries(prev => ({ ...prev, [reviewId]: result }));
        toast.success('Weekly Coach analysis complete!');
        await fetchReviews();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to trigger Weekly Coach';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-background font-sans text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
                 <Compass size={24} />
               </div>
               <h1 className="text-2xl font-bold text-foreground">Weekly Coach</h1>
             </div>
             <p className="text-muted text-sm max-w-2xl">
               Get high-level strategic feedback on your weekly performance, adherence to rules, and suggestions for the upcoming trading week.
             </p>
           </div>
           <NavLink to="/weekly-review" className="px-5 py-2.5 bg-surface-muted border border-border text-foreground rounded-xl hover:bg-surface-muted/80 text-xs font-bold transition-all">
             Go to Weekly Reviews
           </NavLink>
        </div>

        {loading ? (
           <div className="bg-surface border border-border rounded-2xl p-12 flex items-center justify-center">
             <Loader2 size={32} className="animate-spin text-emerald-400" />
           </div>
        ) : reviews.length === 0 ? (
           <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-md">
             <Calendar size={32} className="text-muted mx-auto mb-4" />
             <h3 className="text-base font-bold text-foreground mb-1">No Weekly Reviews Found</h3>
             <p className="text-xs text-muted">Complete a Weekly Review on the dashboard to access the AI Coach.</p>
           </div>
        ) : (
           <div className="space-y-4">
              {reviews.map(review => {
                 const summary = coachSummaries[review.id];
                 const isProcessing = processingId === review.id;

                 return (
                   <div key={review.id} className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground text-sm">
                              Week of {new Date(review.weekStartDate).toLocaleDateString()}
                            </span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${review.netProfitLoss >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              ${review.netProfitLoss?.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-muted font-mono">
                            {review.totalTrades} Trades • {(Number(review.winRate || 0) * (review.winRate > 1 ? 1 : 100)).toFixed(0)}% WR
                          </p>
                       </div>
                       <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleGenerateCoach(review.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            {summary ? 'Regenerate Coach Review' : 'Ask Coach'}
                          </button>
                       </div>
                     </div>

                     {/* Coach Summary Breakdown */}
                     {isProcessing ? (
                       <div className="p-4 bg-surface-muted/30 border border-border rounded-xl flex items-center gap-3 text-xs text-muted font-semibold">
                         <Loader2 size={16} className="animate-spin text-emerald-400" />
                         <span>Analyzing weekly stats and behavioral patterns...</span>
                       </div>
                     ) : summary ? (
                       <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3 text-xs">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                            <CheckCircle2 size={15} />
                            Weekly Coach Insight
                          </div>

                          {summary.weeklySummary && (
                            <p className="text-foreground font-medium leading-relaxed">
                              {summary.weeklySummary}
                            </p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {summary.mainStrength && (
                              <div className="p-3 bg-surface rounded-lg border border-border">
                                <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Key Strength</span>
                                <span className="text-muted leading-relaxed">{summary.mainStrength}</span>
                              </div>
                            )}

                            {summary.mainWeakness && (
                              <div className="p-3 bg-surface rounded-lg border border-border">
                                <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Key Growth Area</span>
                                <span className="text-muted leading-relaxed">{summary.mainWeakness}</span>
                              </div>
                            )}
                          </div>

                          {summary.measurableGoalForNextWeek && (
                            <div className="p-3 bg-surface rounded-lg border border-emerald-500/30">
                              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Goal for Next Week</span>
                              <span className="text-foreground font-semibold">{summary.measurableGoalForNextWeek}</span>
                            </div>
                          )}
                       </div>
                     ) : null}

                   </div>
                 );
              })}
           </div>
        )}
      </div>
    </div>
  );
};

export default AiWeeklyCoachPage;
