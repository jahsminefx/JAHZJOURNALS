import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, ArrowRight, Eye, ExternalLink } from 'lucide-react';
import AiResultModal from './AiResultModal';

const AiRecentActivity = ({ recentRequests, loading }) => {
  const [selectedRequest, setSelectedRequest] = useState(null);

  if (loading) {
    return <div className="animate-pulse h-64 bg-surface-muted rounded-xl border border-border"></div>;
  }

  if (!recentRequests || recentRequests.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-xl">
        <p className="text-muted text-sm">No recent AI activity recorded yet.</p>
      </div>
    );
  }

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'COMPLETED': return <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"><CheckCircle2 size={12}/> Completed</span>;
      case 'QUEUED':
      case 'PROCESSING': return <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded"><Clock size={12} className="animate-pulse"/> Processing</span>;
      case 'FAILED': return <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-1 rounded"><XCircle size={12}/> Failed</span>;
      default: return <span className="text-xs text-muted">{status}</span>;
    }
  };

  const getFeatureName = (type) => {
     if (!type) return 'AI Interaction';
     return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-surface-muted/30">
          <h2 className="text-lg font-bold text-foreground">Recent AI Activity</h2>
          <NavLink to="/ai/history" className="text-sm text-emerald-600 hover:text-emerald-500 font-medium flex items-center gap-1">
            View all <ArrowRight size={16} />
          </NavLink>
        </div>
        <div className="divide-y divide-border">
          {recentRequests.slice(0, 5).map((req) => (
            <div
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-muted/30 transition-colors cursor-pointer group"
            >
              <div>
                <p className="font-semibold text-sm text-foreground mb-1 group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                  {getFeatureName(req.featureType)}
                  {req.trade && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-muted text-emerald-400 border border-border">
                      {req.trade.pair} • {req.trade.direction}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {new Date(req.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {getStatusDisplay(req.status)}

                {req.tradeId ? (
                  <Link
                    to={`/trades/${req.tradeId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-muted hover:text-emerald-400 hover:bg-surface-muted rounded-lg transition-colors"
                    title="Open Trade Detail"
                  >
                    <ExternalLink size={16} />
                  </Link>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRequest(req);
                    }}
                    className="p-1.5 text-muted hover:text-emerald-400 hover:bg-surface-muted rounded-lg transition-colors"
                    title="View AI Insight"
                  >
                    <Eye size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRequest && (
        <AiResultModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  );
};

export default AiRecentActivity;
