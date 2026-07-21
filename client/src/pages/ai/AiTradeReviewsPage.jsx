import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Target, Search, Loader2, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiTradeReviewsPage = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    const fetchClosedTrades = async () => {
      try {
        const { data } = await api.get('/trades?status=CLOSED');
        // Sort trades by most recent
        const sorted = data.sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));
        setTrades(sorted);
      } catch (err) {
        toast.error('Failed to load recent trades.');
      } finally {
        setLoading(false);
      }
    };
    fetchClosedTrades();
  }, []);

  const handleGenerateReview = async (tradeId) => {
    setProcessingId(tradeId);
    try {
      await api.post(`/ai/trade-insight/${tradeId}`);
      toast.success('Trade Review Generation Queued! You will be notified when complete.');
      // Ideally refresh trade list to show 'QUEUED'
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger review');
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
               <div className="p-2 bg-rose-500/20 text-rose-500 rounded-lg">
                 <Target size={24} />
               </div>
               <h1 className="text-2xl font-bold text-foreground">Trade Review Assistant</h1>
             </div>
             <p className="text-muted text-sm max-w-2xl">
               Automate your post-trade evaluation. Let JAHZ AI critique your execution, rules discipline, and psychological mindset.
             </p>
           </div>
        </div>

        {loading ? (
           <div className="bg-surface border border-border rounded-xl p-12 flex items-center justify-center">
             <Loader2 size={32} className="animate-spin text-muted" />
           </div>
        ) : trades.length === 0 ? (
           <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-sm">
             <AlertCircle size={32} className="text-muted mx-auto mb-4" />
             <h3 className="text-lg font-bold text-foreground mb-2">No closed trades found</h3>
             <p className="text-sm text-muted">You need to log and close a trade before you can run an AI review.</p>
           </div>
        ) : (
           <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-surface-muted/30">
                 <h2 className="font-semibold text-foreground">Your Closed Trades</h2>
              </div>
              <div className="divide-y divide-border">
                 {trades.map(trade => {
                    const hasReview = trade.aiReviews?.length > 0;
                    return (
                      <div key={trade.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/10 transition-colors">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <span className={`font-bold ${trade.result === 'WIN' ? 'text-emerald-500' : trade.result === 'LOSS' ? 'text-rose-500' : 'text-slate-400'}`}>
                               {trade.pair}
                             </span>
                             <span className="text-xs px-2 py-0.5 rounded bg-surface-muted text-muted font-medium uppercase">
                               {trade.direction}
                             </span>
                           </div>
                           <p className="text-xs text-muted font-mono">{new Date(trade.exitTime).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           {hasReview ? (
                              <NavLink to={`/trades/${trade.id}/review`} className="flex items-center gap-1.5 px-4 py-2 bg-surface-muted border border-border rounded-lg text-sm font-medium hover:bg-surface-muted/80 transition-colors">
                                View Insight <ArrowUpRight size={14} />
                              </NavLink>
                           ) : (
                              <button 
                                onClick={() => handleGenerateReview(trade.id)}
                                disabled={processingId === trade.id}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                {processingId === trade.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                Generate Review
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

export default AiTradeReviewsPage;
