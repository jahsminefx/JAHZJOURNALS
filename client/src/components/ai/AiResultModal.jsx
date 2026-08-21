import React from 'react';
import { X, Sparkles, CheckCircle2, Clock, XCircle, ArrowUpRight, Brain, Target, Compass, BookOpen, Camera, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const getFeatureIcon = (featureType) => {
  switch (featureType) {
    case 'TRADE_REVIEW': return <Target className="text-rose-400" size={20} />;
    case 'WEEKLY_COACH': return <Compass className="text-emerald-400" size={20} />;
    case 'EDGE_FINDER': return <Sparkles className="text-purple-400" size={20} />;
    case 'TRADING_PLAN': return <BookOpen className="text-amber-400" size={20} />;
    case 'SCREENSHOT_REVIEW': return <Camera className="text-blue-400" size={20} />;
    case 'PSYCHOLOGY_INSIGHTS': return <Brain className="text-pink-400" size={20} />;
    default: return <ShieldCheck className="text-emerald-400" size={20} />;
  }
};

const formatFeatureName = (type) => {
  if (!type) return 'AI Request';
  return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};

const AiResultModal = ({ request, onClose }) => {
  if (!request) return null;

  const output = request.structuredOutput || {};
  const isTradeReview = request.featureType === 'TRADE_REVIEW' || request.tradeId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border bg-surface-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background rounded-xl border border-border shadow-sm">
              {getFeatureIcon(request.featureType)}
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                {formatFeatureName(request.featureType)}
                {request.trade && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {request.trade.pair} • {request.trade.direction}
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted">
                {new Date(request.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-surface-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted/40 border border-border/60">
            <div className="flex items-center gap-2">
              {request.status === 'COMPLETED' ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 size={14} /> Completed
                </span>
              ) : request.status === 'FAILED' ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                  <XCircle size={14} /> Failed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  <Clock size={14} className="animate-pulse" /> Processing
                </span>
              )}
            </div>
            {request.model && (
              <span className="text-[11px] font-mono text-muted bg-background px-2.5 py-1 rounded-md border border-border uppercase">
                {request.model}
              </span>
            )}
          </div>

          {/* Failed Error Message */}
          {request.status === 'FAILED' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
              <strong className="block mb-1 font-bold">Analysis Failed:</strong>
              {request.errorMessage || 'The AI request timed out or encountered an error. Please try generating again.'}
            </div>
          )}

          {/* Structured Output Presentation */}
          {request.status === 'COMPLETED' && (
            <div className="space-y-5">
              {/* Trade Review Breakdown */}
              {(output.strengths || output.weaknesses || output.mistakes || output.actionableAdvice || output.recommendedAction) && (
                <div className="space-y-4">
                  {output.strengths?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 mb-2">Key Strengths</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted">
                        {output.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {(output.weaknesses?.length > 0 || output.mistakes?.length > 0) && (
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-rose-400 mb-2">Areas for Growth / Mistakes</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted">
                        {(output.weaknesses || output.mistakes || []).map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {(output.actionableAdvice || output.recommendedAction) && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 mb-1">Actionable Recommendation</h4>
                      <p className="italic">"{output.actionableAdvice || output.recommendedAction}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Edge Finder Output */}
              {output.candidateEdges?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-purple-400 mb-2">Discovered Edges</h4>
                  {output.candidateEdges.map((edge, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-surface-muted border border-border/80">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-foreground text-sm">{edge.edgeTitle}</span>
                        <span className="text-xs font-bold text-purple-400">Win Rate: {edge.historicalWinRate}%</span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">{edge.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* General Output / Text Breakdown */}
              {typeof output === 'string' && (
                <div className="p-4 rounded-xl bg-surface-muted border border-border text-foreground font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {output}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface-muted/50 flex items-center justify-between">
          {request.tradeId ? (
            <Link
              to={`/trades/${request.tradeId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View Full Trade Detail & Review <ArrowUpRight size={14} />
            </Link>
          ) : (
            <span className="text-xs text-muted">JAHZJOURNALS AI Ledger</span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface border border-border text-foreground text-xs font-bold rounded-xl hover:bg-surface-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiResultModal;
