import React, { useState, useEffect } from 'react';
import { History, Search, Loader2, Calendar, FileText, CheckCircle2, Clock, XCircle, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiHistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/ai/usage');
      setHistory(data.requests || []);
    } catch (err) {
      toast.error('Failed to load AI activity history.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your AI generation history?')) return;
    setClearing(true);
    try {
      await api.delete('/ai/usage');
      setHistory([]);
      toast.success('AI History permanently cleared.');
    } catch (err) {
      toast.error('Failed to clear AI history.');
    } finally {
      setClearing(false);
    }
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'COMPLETED': return <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"><CheckCircle2 size={12}/> Completed</span>;
      case 'QUEUED':
      case 'PROCESSING': return <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded"><Clock size={12} className="animate-pulse"/> Processing</span>;
      case 'FAILED': return <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-1 rounded"><XCircle size={12}/> Failed</span>;
      default: return <span className="text-xs text-muted">{status}</span>;
    }
  };

  const formatFeatureName = (str) => {
    if (!str) return 'Unknown Feature';
    return str.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div className="min-h-screen pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-500/20 text-slate-500 rounded-lg">
                <History size={24} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">AI Request History</h1>
            </div>
            <p className="text-muted text-sm max-w-2xl">
              Track your complete engagement with JAHZ AI. You have absolute control over your tracking data.
            </p>
          </div>
          <button 
            onClick={handleClearHistory}
            disabled={clearing || loading || history.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-rose-500/50 hover:bg-rose-500/10 text-rose-500 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {clearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            Clear History
          </button>
        </div>

        {loading ? (
           <div className="bg-surface border border-border rounded-xl p-12 flex justify-center">
             <Loader2 size={32} className="animate-spin text-muted" />
           </div>
        ) : history.length === 0 ? (
           <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-sm">
             <FileText size={48} className="text-muted mx-auto mb-4" />
             <h3 className="text-lg font-bold text-foreground mb-2">No History Found</h3>
             <p className="text-sm text-muted">You have no recorded AI interactions or they were recently cleared.</p>
           </div>
        ) : (
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="divide-y divide-border">
                 {history.map(req => (
                   <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/30 transition-colors">
                     <div>
                        <p className="font-semibold text-foreground flex items-center gap-2">
                           {formatFeatureName(req.featureType)} 
                           {req.tradeId && <span className="text-xs bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded ml-2">Linked to Trade</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                           <span className="flex items-center gap-1 text-xs text-muted font-mono"><Calendar size={12} /> {new Date(req.createdAt).toLocaleString()}</span>
                           {req.model && <span className="text-[10px] text-muted border border-border px-1.5 rounded uppercase">{req.model}</span>}
                        </div>
                     </div>
                     <div className="flex flex-col sm:items-end gap-1.5">
                        {getStatusDisplay(req.status)}
                        {req.estimatedCost && <span className="text-[10px] text-muted font-mono tracking-wider ml-auto">Cost: ${parseFloat(req.estimatedCost).toFixed(4)}</span>}
                     </div>
                   </div>
                 ))}
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default AiHistoryPage;
