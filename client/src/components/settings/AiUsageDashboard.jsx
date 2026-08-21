import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BrainCircuit, Trash2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const featureLabels = {
  TRADE_REVIEW: 'Trade AI Review',
  WEEKLY_COACH: 'Weekly Coach',
  EDGE_FINDER: 'Edge Finder',
  TRADING_PLAN: 'Plan Builder',
  SCREENSHOT_REVIEW: 'Vision AI',
  JOURNAL_ASSISTANT: 'Smart Journal'
};

const AiUsageDashboard = () => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    try {
      const { data } = await api.get('/ai/usage');
      setUsage(data);
    } catch (err) {
      toast.error('Failed to load AI usage.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm("Delete all AiRequest history? This won't refund your limit, but it will erase stored prompt data.")) return;
    try {
       await api.delete('/ai/usage');
       toast.success('AI History Purged.');
       fetchUsage();
    } catch (e) {
       toast.error('Failed to clear history.');
    }
  };

  if (loading) return <div className="text-muted p-4">Loading AI stats...</div>;
  if (!usage) return null;

  const usedPerc = usage.limit === Infinity ? 0 : Math.min(100, (usage.totalCurrentMonth / usage.limit) * 100);
  const chartData = Object.keys(usage.usageByFeature).map(key => ({
    name: featureLabels[key] || key,
    count: usage.usageByFeature[key]
  }));

  return (
    <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-6">
       <div className="flex items-center justify-between border-b border-border pb-4">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
               <BrainCircuit size={20} />
            </div>
            <div>
               <h3 className="text-lg font-bold text-foreground">AI Intelligence Usage</h3>
               <p className="text-xs text-muted">Subscription: <span className="text-purple-400 font-medium">{usage.plan}</span></p>
            </div>
         </div>
         <button onClick={handleClearHistory} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition">
            <Trash2 size={14} /> Clear History
         </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
             <div className="flex justify-between text-sm">
                <span className="text-muted">Monthly Limit</span>
                <span className="font-semibold text-foreground">{usage.totalCurrentMonth} / {usage.limit === Infinity ? 'Unlimited' : usage.limit} actions</span>
             </div>
             
             {usage.limit !== Infinity && (
                <div className="w-full bg-surface-muted h-3 rounded-full overflow-hidden border border-border">
                   <div 
                     className={`h-full transition-all ${usedPerc > 85 ? 'bg-red-500' : usedPerc > 50 ? 'bg-yellow-500' : 'bg-purple-500'}`} 
                     style={{ width: `${usedPerc}%` }}
                   ></div>
                </div>
             )}

             <p className="text-xs text-muted mt-2 border-l-2 border-purple-500/50 pl-2">
                Limits reset on {new Date(usage.resetDate).toLocaleDateString()}. Failed or cancelled requests are not counted. Token cost is subsidized by JAHZJOURNALS.
             </p>
          </div>

          <div className="h-40 bg-surface-muted rounded-lg border border-border p-3">
             <p className="text-xs text-muted mb-2 font-medium">Usage by Feature</p>
             {chartData.length > 0 ? (
               <ResponsiveContainer width="100%" height="80%">
                 <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'rgb(var(--muted-foreground))', fontSize: 11}} width={90}/>
                   <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgb(var(--surface-elevated))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', borderRadius: '8px', fontSize: '12px'}} />
                   <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill="#A855F7" />)}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-xs text-muted">No completed AI actions this month.</div>
             )}
          </div>
       </div>

    </div>
  );
};

export default AiUsageDashboard;
