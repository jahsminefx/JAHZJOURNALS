import React, { useState } from 'react';
import { BrainCircuit, Activity, HeartPulse, Focus, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const AiPsychologyPage = () => {
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const generateProfile = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setHasProfile(true);
      toast.success('Psychological profile generated!');
    }, 2500);
  };

  return (
    <div className="min-h-screen pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-indigo-500/20 text-indigo-500 rounded-lg">
                 <BrainCircuit size={24} />
               </div>
               <h1 className="text-2xl font-bold text-foreground">Psychology & Discipline</h1>
             </div>
             <p className="text-muted text-sm max-w-2xl">
               Uncover behavioral patterns that destroy your edge. JAHZ AI correlates your emotion logs, rule violations, and trade outcomes.
             </p>
           </div>
           
           {!hasProfile && (
             <button 
               onClick={generateProfile}
               disabled={loading}
               className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-900/20 font-medium transition-all disabled:opacity-50"
             >
               {loading ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
               Analyze My Behavior
             </button>
           )}
        </div>

        {loading ? (
             <div className="bg-surface border border-border rounded-xl p-16 flex flex-col items-center justify-center min-h-[400px]">
               <Activity size={48} className="text-indigo-500 animate-pulse mb-6" />
               <h3 className="text-lg font-bold text-foreground">Mapping Emotional Triggers...</h3>
               <p className="text-muted text-sm text-center max-w-md mt-2">
                 Analyzing emotion logs, trade durations, risk deviations, and rule violations to build your psychological profile.
               </p>
             </div>
        ) : !hasProfile ? (
             <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-sm">
               <HeartPulse size={48} className="text-muted mx-auto mb-6" />
               <h3 className="text-lg font-bold text-foreground mb-3">No Profile Generated Yet</h3>
               <p className="text-sm text-muted max-w-md mx-auto">
                 Click the button above to let JAHZ AI synthesize your entire emotion and rule violation history into actionable psychological adjustments.
               </p>
             </div>
        ) : (
             <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5">
                      <h4 className="text-sm font-semibold text-indigo-500 mb-1">Tilt Vulnerability</h4>
                      <p className="text-2xl font-bold text-foreground">High</p>
                      <p className="text-xs text-muted mt-2">Triggered mainly after 2 consecutive losses</p>
                   </div>
                   <div className="bg-surface border border-border rounded-xl p-5">
                      <h4 className="text-sm font-semibold text-muted mb-1">Dominant Emotion</h4>
                      <p className="text-2xl font-bold text-amber-500">FOMO</p>
                      <p className="text-xs text-muted mt-2">Correlates with 65% of your losing trades</p>
                   </div>
                   <div className="bg-surface border border-border rounded-xl p-5">
                      <h4 className="text-sm font-semibold text-muted mb-1">Discipline Score</h4>
                      <p className="text-2xl font-bold text-emerald-500">82 / 100</p>
                      <p className="text-xs text-muted mt-2">Improving trend over the last 30 days</p>
                   </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                   <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                     <AlertCircle size={18} className="text-rose-500" /> Behavioral Leaks
                   </h3>
                   <div className="space-y-4">
                      <div className="p-4 bg-surface-muted rounded-lg border border-border">
                         <h4 className="font-semibold text-foreground mb-1">Premature Exits on Winners</h4>
                         <p className="text-sm text-muted mb-2">You frequently close winning trades early when logging "Anxious" as your emotion. This reduces your average risk/reward ratio by 0.6R.</p>
                         <p className="text-xs font-bold text-indigo-400">JAHZ Coach Action: Use automated trailing stops to remove emotional management.</p>
                      </div>
                      <div className="p-4 bg-surface-muted rounded-lg border border-border">
                         <h4 className="font-semibold text-foreground mb-1">Revenge Trading Frequency</h4>
                         <p className="text-sm text-muted mb-2">You have a pattern of taking 2-3 extra trades immediately following a Stop Loss hit during the New York session.</p>
                         <p className="text-xs font-bold text-indigo-400">JAHZ Coach Action: Implement a "Walk Away" rule. Shut down the terminal for 2 hours after a loss.</p>
                      </div>
                   </div>
                </div>
             </div>
        )}

      </div>
    </div>
  );
};

export default AiPsychologyPage;
