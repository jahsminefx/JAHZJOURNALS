import React, { useState } from 'react';
import { Target, BarChart2, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiEdgeFinderPage = () => {
  const [loading, setLoading] = useState(false);
  const [edgeData, setEdgeData] = useState(null);

  const handleGenerateEdge = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/ai/edge-finder');
      setEdgeData(data);
      toast.success('Candidate Edges generated completely!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate edge finder insights. Ensure you have enough closed trades.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg">
                <Target size={24} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Edge Finder</h1>
            </div>
            <p className="text-muted text-sm max-w-2xl">
              Analyzes your historical trades focusing on win rate, profit factor, risk-reward, and optimal sessions to surface your most profitable "Candidate Edges."
            </p>
          </div>
          <button 
            onClick={handleGenerateEdge}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg shadow-purple-900/20 font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Generate New Edges
          </button>
        </div>

        {/* Content area */}
        {loading ? (
          <div className="bg-surface border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-foreground">Analyzing Your Data...</h3>
            <p className="text-muted text-sm text-center max-w-md mt-2">
              JAHZ AI is reviewing thousands of data points across your trading accounts to cross-reference optimal conditions.
            </p>
          </div>
        ) : edgeData ? (
          <div className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 mb-8">
               <h3 className="text-emerald-500 font-bold mb-1 flex items-center gap-2"><Target size={18}/> Primary Edge Profile</h3>
               <p className="text-sm text-foreground/80">{edgeData.summary || 'Summary unavailable'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(edgeData.candidateEdges || []).map((edge, idx) => (
                <div key={idx} className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-purple-500/30 transition-colors">
                   <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        <BarChart2 size={16} className="text-purple-400" />
                        {edge.name || `Candidate Edge ${idx + 1}`}
                      </h4>
                      <span className="text-xs bg-surface-muted px-2 py-1 rounded text-muted font-mono">{edge.winRate || '0'}% WR</span>
                   </div>
                   <p className="text-sm text-muted mb-4">{edge.description}</p>
                   
                   <div className="space-y-2">
                      <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Optimal Conditions</h5>
                      <ul className="text-sm text-muted space-y-1">
                        {(edge.conditions || []).map((cond, cIdx) => (
                          <li key={cIdx} className="flex gap-2 items-start">
                             <span className="text-purple-400 mt-0.5">•</span>
                             <span>{cond}</span>
                          </li>
                        ))}
                      </ul>
                   </div>
                </div>
              ))}
            </div>
            
            {edgeData.warnings && edgeData.warnings.length > 0 && (
              <div className="bg-surface-muted/50 border border-border p-5 rounded-xl">
                 <h4 className="text-sm font-bold text-foreground mb-2">Insufficient Data / Warnings</h4>
                 <ul className="text-sm text-muted space-y-1">
                   {edgeData.warnings.map((w, wIdx) => <li key={wIdx}>- {w}</li>)}
                 </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Target size={28} className="text-muted" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No Edges Found</h3>
            <p className="text-muted max-w-sm mx-auto text-sm">
              You haven't generated any Edge Finder insights recently. Click "Generate New Edges" to run the analysis engine against your historical trade data.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default AiEdgeFinderPage;
