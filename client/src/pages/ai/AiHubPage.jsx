import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

import AiOverviewHeader from '../../components/ai/AiOverviewHeader';
import AiUsageSummary from '../../components/ai/AiUsageSummary';
import AiQuickActions from '../../components/ai/AiQuickActions';
import AiRecentActivity from '../../components/ai/AiRecentActivity';
import { Loader2, Sparkles } from 'lucide-react';

const AiHubPage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingTradeId, setProcessingTradeId] = useState(null);
  const navigate = useNavigate();

  const fetchOverview = async () => {
    try {
      const { data } = await api.get('/ai/overview');
      setOverview(data);
    } catch (error) {
      toast.error('Failed to load AI overview details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleGenerateTradeReview = (tradeId) => {
    navigate('/ai/trade-reviews');
  };

  return (
    <div className="relative min-h-screen pb-16 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AiOverviewHeader />
        
        <AiUsageSummary overview={overview} loading={loading} />
        
        <AiQuickActions />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2">
             <AiRecentActivity recentRequests={overview?.recentRequests} loading={loading} />
           </div>
           <div>
             {/* Reviewable Trades Queue Area */}
             <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground">Pending Trade Reviews</h2>
                  <button
                    onClick={() => navigate('/ai/trade-reviews')}
                    className="text-xs font-bold text-emerald-400 hover:underline"
                  >
                    View All
                  </button>
                </div>

                {loading ? (
                   <div className="animate-pulse h-24 bg-surface-muted rounded-lg"></div>
                ) : overview?.reviewableTrades?.length > 0 ? (
                   <div className="space-y-3">
                     {overview.reviewableTrades.map(trade => (
                       <div key={trade.id} className="p-3 bg-surface-muted/30 rounded-lg flex justify-between items-center border border-border/50">
                         <div>
                            <p className="font-semibold text-sm text-foreground">{trade.pair} • {trade.direction}</p>
                            <p className="text-xs text-muted font-mono">{new Date(trade.exitTime || trade.createdAt).toLocaleDateString()}</p>
                         </div>
                         <button
                           onClick={() => handleGenerateTradeReview(trade.id)}
                           className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5"
                         >
                            <Sparkles size={13} /> Generate
                         </button>
                       </div>
                     ))}
                   </div>
                ) : (
                   <p className="text-sm text-muted">All closed trades have been reviewed! Excellent discipline.</p>
                )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AiHubPage;
