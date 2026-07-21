import React, { useState } from 'react';
import { Target, Lightbulb, FileText, CheckCircle2, ChevronRight, ServerCrash } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const TradingPlanBuilder = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ strategy: '', pairs: '', risk: '', goals: '' });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [savingRules, setSavingRules] = useState(false);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await api.post('/ai/trading-plan', formData);
      setPlan(res.data);
      setStep(3);
    } catch (e) {
      toast.error('Failed to generate trading plan.');
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async () => {
    setSavingRules(true);
    try {
      await api.post('/misc/rules/bulk', { rules: plan.rules });
      toast.success('Your golden rules have been imported into your checklist!');
    } catch (e) {
      toast.error('Failed to import rules. They might already exist.');
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-500/20 p-3 rounded-lg"><Target className="text-indigo-400" size={24} /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personal Trading Plan Builder</h1>
          <p className="text-sm text-muted">Generate a world-class trading plan drafted by JAHZ AI based on your profile.</p>
        </div>
      </div>

      {step === 1 && (
        <div className="bg-surface border border-border p-6 rounded-xl animate-in slide-in-from-right-8">
           <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Lightbulb size={20} className="text-amber-500" /> Step 1: Your Edge</h2>
           <div className="space-y-4">
             <div>
               <label className="block text-sm text-foreground mb-1">What is your main trading strategy?</label>
               <input type="text" placeholder="e.g. ICT Silver Bullet, Supply/Demand, Swing Trading" className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:border-indigo-500" value={formData.strategy} onChange={e => setFormData({...formData, strategy: e.target.value})} />
             </div>
             <div>
               <label className="block text-sm text-foreground mb-1">Which pairs do you normally trade?</label>
               <input type="text" placeholder="e.g. EURUSD, XAUUSD" className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:border-indigo-500" value={formData.pairs} onChange={e => setFormData({...formData, pairs: e.target.value})} />
             </div>
             <div className="pt-4 text-right">
                <button onClick={() => setStep(2)} disabled={!formData.strategy || !formData.pairs} className="px-5 py-2.5 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 transition flex items-center gap-2 ml-auto">Next Step <ChevronRight size={18}/></button>
             </div>
           </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-surface border border-border p-6 rounded-xl animate-in slide-in-from-right-8">
           <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Lightbulb size={20} className="text-amber-500" /> Step 2: Risk & Goals</h2>
           <div className="space-y-4">
             <div>
               <label className="block text-sm text-foreground mb-1">What are your rigid risk parameters?</label>
               <input type="text" placeholder="e.g. Risk 1% per trade. Max 2% drawdown per day." className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:border-indigo-500" value={formData.risk} onChange={e => setFormData({...formData, risk: e.target.value})} />
             </div>
             <div>
               <label className="block text-sm text-foreground mb-1">What is your 6-month trading goal?</label>
               <input type="text" placeholder="e.g. Pass a $100k prop firm and get my first payout." className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:border-indigo-500" value={formData.goals} onChange={e => setFormData({...formData, goals: e.target.value})} />
             </div>
             <div className="pt-4 flex justify-between">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 text-muted hover:text-foreground font-semibold">Back</button>
                <button onClick={generatePlan} disabled={loading || !formData.risk} className="px-5 py-2.5 bg-green-500 text-gray-900 rounded-lg font-semibold hover:bg-green-400 disabled:opacity-50 transition flex items-center gap-2 ml-auto">
                  {loading ? 'Consulting JAHZ...' : 'Generate Plan'}
                </button>
             </div>
           </div>
        </div>
      )}

      {step === 3 && plan && (
        <div className="bg-surface border border-border p-8 rounded-xl animate-in fade-in zoom-in">
           <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400"><FileText size={24} /> Your Official Trading Plan</h2>
           </div>
           
           <div className="prose prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-inner bg-background p-6 rounded-lg border border-border">
             {plan.markdownPlan}
           </div>

           <div className="mt-8 border-t border-border pt-6">
             <h3 className="font-bold text-lg mb-4 text-emerald-400">Extracted Golden Rules</h3>
             <ul className="space-y-2 mb-6">
               {plan.rules?.map((rule, idx) => (
                 <li key={idx} className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-border">
                   <CheckCircle2 className="text-green-500 mt-0.5" size={18} />
                   <span className="text-sm font-medium">{rule}</span>
                 </li>
               ))}
             </ul>
             <button onClick={saveRules} disabled={savingRules} className="w-full py-3 bg-indigo-500 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-600 disabled:opacity-50">
               {savingRules ? 'Importing rules...' : 'Import Golden Rules into my Journal Checklist'}
             </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default TradingPlanBuilder;
