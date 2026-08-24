import React, { useState } from 'react';
import { Sparkles, BrainCircuit, Activity, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiUsageSummary = ({ overview, loading, onRefresh }) => {
  const [clearing, setClearing] = useState(false);

  if (loading) {
    return <div className="animate-pulse h-32 bg-surface-muted rounded-xl border border-border"></div>;
  }

  if (!overview) return null;

  const { plan, processingCount } = overview;

  const handleCancelStuck = async () => {
    setClearing(true);
    try {
      const { data } = await api.post('/ai/cancel-stalled');
      toast.success(data.message || 'Stuck AI generations cancelled.');
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear stuck generations.');
    } finally {
      setClearing(false);
    }
  };
  
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 text-muted">
            <Activity size={18} />
            <h3 className="text-sm font-medium">Processing</h3>
          </div>
          {processingCount > 0 && (
            <button 
              onClick={handleCancelStuck}
              disabled={clearing}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded transition disabled:opacity-50"
              title="Click to cancel any stuck processing requests"
            >
              <RefreshCw size={10} className={clearing ? 'animate-spin' : ''} />
              Reset
            </button>
          )}
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
         <button 
           onClick={handleCancelStuck}
           disabled={clearing}
           className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
         >
           <RefreshCw size={14} className={clearing ? 'animate-spin' : ''} />
           {clearing ? 'Resetting...' : 'Reset Stuck Generations'}
         </button>
      </div>
    </div>
  );
};

export default AiUsageSummary;
