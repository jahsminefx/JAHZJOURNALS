import React, { useState, useEffect } from 'react';
import { Target, Zap, Rocket, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const EdgeFinderWidget = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState(null);

  useEffect(() => {
    let interval;
    if (polling && activeRequestId) {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/ai/requests/${activeRequestId}`);
          const aiReq = res.data;
          
          if (aiReq.status === 'COMPLETED') {
            setPolling(false);
            if (aiReq.structuredOutput && typeof aiReq.structuredOutput === 'string') {
              setReport(JSON.parse(aiReq.structuredOutput));
            } else if (aiReq.structuredOutput) {
              setReport(aiReq.structuredOutput);
            }
          } else if (aiReq.status === 'FAILED') {
            setPolling(false);
            setError(aiReq.errorMessage || 'Failed to generate edge report.');
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000); // poll every 5s
    }
    return () => clearInterval(interval);
  }, [polling, activeRequestId]);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/ai/edge-finder');
      setActiveRequestId(res.data.requestId);
      setPolling(true);
    } catch (e) {
      const msg = e.response?.data?.message || 'Error creating edge finder request.';
      if (msg.includes('already running')) {
         // Optionally fetch existing
      } else {
         setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-muted p-6 rounded-xl border border-border mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="text-amber-400" size={24} />
            JAHZ Edge Finder
          </h2>
          <p className="text-sm text-muted mt-1">Deterministically scanning your entire history for statistical advantages.</p>
        </div>
        {!report && !polling && (
          <button 
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 rounded-lg font-bold shadow-md transition disabled:opacity-70"
          >
            {loading ? 'Initializing...' : <><Target size={16} /> Find My Edge</>}
          </button>
        )}
      </div>

      {polling && (
        <div className="py-8 text-center bg-surface rounded-lg border border-border border-dashed">
          <div className="animate-spin text-amber-500 mx-auto mb-4"><Zap size={32} /></div>
          <p className="text-foreground font-medium">Crunching combinations...</p>
          <p className="text-sm text-muted mt-2">Checking overlapping attributes across all trades. Please hold.</p>
        </div>
      )}

      {error && !polling && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-500">Edge Analysis Failed</p>
            <p className="text-sm text-red-400/90">{error}</p>
            <button onClick={generateReport} className="mt-2 text-sm text-red-500 underline">Try Again</button>
          </div>
        </div>
      )}

      {report && !polling && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="bg-surface p-5 rounded-lg border border-border">
            <h3 className="text-lg font-bold text-emerald-400">{report.title}</h3>
            <p className="text-sm text-foreground mt-2">{report.executiveSummary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 p-5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="text-amber-500" size={20} />
                <h4 className="font-bold text-amber-500">Primary Candidate Edge</h4>
              </div>
              <p className="font-semibold text-foreground">{report.topEdgeTitle}</p>
              <p className="text-sm text-muted mt-2">{report.topEdgeExplanation}</p>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-muted uppercase">Actionable Focus:</p>
                {report.topEdgeActionableSteps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="text-green-500 mt-0.5 flex-shrink-0" size={16} />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {report.secondaryEdgeTitle && (
              <div className="bg-surface p-5 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="text-blue-400" size={20} />
                  <h4 className="font-bold text-blue-400">Secondary Candidate Edge</h4>
                </div>
                <p className="font-semibold text-foreground">{report.secondaryEdgeTitle}</p>
                <p className="text-sm text-muted mt-2">{report.secondaryEdgeExplanation}</p>
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-2 text-xs text-muted bg-surface/50 p-3 rounded border border-border">
             <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
             <p>{report.disclaimer || "Statistical edges are candidates based on past occurrence. They do not guarantee future success. Always adhere strictly to risk management parameterings."}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EdgeFinderWidget;
