import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, Medal, ShieldAlert, BadgeCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const FoundingTraderAdmin = () => {
  const [promoDoc, setPromoDoc] = useState(null);
  const [grantees, setGrantees] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // We search internally for our standard Founding Trader launch identifier.
  // In a robust system we could persist a config map, but we'll isolate by typical slugs.
  const resolveCorePromotion = async () => {
    try {
       const res = await api.get('/admin/promotions?category=LAUNCH&limit=1');
       if (res.data.promotions.length > 0) {
         setPromoDoc(res.data.promotions[0]);
         return res.data.promotions[0].id;
       }
       return null;
    } catch(err) {
      toast.error('Could not map Launch Promos.');
      return null;
    }
  };

  const fetchGrantees = async (id, pageNum) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/promotions/${id}/grantees?page=${pageNum}&limit=50`);
      setGrantees(res.data.grants);
      setTotal(res.data.total);
    } catch(err) {
      toast.error('Failed mapping grantees grid.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
       const id = await resolveCorePromotion();
       if (id) fetchGrantees(id, page);
       else setLoading(false);
    };
    init();
  }, [page]);

  const filteredGrantees = grantees.filter(g => 
    g.user.name.toLowerCase().includes(search.toLowerCase()) || 
    g.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <Medal size={200} />
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl font-black text-amber-500 tracking-wide flex items-center gap-3">
              <Medal size={28} /> FOUNDING TRADER COMMAND
            </h1>
            <p className="text-amber-500/80 text-sm mt-2 font-medium max-w-2xl">
              Specialized launch dashboard isolating early adopters flagged with Launch Grants. This relies seamlessly on the generic Promotions architecture internally.
            </p>
          </div>
          <div className="relative z-10 flex gap-4 text-right">
             <div>
               <div className="text-[10px] uppercase font-bold text-amber-500/70 tracking-widest">Total Indexed</div>
               <div className="text-3xl font-black text-amber-500">{total}</div>
             </div>
             {promoDoc && (
               <div>
                 <div className="text-[10px] uppercase font-bold text-amber-500/70 tracking-widest">Master Logic</div>
                 <div className="text-xs font-mono font-bold text-amber-500 mt-1">{promoDoc.slug}</div>
                 <div className="text-xs font-bold text-amber-500 mt-0.5">{promoDoc.isActive ? 'ACTIVE GATE' : 'DRIFTING / CLOSED'}</div>
               </div>
             )}
          </div>
       </div>

       {loading ? (
          <div className="flex justify-center h-40 items-center">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-r-transparent"></div>
          </div>
       ) : !promoDoc ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center flex flex-col items-center">
            <ShieldAlert size={40} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold">No LAUNCH logic mapped</h3>
            <p className="text-muted-foreground text-sm mt-1">Navigate to the Extensions console to spin up your Founding Trader ruleset flagged as LAUNCH.</p>
          </div>
       ) : (
          <div className="rounded-xl border border-border bg-surface flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-muted/30 flex items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Filter grants..."
                  className="pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm w-full outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                 <thead className="bg-surface-muted text-muted-foreground">
                   <tr>
                     <th className="px-6 py-3 font-semibold">User Identifiers</th>
                     <th className="px-6 py-3 font-semibold">Native Tier</th>
                     <th className="px-6 py-3 font-semibold">Audit Granter</th>
                     <th className="px-6 py-3 font-semibold">Deployment Timeframe</th>
                     <th className="px-6 py-3 font-semibold">Status Estimate</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                   {filteredGrantees.length === 0 ? (
                      <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No matching Launch Grants discovered in snapshot.</td></tr>
                   ) : filteredGrantees.map(grant => {
                        const grantedDate = new Date(grant.createdAt);
                        // Using overarching promo end logic as estimate if autoExpire is on. 
                        // Realistically users have individual Subscription expiresAt but history shows grant time.
                        const isExpiredLocally = promoDoc.autoExpire && promoDoc.endsAt && new Date() > new Date(promoDoc.endsAt);
                        const daysRemaining = promoDoc.autoExpire && promoDoc.endsAt ? differenceInDays(new Date(promoDoc.endsAt), new Date()) : '∞';

                        return (
                          <tr key={grant.id} className="hover:bg-surface-muted/50 transition">
                            <td className="px-6 py-4">
                              <div className="font-bold text-foreground">{grant.user.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{grant.user.email}</div>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-amber-500 text-xs">
                               {grant.newPlan}
                            </td>
                            <td className="px-6 py-4 text-xs">
                               <div className="font-medium text-muted-foreground">{grant.changedBy}</div>
                               <div className="text-[10px] text-muted-foreground mt-1 tracking-wider uppercase">{grant.reason}</div>
                            </td>
                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                               <div className="text-foreground font-medium">Granted: {format(grantedDate, 'MMM dd, yyyy')}</div>
                               {promoDoc.autoExpire && promoDoc.endsAt ? (
                                  <div className="text-muted-foreground mt-1">Exp: {format(new Date(promoDoc.endsAt), 'MMM dd, yyyy')}</div>
                               ) : <div className="text-muted-foreground mt-1">Permanent Binding</div>}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold">
                               {isExpiredLocally ? (
                                 <span className="text-red-500 flex items-center gap-1.5"><ShieldAlert size={14}/> EXPIRED</span>
                               ) : daysRemaining !== '∞' && daysRemaining <= 7 ? (
                                 <span className="text-amber-500 flex items-center gap-1.5">{daysRemaining} days left</span>
                               ) : (
                                 <span className="text-emerald-500 flex items-center gap-1.5"><BadgeCheck size={14}/> LIVE YIELD ({daysRemaining} days)</span>
                               )}
                            </td>
                          </tr>
                        )
                   })}
                 </tbody>
              </table>
            </div>

            {!loading && total > 50 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                 <span className="text-xs text-muted-foreground">Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} grants</span>
                 <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-md border border-border text-xs">Previous</button>
                    <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-md border border-border text-xs">Next</button>
                 </div>
              </div>
            )}
          </div>
       )}
    </div>
  )
};

export default FoundingTraderAdmin;
