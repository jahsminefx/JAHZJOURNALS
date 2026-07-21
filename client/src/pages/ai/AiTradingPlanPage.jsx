import React, { useState } from 'react';
import { BookOpen, Target, Shield, Zap, Sparkles, Loader2, Save } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AiTradingPlanPage = () => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    strategy: '',
    pairs: '',
    risk: '',
    goals: ''
  });

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.strategy || !form.risk) return toast.error('Strategy and Risk parameters are required');
    
    setLoading(true);
    try {
      await api.post('/ai/trading-plan', form);
      toast.success('Your Trading Plan is being generated! Check the recent activity or your emails.');
      setForm({ strategy: '', pairs: '', risk: '', goals: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit trading plan prompt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
              <BookOpen size={24} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Trading Plan Generator</h1>
          </div>
          <p className="text-muted text-sm">
            Work with JAHZ AI to structure an objective, rule-based trading plan that aligns with your specific style and risk appetite.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl shadow-sm p-6 sm:p-8">
           <form onSubmit={handleGenerate} className="space-y-6">
             
             <div>
               <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                 <Target size={16} className="text-amber-500" /> Trading Strategy / Style
               </label>
               <textarea 
                 required
                 value={form.strategy}
                 onChange={e => setForm({...form, strategy: e.target.value})}
                 placeholder="e.g. ICT Silver Bullet, Support & Resistance, Supply & Demand..."
                 className="w-full bg-surface-muted border border-border rounded-lg p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                 rows={3}
               />
             </div>

             <div>
               <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                 <Zap size={16} className="text-amber-500" /> Pairs / Instruments Traded
               </label>
               <input 
                 type="text"
                 value={form.pairs}
                 onChange={e => setForm({...form, pairs: e.target.value})}
                 placeholder="e.g. EURUSD, GBPJPY, XAUUSD, NAS100..."
                 className="w-full bg-surface-muted border border-border rounded-lg p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
               />
             </div>

             <div>
               <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                 <Shield size={16} className="text-amber-500" /> Risk Management Rules
               </label>
               <textarea 
                 required
                 value={form.risk}
                 onChange={e => setForm({...form, risk: e.target.value})}
                 placeholder="Describe max daily loss, max position size, scaling mechanisms..."
                 className="w-full bg-surface-muted border border-border rounded-lg p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                 rows={3}
               />
             </div>

             <div>
               <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                 <Sparkles size={16} className="text-amber-500" /> Personal Goals / Weaknesses
               </label>
               <textarea 
                 value={form.goals}
                 onChange={e => setForm({...form, goals: e.target.value})}
                 placeholder="e.g. I want to stop overtrading. I struggle with holding too long..."
                 className="w-full bg-surface-muted border border-border rounded-lg p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                 rows={3}
               />
             </div>

             <div className="pt-4 flex justify-end">
               <button 
                 type="submit" 
                 disabled={loading}
                 className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-900/20 font-bold transition-all disabled:opacity-50"
               >
                 {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                 Generate Ultimate Plan
               </button>
             </div>

           </form>
        </div>

      </div>
    </div>
  );
};

export default AiTradingPlanPage;
