import React, { useState, useEffect } from 'react';
import { History, Search, Loader2, Calendar, FileText, CheckCircle2, Clock, XCircle, Trash2, Eye, ExternalLink, Filter } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import AiResultModal from '../../components/ai/AiResultModal';

const AiHistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
      case 'COMPLETED': return <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"><CheckCircle2 size={12}/> Completed</span>;
      case 'QUEUED':
      case 'PROCESSING': return <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20"><Clock size={12} className="animate-pulse"/> Processing</span>;
      case 'FAILED': return <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20"><XCircle size={12}/> Failed</span>;
      default: return <span className="text-xs text-muted">{status}</span>;
    }
  };

  const formatFeatureName = (str) => {
    if (!str) return 'Unknown Feature';
    return str.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  // Filtered history list
  const filteredHistory = history.filter((req) => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const matchesSearch = !searchTerm || 
      formatFeatureName(req.featureType).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.trade?.pair && req.trade.pair.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-sm">
                <History size={24} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">AI Request History</h1>
            </div>
            <p className="text-muted text-sm max-w-2xl">
              Track your complete engagement with JAHZ AI. Click any request to inspect the generated breakdown.
            </p>
          </div>

          <button 
            onClick={handleClearHistory}
            disabled={clearing || loading || history.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-rose-500/40 hover:bg-rose-500/10 text-rose-400 rounded-xl font-bold text-xs transition-all disabled:opacity-50 shadow-sm"
          >
            {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Clear History
          </button>
        </div>

        {/* Filter Controls */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search features or pairs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface text-xs text-foreground outline-none transition focus:border-emerald-400"
            />
            <Search size={16} className="absolute left-3 top-3 text-muted pointer-events-none" />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'COMPLETED', 'PROCESSING', 'FAILED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === status
                    ? 'bg-emerald-400 text-gray-950 shadow-md shadow-emerald-500/20'
                    : 'bg-surface border border-border text-muted hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="bg-surface border border-border rounded-2xl p-12 flex justify-center shadow-md">
            <Loader2 size={32} className="animate-spin text-emerald-400" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-md">
            <FileText size={48} className="text-muted/40 mx-auto mb-4" />
            <h3 className="text-base font-bold text-foreground mb-1">No AI History Found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL'
                ? 'No AI requests matched your search or status filter.'
                : 'You have no recorded AI interactions or they were recently cleared.'}
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-md">
            <div className="divide-y divide-border">
              {filteredHistory.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/30 transition-colors cursor-pointer group"
                >
                  <div>
                    <p className="font-semibold text-foreground text-sm group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                      {formatFeatureName(req.featureType)}
                      {req.trade && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {req.trade.pair} • {req.trade.direction}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted font-mono">
                        <Calendar size={12} /> {new Date(req.createdAt).toLocaleString()}
                      </span>
                      {req.model && (
                        <span className="text-[10px] text-muted border border-border px-1.5 py-0.5 rounded uppercase font-mono">
                          {req.model}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {getStatusDisplay(req.status)}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(req);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-surface-muted border border-border hover:border-emerald-500/40 text-xs font-bold text-foreground rounded-lg transition-all"
                    >
                      <Eye size={14} /> View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Result Inspection Modal */}
      {selectedRequest && (
        <AiResultModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
};

export default AiHistoryPage;
