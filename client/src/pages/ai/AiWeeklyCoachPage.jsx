import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Calendar, Loader2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiWeeklyCoachPage = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data } = await api.get('/weekly-reviews');
        // Sort descending by weekStartDate
        const sorted = data.sort((a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate));
        setReviews(sorted);
      } catch (err) {
        toast.error('Failed to load your weekly reviews.');
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const handleGenerateCoach = async (reviewId) => {
    setProcessingId(reviewId);
    try {
      await api.post(`/ai/weekly-reviews/${reviewId}/coach`);
      toast.success('Weekly Coach analysis queued! Check recent activity later.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger Weekly Coach');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-background">
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
           <NavLink to="/weekly-review" className="px-5 py-2.5 bg-surface-muted border border-border text-foreground rounded-lg hover:bg-surface-muted/80 text-sm font-medium transition-colors">
             Go to Weekly Reviews
           </NavLink>
        </div>

        {loading ? (
           <div className="bg-surface border border-border rounded-xl p-12 flex items-center justify-center">
             <Loader2 size={32} className="animate-spin text-muted" />
           </div>
        ) : reviews.length === 0 ? (
           <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-sm">
             <Calendar size={32} className="text-muted mx-auto mb-4" />
             <h3 className="text-lg font-bold text-foreground mb-2">No Weekly Reviews Found</h3>
             <p className="text-sm text-muted">Complete a Weekly Review on the dashboard to access the AI Coach.</p>
           </div>
        ) : (
           <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-surface-muted/30">
                 <h2 className="font-semibold text-foreground">Your Weekly Reviews</h2>
              </div>
              <div className="divide-y divide-border">
                 {reviews.map(review => {
                    return (
                      <div key={review.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/10 transition-colors">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <span className="font-bold text-foreground">
                               Week of {new Date(review.weekStartDate).toLocaleDateString()}
                             </span>
                             <span className={`text-xs px-2 py-0.5 rounded font-medium ${review.netProfitLoss >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                               ${review.netProfitLoss?.toFixed(2)}
                             </span>
                           </div>
                           <p className="text-xs text-muted">
                             {review.totalTrades} Trades • {review.winRate}% WR
                           </p>
                        </div>
                        <div className="flex items-center gap-3">
                           {review.aiSummary ? (
                              <NavLink to={`/weekly-review`} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors">
                                Validated <ArrowRight size={14} />
                              </NavLink>
                           ) : (
                              <button 
                                onClick={() => handleGenerateCoach(review.id)}
                                disabled={processingId === review.id}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                {processingId === review.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                Ask Coach
                              </button>
                           )}
                        </div>
                      </div>
                    )
                 })}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AiWeeklyCoachPage;
