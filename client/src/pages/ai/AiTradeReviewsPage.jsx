import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Target, Loader2, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiTradeReviewsPage = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchClosedTrades = async () => {
    try {
      const { data } = await api.get('/trades?status=CLOSED');
      const sorted = (data || []).sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));
      setTrades(sorted);
    } catch (err) {
      toast.error('Failed to load recent trades.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosedTrades();
  }, []);

  const pollRequestStatus = async (requestId) => {
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
            reject(new Error(data.errorMessage || 'Trade review analysis failed.'));
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error('Trade review analysis timed out. Please try again.'));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 2000);
    });
  };

  const handleGenerateReview = async (tradeId) => {
    setProcessingId(tradeId);
    try {
      const { data } = await api.post(`/ai/trade-insight/${tradeId}`);
      toast.success('Trade Review generation started...');

      if (data.requestId) {
        await pollRequestStatus(data.requestId);
      }

      toast.success('Trade Review completed!');
      await fetchClosedTrades();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to trigger review');
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
           <div className="bg-surface border border-border rounded-2xl p-12 flex items-center justify-center">
             <Loader2 size={32} className="animate-spin text-rose-400" />
           </div>
        ) : trades.length === 0 ? (
           <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-md">
             <AlertCircle size={32} className="text-muted mx-auto mb-4" />
             <h3 className="text-base font-bold text-foreground mb-1">No closed trades found</h3>
             <p className="text-xs text-muted">You need to log and close a trade before you can run an AI review.</p>
           </div>
        ) : (
           <div className="bg-surface border border-border rounded-2xl shadow-md overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-surface-muted/30">
                 <h2 className="font-bold text-xs uppercase tracking-wider text-foreground">Your Closed Trades</h2>
              </div>
              <div className="divide-y divide-border">
                 {trades.map(trade => {
                    const hasReview = trade.aiReviews?.length > 0;
                    const isProcessing = processingId === trade.id;

                    return (
                      <div key={trade.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/10 transition-colors">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <span className={`font-bold text-sm ${trade.result === 'WIN' ? 'text-emerald-400' : trade.result === 'LOSS' ? 'text-rose-400' : 'text-slate-400'}`}>
                               {trade.pair}
                             </span>
                             <span className="text-xs px-2 py-0.5 rounded bg-surface-muted text-muted font-bold uppercase">
                               {trade.direction}
                             </span>
                             {trade.profitLossAmount != null && (
                               <span className={`text-xs font-mono font-bold ${Number(trade.profitLossAmount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                 ${Number(trade.profitLossAmount).toFixed(2)}
                               </span>
                             )}
                           </div>
                           <p className="text-xs text-muted font-mono">{new Date(trade.exitTime || trade.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           {hasReview ? (
                              <NavLink to={`/trades/${trade.id}`} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 transition-all">
                                View Insight <ArrowUpRight size={14} />
                              </NavLink>
                           ) : (
                              <button 
                                onClick={() => handleGenerateReview(trade.id)}
                                disabled={isProcessing}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                              >
                                {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                {isProcessing ? 'Analyzing...' : 'Generate Review'}
                              </button>
                           )}
                        </div>
                      </div>
                    );
                 })}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AiTradeReviewsPage;
