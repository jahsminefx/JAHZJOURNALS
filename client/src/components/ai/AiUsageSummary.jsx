import React from 'react';
import { Sparkles, BrainCircuit, Activity, Lock, CheckCircle2 } from 'lucide-react';

const AiUsageSummary = ({ overview, loading }) => {
  if (loading) {
    return <div className="animate-pulse h-32 bg-surface-muted rounded-xl border border-border"></div>;
  }

  if (!overview) return null;

  const { plan, processingCount } = overview;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="p-5 bg-surface border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-3 text-muted mb-2">
          <Sparkles size={18} />
          <h3 className="text-sm font-medium">Plan Level</h3>
        </div>
        <p className="text-2xl font-bold text-foreground capitalize">{plan.toLowerCase()}</p>
        <p className="text-xs text-muted mt-1">Upgrade for more limits</p>
      </div>

      <div className="p-5 bg-surface border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-3 text-muted mb-2">
          <Activity size={18} />
          <h3 className="text-sm font-medium">Processing</h3>
        </div>
        <p className="text-2xl font-bold text-foreground">{processingCount}</p>
        <p className="text-xs text-muted mt-1">Active requests</p>
      </div>

      <div className="p-5 bg-surface border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-3 text-muted mb-2">
          <BrainCircuit size={18} />
          <h3 className="text-sm font-medium">Reset Date</h3>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {new Date(overview.resetDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </p>
        <p className="text-xs text-muted mt-1">When limits refresh</p>
      </div>

      <div className="p-5 bg-surface border border-border rounded-xl shadow-sm flex flex-col justify-center">
         <button className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg transition-colors text-sm">
           View Full Usage & Limits
         </button>
      </div>
    </div>
  );
};

export default AiUsageSummary;
