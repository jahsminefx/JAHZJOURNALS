import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Save, Trash2, Archive, Calendar, Users, Eye, Anchor, Crown, Zap, Activity } from 'lucide-react';
import { format } from 'date-fns';

const PromotionModal = ({ promotionId, onClose, onMutate }) => {
  const [formData, setFormData] = useState({
    name: '', slug: '', description: '', planGranted: 'STARTER', applicablePlans: ['STARTER', 'PRO'], category: 'MARKETING',
    discountType: 'PERCENTAGE_DISCOUNT', discountPercent: '50',
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
        const plansList = data.applicablePlans && data.applicablePlans.length > 0 ? data.applicablePlans : [data.planGranted || 'FREE'];
        setFormData({
          name: data.name || '', slug: data.slug || '', description: data.description || '',
          planGranted: data.planGranted || 'FREE',
          applicablePlans: plansList,
          category: data.category || 'MARKETING', isActive: data.isActive,
          discountType: data.discountType || (data.discountPercent ? 'PERCENTAGE_DISCOUNT' : 'FULL_GRANT'),
          discountPercent: data.discountPercent !== null && data.discountPercent !== undefined ? data.discountPercent : '',
          startsAt: data.startsAt ? new Date(data.startsAt).toISOString().slice(0,16) : '',
          endsAt: data.endsAt ? new Date(data.endsAt).toISOString().slice(0,16) : '',
          maxRedemptions: data.maxRedemptions || '', requiresInvite: data.requiresInvite,
          autoActivate: data.autoActivate, autoExpire: data.autoExpire, revokeBadgeOnExpiry: data.revokeBadgeOnExpiry
        });
      }).catch(() => {
        toast.error('Failed to load promotion details'); onClose();
      }).finally(() => setLoading(false));
    }
  }, [promotionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...formData,
        applicablePlans: formData.applicablePlans && formData.applicablePlans.length > 0 ? formData.applicablePlans : ['STARTER'],
        maxRedemptions: formData.maxRedemptions ? parseInt(formData.maxRedemptions) : null,
        discountPercent: formData.discountPercent !== '' ? parseInt(formData.discountPercent) : null,
      };

      if (isEditing) {
        await api.put(`/admin/promotions/${promotionId}`, payload);
        toast.success('Promotion updated successfully!');
      } else {
        await api.post('/admin/promotions', payload);
        toast.success('Promotion created successfully!');
      }
      onMutate();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save promotion. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this promotion? If traders have already used it, it will be safely archived instead of deleted.')) return;
    try {
       await api.delete(`/admin/promotions/${promotionId}`);
       toast.success('Promotion deleted or archived successfully.');
       onMutate();
       onClose();
    } catch(err) {
       toast.error('Could not delete promotion.');
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
               <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-emerald-300">
                 {isEditing ? 'Edit Promotion' : 'Create New Promotion'}
               </h2>
               <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">
                 Set up discounts or free plan access for your traders.
               </p>
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
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Promotion Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-surface-muted border border-border px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-muted text-foreground" placeholder="e.g. 50% Off Starter & Pro - Launch Special" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Promo Code (Slug)</label>
              <input required disabled={isEditing} value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g,'-')})} className="w-full bg-surface-muted border border-border px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 outline-none font-mono disabled:opacity-50 text-foreground transition-all placeholder:text-muted" placeholder="e.g. 50off or launch-special" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="appearance-none w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm font-bold text-gray-300 focus:border-indigo-500/50 outline-none hover:bg-gray-900 transition-all">
                 <option value="LAUNCH">🚀 Launch Special</option>
                 <option value="MARKETING">📢 Marketing Campaign</option>
                 <option value="REFERRAL">🔗 Referral Program</option>
                 <option value="BETA">🧪 Beta Testing</option>
                 <option value="GIFT">🎁 Gift / Custom Offer</option>
                 <option value="PARTNERSHIP">🤝 Partnership</option>
                 <option value="INTERNAL">👩‍💻 Internal Team</option>
              </select>
            </div>
          </div>

          {/* Allocation Settings */}
          <div className="space-y-6 relative">
            <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full z-0 pointer-events-none" />
            
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="space-y-2 z-10">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><Crown size={14} /> Promotion Type</label>
                <select value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})} className="w-full bg-gray-950 border border-emerald-500/30 px-5 py-3 rounded-xl text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all hover:bg-gray-900/80">
                   <option value="PERCENTAGE_DISCOUNT">🏷️ Percentage Discount (%)</option>
                   <option value="FULL_GRANT">🎁 Full Grant (100% Free Access)</option>
                </select>
              </div>

              {formData.discountType === 'PERCENTAGE_DISCOUNT' && (
                <div className="space-y-2 z-10">
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Zap size={14} /> Discount Percentage (%)</label>
                  <input type="number" min="1" max="100" required value={formData.discountPercent} onChange={e => setFormData({...formData, discountPercent: e.target.value})} className="w-full bg-gray-950 border border-indigo-500/40 px-5 py-3 rounded-xl text-sm font-bold text-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all placeholder-gray-600" placeholder="e.g. 50 for 50% off" />
                </div>
              )}

               <div className="space-y-2 z-10">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex justify-between">Max Redemptions <span className="font-normal italic">(Leave blank for unlimited)</span></label>
                <input type="number" min="1" value={formData.maxRedemptions} onChange={e => setFormData({...formData, maxRedemptions: e.target.value})} className="w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all placeholder-gray-600" placeholder="e.g. 500" />
              </div>
            </div>

            {/* Affected Target Plans Multi-Select Checkboxes */}
            <div className="space-y-2 z-10">
              <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Crown size={14} /> Applicable Plans <span className="text-gray-400 font-normal italic">(Select all plans this promotion applies to)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950 border border-emerald-500/30 p-4 rounded-xl">
                {[
                  { id: 'FREE', label: 'Free Plan' },
                  { id: 'STARTER', label: 'Starter Plan' },
                  { id: 'PRO', label: 'Pro Plan' },
                  { id: 'MENTOR', label: 'Mentor Plan' },
                ].map(plan => {
                  const isChecked = (formData.applicablePlans || []).includes(plan.id);
                  return (
                    <label key={plan.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.15)]' : 'border-gray-800 text-gray-400 hover:border-gray-700 bg-gray-900/30'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = formData.applicablePlans || [];
                          let updated;
                          if (e.target.checked) {
                            updated = [...current, plan.id];
                          } else {
                            updated = current.filter(p => p !== plan.id);
                          }
                          if (updated.length === 0) updated = ['STARTER'];
                          setFormData({
                            ...formData,
                            applicablePlans: updated,
                            planGranted: updated[updated.length - 1]
                          });
                        }}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                      <span className="text-xs">{plan.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 p-6 border border-white/5 rounded-2xl bg-white/[0.02]">
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex gap-2 items-center"><Calendar size={14} className="text-indigo-400"/> Start Date & Time</label>
               <input type="datetime-local" value={formData.startsAt} onChange={e => setFormData({...formData, startsAt: e.target.value})} className="w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 outline-none text-gray-300" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex gap-2 items-center"><Calendar size={14} className="text-amber-400"/> End Date & Time (Expiration)</label>
               <input type="datetime-local" value={formData.endsAt} onChange={e => setFormData({...formData, endsAt: e.target.value})} className="w-full bg-gray-950 border border-gray-800 px-5 py-3 rounded-xl text-sm focus:border-indigo-500/50 outline-none text-gray-300" />
             </div>
          </div>

          {/* Feature Flags */}
          <div className="space-y-4 pt-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-900 border border-gray-800 px-4 py-2 rounded-full inline-block">Settings & Automation</h4>
            
            <div className="grid sm:grid-cols-2 gap-4">
               {/* Toggle 1 */}
               <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-gray-900/50 hover:bg-gray-800/80 transition-colors">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-gray-200">Active Status</div>
                    <div className="text-xs text-gray-500 mt-1">Enable this promotion so traders can use it.</div>
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
                    <div className="text-sm font-bold text-gray-200">Invite Only</div>
                    <div className="text-xs text-gray-500 mt-1">Hide from public pages; only users with the code can redeem.</div>
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
                    <div className="text-sm font-bold text-amber-500">Auto-Expire Subscriptions</div>
                    <div className="text-xs text-amber-500/70 mt-1">Automatically revert accounts to Free plan when the promo expires.</div>
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
                    <div className="text-sm font-bold text-gray-200">Auto-Apply on Sign Up</div>
                    <div className="text-xs text-gray-500 mt-1">Automatically give this promotion to every new trader upon registration.</div>
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
                    <strong className="text-white text-sm">{redemptionsCount}</strong> Total Times Redeemed
                 </div>
              )}
            </div>
            <div className="flex w-full sm:w-auto gap-3">
              {isEditing && (
                <button type="button" onClick={handleDelete} className="px-5 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl flex items-center justify-center gap-2 font-bold transition md:w-auto flex-1">
                   <Trash2 size={18} /> Delete Promotion
                </button>
              )}
              <button disabled={saving} type="submit" className="relative flex-1 md:w-auto group overflow-hidden bg-emerald-500 text-gray-950 px-8 py-3 rounded-xl font-black tracking-wide hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                 <div className="absolute inset-0 w-1/4 h-full bg-white/30 -skew-x-[30deg] -translate-x-[150%] group-hover:translate-x-[400%] transition-transform duration-700 ease-in-out" />
                 <Save size={18} className="relative z-10" /> 
                 <span className="relative z-10">{saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Promotion'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default PromotionModal;
