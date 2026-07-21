import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

import AiOverviewHeader from '../../components/ai/AiOverviewHeader';
import AiUsageSummary from '../../components/ai/AiUsageSummary';
import AiQuickActions from '../../components/ai/AiQuickActions';
import AiRecentActivity from '../../components/ai/AiRecentActivity';

const AiHubPage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchOverview();
  }, []);

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
                <h2 className="text-lg font-bold text-foreground mb-4">Pending Trade Reviews</h2>
                {loading ? (
                   <div className="animate-pulse h-24 bg-surface-muted rounded-lg"></div>
                ) : overview?.reviewableTrades?.length > 0 ? (
                   <div className="space-y-3">
                     {overview.reviewableTrades.map(trade => (
                       <div key={trade.id} className="p-3 bg-surface-muted/30 rounded-lg flex justify-between items-center border border-border/50">
                         <div>
                            <p className="font-semibold text-sm">{trade.pair} • {trade.direction}</p>
                            <p className="text-xs text-muted">{new Date(trade.exitTime).toLocaleDateString()}</p>
                         </div>
                         <button className="text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 px-3 py-1.5 rounded font-medium transition-colors">
                            Generate
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
