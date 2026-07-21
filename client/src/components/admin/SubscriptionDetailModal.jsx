import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Calendar, Activity, Info, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const SubscriptionDetailModal = ({ subscriptionId, onClose, onMutate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  // Edit Forms
  const [editPlan, setEditPlan] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editAutoRenew, setEditAutoRenew] = useState('');
  const [editReason, setEditReason] = useState('');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/subscriptions/${subscriptionId}`);
      setData(res.data);
      
      const sub = res.data.subscription;
      setEditPlan(sub.plan);
      setEditStatus(sub.status);
      setEditSource(sub.source);
      setEditAutoRenew(sub.autoRenew.toString());
      setEditExpiresAt(sub.expiresAt ? new Date(sub.expiresAt).toISOString().split('T')[0] : '');
    } catch (e) {
      toast.error('Failed to resolve subscription manifest.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subscriptionId) fetchDetail();
  }, [subscriptionId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editReason || editReason.length < 5) {
      return toast.error('You must provide a concrete reason for modifying business agreements natively.');
    }

    try {
      setMutating(true);
      const payload = {
        plan: editPlan,
        status: editStatus,
        source: editSource,
        autoRenew: editAutoRenew === 'true',
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        reason: editReason
      };

      await api.put(`/admin/subscriptions/${subscriptionId}`, payload);
      toast.success('Subscription constraints successfully updated and logged!');
      onMutate();
      fetchDetail(); // refresh historical state inside modal directly
      setEditReason(''); // reset intent barrier
    } catch(err) {
      toast.error('Modification failed. Reference backend connectivity.');
    } finally {
      setMutating(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent"></div>
      </div>
    );
  }

  const { subscription, history } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-surface shadow-2xl text-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6 font-bold">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-lg">
                <Activity size={20} />
             </div>
             <div>
                <h2 className="text-xl leading-none tracking-tight">Subscription Command</h2>
                <p className="text-xs text-muted-foreground mt-1 tracking-wide font-medium">{subscription.user.email} (UUID: {subscription.id})</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-surface-muted rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid lg:grid-cols-2">
          
          {/* MUTATION ZONE */}
          <div className="p-6 border-b lg:border-b-0 lg:border-r border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Modify Authorization Constraint</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-muted-foreground">Entitlement Structure (Plan)</label>
                   <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="w-full bg-surface-muted border border-border px-3 py-2 rounded-lg text-sm focus:border-emerald-500 outline-none">
                     <option value="FREE">FREE</option>
                     <option value="STARTER">STARTER</option>
                     <option value="PRO">PRO</option>
                     <option value="MENTOR">MENTOR</option>
                   </select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-muted-foreground">Global Activity Status</label>
                   <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-surface-muted border border-border px-3 py-2 rounded-lg text-sm focus:border-emerald-500 outline-none">
                     <option value="ACTIVE">ACTIVE</option>
                     <option value="EXPIRED">EXPIRED</option>
                     <option value="SUSPENDED">SUSPENDED</option>
                     <option value="CANCELLED">CANCELLED</option>
                   </select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-muted-foreground">Original Designation (Source)</label>
                   <select value={editSource} onChange={e => setEditSource(e.target.value)} className="w-full bg-surface-muted border border-border px-3 py-2 rounded-lg text-sm focus:border-emerald-500 outline-none">
                     <option value="PAYMENT">PAYMENT</option>
                     <option value="PROMOTION">PROMOTION</option>
                     <option value="ADMIN">ADMIN</option>
                     <option value="REFERRAL">REFERRAL</option>
                   </select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-muted-foreground">Bypass Expiry Boundary</label>
                   <input type="date" value={editExpiresAt} onChange={e => setEditExpiresAt(e.target.value)} className="w-full bg-surface-muted border border-border px-3 py-2 rounded-lg text-sm focus:border-emerald-500 outline-none" />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5 flex flex-col justify-center">
                   <label className="text-xs font-semibold text-muted-foreground">Stripe/Paystack AutoRenew Bypass</label>
                   <select value={editAutoRenew} onChange={e => setEditAutoRenew(e.target.value)} className="w-full bg-surface-muted border border-border px-3 py-2 rounded-lg text-sm focus:border-emerald-500 outline-none">
                     <option value="true">Force Auto Renew [Internal Override]</option>
                     <option value="false">Standard Constraint [Disabled / Gateway]</option>
                   </select>
                 </div>
              </div>

              {/* Justification barrier to prevent accidental admin damage */}
              <div className="space-y-1.5 pt-4 border-t border-border mt-6">
                <label className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                   <AlertTriangle size={14} /> IMMUTABLE AUDIT JUSTIFICATION
                </label>
                <textarea 
                  value={editReason} 
                  onChange={e => setEditReason(e.target.value)} 
                  placeholder="Required: State why this business logic change is occurring..." 
                  className="w-full bg-black/20 border border-amber-500/30 px-3 py-2 rounded-lg text-sm focus:border-amber-500 outline-none min-h-[60px]"
                ></textarea>
              </div>

              <button type="submit" disabled={mutating} className="w-full bg-emerald-500 text-gray-950 font-bold py-3 mt-4 rounded-lg tracking-wide hover:bg-emerald-400 transition disabled:opacity-50">
                {mutating ? 'EXECUTING AUDIT DRILL...' : 'FORCE SUBSCRIPTION UPDATE'}
              </button>
            </form>
          </div>

          {/* HISTORY ZONE */}
          <div className="p-6 bg-surface-muted/30">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Clock size={16} /> Subscription Lifecycle History
            </h3>
            
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">No historical changes exist for this allocation.</div>
            ) : (
              <div className="space-y-4">
                {history.map(hs => (
                  <div key={hs.id} className="relative pl-6 border-l-2 border-emerald-500/20 pb-4 last:pb-0">
                    <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-emerald-500/20 border border-emerald-500"></div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(new Date(hs.createdAt), 'MMM dd, yyyy - HH:mm')} by <strong>{hs.changedBy}</strong>
                    </div>
                    <div className="bg-surface border border-border p-3 rounded-lg text-sm">
                      <div className="font-semibold text-foreground mb-1.5 flex items-center justify-between">
                         <span>Mutation Logic</span>
                         <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">{hs.source}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                         <div className="flex border border-border rounded overflow-hidden">
                           <span className="bg-surface-muted px-2 py-1 text-muted-foreground w-12 text-center">Old</span>
                           <span className="px-2 py-1 bg-surface font-mono text-foreground flex-1">{hs.previousPlan || 'NONE'}</span>
                         </div>
                         <div className="flex border border-border rounded overflow-hidden">
                           <span className="bg-emerald-500/10 px-2 py-1 text-emerald-500 w-12 text-center font-bold border-r border-border">New</span>
                           <span className="px-2 py-1 bg-surface font-mono text-foreground flex-1 font-bold">{hs.newPlan}</span>
                         </div>
                      </div>
                      <div className="mt-2 text-xs leading-5">
                         <strong className="text-muted-foreground mr-1">Audit Argument:</strong> {hs.reason || 'No justification provided (Legacy)'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetailModal;
