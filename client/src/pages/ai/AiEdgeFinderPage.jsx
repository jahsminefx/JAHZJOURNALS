import React, { useState } from 'react';
import { Target, BarChart2, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiEdgeFinderPage = () => {
  const [loading, setLoading] = useState(false);
  const [edgeData, setEdgeData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const pollRequestStatus = async (requestId) => {
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max
    
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
            reject(new Error(data.errorMessage || 'Edge Finder generation failed.'));
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error('Edge Finder generation timed out. Please try again.'));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 2000);
    });
  };

  const handleGenerateEdge = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data } = await api.post('/ai/edge-finder');
      
      let finalResult = null;
      if (data.structuredOutput) {
        finalResult = data.structuredOutput;
      } else if (data.requestId) {
        finalResult = await pollRequestStatus(data.requestId);
      } else {
        finalResult = data;
      }

      setEdgeData(finalResult);
      toast.success('Candidate Edges generated successfully!');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to generate edge finder insights.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-16 bg-background font-sans text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg">
                <Target size={24} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">JAHZ Edge Finder</h1>
            </div>
            <p className="text-muted text-sm max-w-2xl">
              Analyzes your historical trades focusing on win rate, profit factor, risk-reward, and optimal sessions to surface your most profitable "Candidate Edges."
            </p>
          </div>
          <button 
            onClick={handleGenerateEdge}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-900/20 font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? 'Analyzing Trades...' : 'Generate Candidate Edges'}
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <div className="bg-surface border border-border rounded-2xl p-12 flex flex-col items-center justify-center min-h-[350px] shadow-xl">
            <Loader2 size={40} className="text-purple-400 animate-spin mb-4" />
            <h3 className="text-base font-bold text-foreground">Evaluating Performance Metrics...</h3>
            <p className="text-muted text-xs text-center max-w-md mt-1.5 leading-relaxed">
              JAHZ AI is processing your closed trades across pairs, sessions, and setups to cross-reference statistically significant edge combinations.
            </p>
          </div>
        ) : edgeData ? (
          <div className="space-y-6">
            
            {/* Primary Edge Summary Banner */}
            <div className="bg-surface p-6 rounded-2xl border border-purple-500/40 shadow-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-400 tracking-wider">
                <CheckCircle2 size={16} />
                {edgeData.title || 'Primary Edge Profile'}
              </div>
              <p className="text-sm font-semibold text-foreground leading-relaxed">
                {edgeData.executiveSummary || edgeData.summary || 'Analytical edge summary generated.'}
              </p>
            </div>

            {/* Top Candidate Edge */}
            {edgeData.topEdgeTitle && (
              <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BarChart2 size={18} className="text-purple-400" />
                    {edgeData.topEdgeTitle}
                  </h3>
                  <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full font-bold">
                    Primary Edge
                  </span>
                </div>

                <p className="text-xs text-muted leading-relaxed">
                  {edgeData.topEdgeExplanation}
                </p>

                {edgeData.topEdgeActionableSteps && edgeData.topEdgeActionableSteps.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Actionable Execution Steps:</span>
                    <ul className="space-y-1.5 text-xs text-muted">
                      {edgeData.topEdgeActionableSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Secondary Candidate Edge */}
            {edgeData.secondaryEdgeTitle && (
              <div className="bg-surface p-6 rounded-2xl border border-border shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <BarChart2 size={18} className="text-sky-400" />
                  {edgeData.secondaryEdgeTitle}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {edgeData.secondaryEdgeExplanation}
                </p>
              </div>
            )}

            {/* Disclaimer */}
            {edgeData.disclaimer && (
              <p className="text-[11px] text-muted text-center italic">
                {edgeData.disclaimer}
              </p>
            )}

          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-xl">
            <div className="w-14 h-14 bg-surface-muted rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-400">
              <Target size={28} />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No Candidate Edges Generated Yet</h3>
            <p className="text-muted max-w-sm mx-auto text-xs leading-relaxed mb-6">
              Click "Generate Candidate Edges" to run the deterministic psychometric engine across your closed trades.
            </p>
            <button 
              onClick={handleGenerateEdge}
              disabled={loading}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all"
            >
              Generate Candidate Edges
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AiEdgeFinderPage;
