import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Save, Trash2, Archive, Calendar, Users, Eye, Anchor, Crown, Zap, Activity } from 'lucide-react';
import { format } from 'date-fns';

const PromotionModal = ({ promotionId, onClose, onMutate }) => {
  const [formData, setFormData] = useState({
    name: '', slug: '', description: '', planGranted: 'FREE', category: 'MARKETING',
    isActive: true, startsAt: '', endsAt: '', maxRedemptions: '', requiresInvite: false,
    autoActivate: false, autoExpire: false, revokeBadgeOnExpiry: false
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const isEditing = !!promotionId;
  const [redemptionsCount, setRedemptionsCount] = useState(0);

  useEffect(() => {
    if (isEditing) {
      setLoading(true);
      api.get(`/admin/promotions/${promotionId}`).then(({ data }) => {
        setRedemptionsCount(data.currentRedemptions);
        setFormData({
          name: data.name || '', slug: data.slug || '', description: data.description || '',
          planGranted: data.planGranted || 'FREE', category: data.category || 'MARKETING', isActive: data.isActive,
          startsAt: data.startsAt ? new Date(data.startsAt).toISOString().slice(0,16) : '',
          endsAt: data.endsAt ? new Date(data.endsAt).toISOString().slice(0,16) : '',
          maxRedemptions: data.maxRedemptions || '', requiresInvite: data.requiresInvite,
          autoActivate: data.autoActivate, autoExpire: data.autoExpire, revokeBadgeOnExpiry: data.revokeBadgeOnExpiry
        });
      }).catch(() => {
        toast.error('Failed mapping existing schema hook'); onClose();
      }).finally(() => setLoading(false));
    }
  }, [promotionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        maxRedemptions: formData.maxRedemptions ? parseInt(formData.maxRedemptions) : null,
      };

      if (isEditing) {
        await api.put(`/admin/promotions/${promotionId}`, payload);
        toast.success('Configuration overwritten successfully!');
      } else {
        await api.post('/admin/promotions', payload);
        toast.success('New promotion node active!');
      }
      onMutate();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Structural integrity violation executing payload.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Executing hard deletion on this index point will throw foreign-key anomalies if redemptions exist. If it was redeemed, it will merely archive it instead. Assert intent?')) return;
    try {
       await api.delete(`/admin/promotions/${promotionId}`);
       toast.success('Promotion wiped or archived cleanly.');
       onMutate();
       onClose();
    } catch(err) {
       toast.error('Could not run cleanup process.');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
         <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-r-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="relative flex w-full max-w-4xl flex-col rounded-[24px] bg-surface-elevated border border-border shadow-2xl text-foreground my-8 overflow-hidden">
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between p-6 bg-surface-muted/80 backdrop-blur-xl border-b border-border sticky top-0 z-20">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
               <Anchor className="text-indigo-400" size={20} />
             </div>
             <div>
               <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-emerald-300">Promotion Assembly Unit</h2>
               <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Map variables globally over subscription endpoints.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted bg-surface-muted rounded-full hover:bg-surface-muted/80 hover:text-foreground transition-colors border border-border">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto hide-scrollbar">
          
          {/* Main Identifier Box */}
          <div className="grid sm:grid-cols-2 gap-6 p-6 border border-border rounded-2xl bg-surface-muted/30">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Universal Promotion Title</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-surface-muted border border-border px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-muted text-foreground" placeholder="e.g. Founding Trader Beta Phase 1" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Structural Slug Index</label>
              <input required disabled={isEditing} value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g,'-')})} className="w-full bg-surface-muted border border-border px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 outline-none font-mono disabled:opacity-50 text-foreground transition-all placeholder:text-muted" placeholder="e.g. founding-trader-2026" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Classification Matrix</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="appearance-none w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm font-bold text-gray-300 focus:border-indigo-500/50 outline-none hover:bg-gray-900 transition-all">
                 <option value="LAUNCH">🚀 LAUNCH (Deployment)</option>
                 <option value="REFERRAL">🔗 REFERRAL SYSTEM</option>
                 <option value="BETA">🧪 BETA TESTING</option>
                 <option value="MARKETING">📢 MARKETING</option>
                 <option value="GIFT">🎁 GIFT (Custom)</option>
                 <option value="PARTNERSHIP">🤝 PARTNERSHIP</option>
                 <option value="INTERNAL">👩‍💻 INTERNAL EMPLOYEES</option>
              </select>
            </div>
          </div>

          {/* Allocation Settings */}
          <div className="grid sm:grid-cols-2 gap-6 relative">
            <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full z-0 pointer-events-none" />
            
            <div className="space-y-2 z-10">
              <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><Crown size={14} /> Grant Target Allocation</label>
              <select value={formData.planGranted} onChange={e => setFormData({...formData, planGranted: e.target.value})} className="w-full bg-gray-950 border border-emerald-500/30 px-5 py-3 rounded-xl text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all hover:bg-gray-900/80">
                 <option value="FREE">FREE Base Access</option>
                 <option value="STARTER">STARTER Access</option>
                 <option value="PRO">PRO Premium Access</option>
              </select>
            </div>
             <div className="space-y-2 z-10">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex justify-between">Bounded Redemptions <span className="font-normal italic">(Blank = Infinity)</span></label>
              <input type="number" min="1" value={formData.maxRedemptions} onChange={e => setFormData({...formData, maxRedemptions: e.target.value})} className="w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all placeholder-gray-600" placeholder="e.g. 500 max limit" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 p-6 border border-white/5 rounded-2xl bg-white/[0.02]">
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex gap-2 items-center"><Calendar size={14} className="text-indigo-400"/> Window Trigger [Start]</label>
               <input type="datetime-local" value={formData.startsAt} onChange={e => setFormData({...formData, startsAt: e.target.value})} className="w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 outline-none text-gray-300" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex gap-2 items-center"><Calendar size={14} className="text-amber-400"/> Window Trigger [End]</label>
               <input type="datetime-local" value={formData.endsAt} onChange={e => setFormData({...formData, endsAt: e.target.value})} className="w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 outline-none text-gray-300" />
             </div>
          </div>

          {/* iOS Toggles Style Feature Flags */}
          <div className="space-y-4 pt-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-900 border border-gray-800 px-4 py-2 rounded-full inline-block">Automated Behaviour Flags</h4>
            
            <div className="grid sm:grid-cols-2 gap-4">
               {/* Toggle 1 */}
               <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-gray-900/50 hover:bg-gray-800/80 transition-colors">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-gray-200">Route Activation Gate</div>
                    <div className="text-xs text-gray-500 mt-1">Allows UI ingestion. Required for runtime.</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-700'}`}
                  >
                     <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
               </div>

               {/* Toggle 2 */}
               <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-gray-900/50 hover:bg-gray-800/80 transition-colors">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-gray-200">Strict Invite Gate</div>
                    <div className="text-xs text-gray-500 mt-1">Prevents generic public ingestion completely.</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, requiresInvite: !formData.requiresInvite})}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.requiresInvite ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gray-700'}`}
                  >
                     <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.requiresInvite ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
               </div>

               {/* Toggle 3 */}
               <div className="flex items-center justify-between p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-amber-500">Volatile Auto-Expiration Logic</div>
                    <div className="text-xs text-amber-500/70 mt-1">Subscriptions granted via this automatically revoke natively upon ending.</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, autoExpire: !formData.autoExpire})}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.autoExpire ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gray-700'}`}
                  >
                     <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.autoExpire ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
               </div>

               {/* Toggle 4 */}
               <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-gray-900/50 hover:bg-gray-800/80 transition-colors">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-gray-200">Silent Registration Grants</div>
                    <div className="text-xs text-gray-500 mt-1">Users actively mapping automatically consume this upon signup.</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, autoActivate: !formData.autoActivate})}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.autoActivate ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-700'}`}
                  >
                     <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.autoActivate ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
               </div>
            </div>
          </div>

          {/* Footer Ribbon */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-white/10 pt-6 mt-8">
            <div>
              {isEditing && (
                 <div className="text-xs text-gray-400 font-mono flex items-center gap-2">
                    <Activity size={14} className="text-indigo-400" />
                    <strong className="text-white text-sm">{redemptionsCount}</strong> Universal Redemptions Indexed.
                 </div>
              )}
            </div>
            <div className="flex w-full sm:w-auto gap-3">
              {isEditing && (
                <button type="button" onClick={handleDelete} className="px-5 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl flex items-center justify-center gap-2 font-bold transition md:w-auto flex-1">
                   <Trash2 size={18} /> Wipe Out
                </button>
              )}
              <button disabled={saving} type="submit" className="relative flex-1 md:w-auto group overflow-hidden bg-emerald-500 text-gray-950 px-8 py-3 rounded-xl font-black tracking-wide hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                 <div className="absolute inset-0 w-1/4 h-full bg-white/30 -skew-x-[30deg] -translate-x-[150%] group-hover:translate-x-[400%] transition-transform duration-700 ease-in-out" />
                 <Save size={18} className="relative z-10" /> 
                 <span className="relative z-10">{saving ? 'Injecting Constraints...' : isEditing ? 'Push Configuration Mutation' : 'Establish Generic Endpoint'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default PromotionModal;
