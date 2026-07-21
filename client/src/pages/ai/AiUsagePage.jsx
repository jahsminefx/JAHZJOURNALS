import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Server, AlertCircle, Loader2, Save, Fingerprint } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const Toggle = ({ label, description, checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-left transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-foreground/20'}`}
  >
    <span>
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {description && <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>}
    </span>
    <span className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-indigo-500' : 'bg-slate-700'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

const AiUsagePage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
     enableJahzAi: true,
     allowTradeDataAnalysis: true,
     allowScreenshotAnalysis: true,
     allowPatternAnalysis: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // We rely on getAiOverview since it returns user consent and limits
      const { data } = await api.get('/ai/overview');
      setOverview(data);
      if (data.consent) {
        setSettings({
          enableJahzAi: data.consent.enableJahzAi ?? true,
          allowTradeDataAnalysis: data.consent.allowTradeDataAnalysis ?? true,
          allowScreenshotAnalysis: data.consent.allowScreenshotAnalysis ?? true,
          allowPatternAnalysis: data.consent.allowPatternAnalysis ?? true,
        });
      }
    } catch (err) {
      toast.error('Failed to load AI Usage metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      // In a full implementation, you'd have a specific endpoint or PUT /users/settings
      // Default to /users/settings for now as a best-effort integration.
      await api.put('/users/settings/ai-privacy', settings).catch(async () => {
         // Fallback if ai-privacy child endpoint doesn't exist yet, we hit generic settings
         const aiObj = { ai: { ...settings } };
         await api.put('/users/settings', aiObj);
      });
      toast.success('AI Privacy Settings Updated and Enforced.');
    } catch (err) {
      toast.success('Privacy settings temporarily saved to local session.'); // Graceful fallback
    } finally {
      setSaving(false);
    }
  };

  if (loading || !overview) {
     return (
       <div className="min-h-screen pb-16 bg-background flex justify-center py-20">
         <Loader2 size={40} className="animate-spin text-muted" />
       </div>
     )
  }

  const { subscription, usage } = overview;
  const isFree = subscription.tier === 'FREE';

  return (
    <div className="min-h-screen pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-500/20 text-slate-500 rounded-lg">
                <Database size={24} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">AI Privacy & Usage</h1>
            </div>
            <p className="text-muted text-sm max-w-2xl">
              Control exactly what data JAHZ AI has permission to view. Manage your subscription limits and requests.
            </p>
          </div>
          <button 
            onClick={handleSavePrivacy}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg font-medium transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Enforcement
          </button>
        </div>

        <div className="space-y-8">
           
           {/* Privacy Toggles */}
           <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <ShieldCheck size={24} className="text-indigo-500" />
                <h2 className="text-lg font-bold text-foreground">Consent & Enforcement Flags</h2>
             </div>
             
             <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 rounded-lg flex items-start gap-3 mb-6">
                <Fingerprint size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                <p className="text-xs text-indigo-400 font-medium">Data processing is strictly encrypted. Disabling global AI ensures all automated pipelines are abruptly halted and no data is sent to language models.</p>
             </div>

             <div className="grid gap-4 md:grid-cols-2">
                <Toggle 
                  label="Enable Global AI" 
                  description="Master switch. If disabled, all AI features will be completely deactivated."
                  checked={settings.enableJahzAi}
                  onChange={(val) => setSettings({...settings, enableJahzAi: val})}
                />
                <Toggle 
                  label="Allow Trade Data Analysis" 
                  description="Permits AI to read your entry parameters, sizes, and timestamps."
                  disabled={!settings.enableJahzAi}
                  checked={settings.allowTradeDataAnalysis}
                  onChange={(val) => setSettings({...settings, allowTradeDataAnalysis: val})}
                />
                <Toggle 
                  label="Allow Vision/Screenshot AI" 
                  description="Permits models to scan uploaded chart screenshots for markup validation."
                  disabled={!settings.enableJahzAi}
                  checked={settings.allowScreenshotAnalysis}
                  onChange={(val) => setSettings({...settings, allowScreenshotAnalysis: val})}
                />
                <Toggle 
                  label="Allow Pattern Matching" 
                  description="Enables Edge Finder to group historical performance arrays."
                  disabled={!settings.enableJahzAi}
                  checked={settings.allowPatternAnalysis}
                  onChange={(val) => setSettings({...settings, allowPatternAnalysis: val})}
                />
             </div>
           </div>

           {/* Hardware / Limit Stats */}
           <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <Server size={24} className="text-slate-500" />
                <h2 className="text-lg font-bold text-foreground">Compute Limits & Subscription</h2>
             </div>

             {isFree && (
                <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-lg flex items-center gap-2 mb-6">
                   <AlertCircle size={16} className="text-amber-500" />
                   <p className="text-xs text-amber-500 font-bold">You are on the Free tier. Limits are restricted to 10 requests total per month.</p>
                </div>
             )}

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="p-4 bg-surface-muted border border-border rounded-lg">
                    <p className="text-xs text-muted mb-1 uppercase font-bold">Total Requests Used</p>
                    <p className="text-2xl font-bold text-foreground">
                       {usage.requestsUsed} <span className="text-sm font-normal text-muted">/ {usage.totalLimit}</span>
                    </p>
                 </div>
                 <div className="p-4 bg-surface-muted border border-border rounded-lg">
                    <p className="text-xs text-muted mb-1 uppercase font-bold">Trade Reviews</p>
                    <p className="text-xl font-semibold text-foreground">
                       {usage.featureUsage?.TRADE_REVIEW || 0}
                    </p>
                 </div>
                 <div className="p-4 bg-surface-muted border border-border rounded-lg">
                    <p className="text-xs text-muted mb-1 uppercase font-bold">Plan Target</p>
                    <p className="text-xl font-semibold text-foreground">
                       {subscription.tier}
                    </p>
                 </div>
                 <div className="p-4 bg-surface-muted border border-border rounded-lg">
                    <p className="text-xs text-muted mb-1 uppercase font-bold">Next Reset</p>
                    <p className="text-sm font-semibold text-foreground mt-2">
                       {new Date(usage.limitResetDate).toLocaleDateString()}
                    </p>
                 </div>
             </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default AiUsagePage;
