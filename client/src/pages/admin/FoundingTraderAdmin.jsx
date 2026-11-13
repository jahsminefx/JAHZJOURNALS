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
       <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 p-4 sm:p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 pointer-events-none">
            <Medal size={200} />
          </div>
          <div className="relative z-10 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-amber-500 tracking-wide flex items-center gap-2.5">
              <Medal size={24} className="shrink-0" /> Founding Trader Program
            </h1>
            <p className="text-amber-600 dark:text-amber-500/80 text-xs sm:text-sm mt-1.5 font-medium max-w-2xl">
              Track early adopters who received complimentary access or launch badges during the platform launch.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap justify-start sm:justify-end gap-4 text-left sm:text-right">
             <div>
               <div className="text-[10px] uppercase font-bold text-amber-600/80 dark:text-amber-500/70 tracking-widest">Total Founding Traders</div>
               <div className="text-2xl sm:text-3xl font-black text-amber-500">{total}</div>
             </div>
             {promoDoc && (
               <div>
                 <div className="text-[10px] uppercase font-bold text-amber-600/80 dark:text-amber-500/70 tracking-widest">Launch Promo Code</div>
                 <div className="text-xs font-mono font-bold text-amber-500 mt-1">{promoDoc.slug}</div>
                 <div className="text-xs font-bold text-amber-500 mt-0.5">{promoDoc.isActive ? 'Active' : 'Ended'}</div>
               </div>
             )}
          </div>
       </div>

       {loading ? (
          <div className="flex justify-center h-40 items-center">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-r-transparent"></div>
          </div>
       ) : !promoDoc ? (
          <div className="p-6 sm:p-8 border border-dashed border-border rounded-xl text-center flex flex-col items-center">
            <ShieldAlert size={40} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold">No Launch Promotion Found</h3>
            <p className="text-muted-foreground text-sm mt-1">Create a promotion with category &apos;LAUNCH&apos; under Promotions to track founding traders here.</p>
          </div>
       ) : (
          <div className="rounded-xl border border-border bg-surface flex flex-col overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-border bg-surface-muted/30 flex items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm w-full outline-none focus:border-amber-500 transition text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Mobile Founding Trader Cards (< 768px) */}
            <div className="md:hidden divide-y divide-border">
              {filteredGrantees.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No founding traders found matching your search.</div>
              ) : filteredGrantees.map((grant) => {
                const grantedDate = new Date(grant.createdAt);
                const isExpiredLocally = promoDoc.autoExpire && promoDoc.endsAt && new Date() > new Date(promoDoc.endsAt);
                const daysRemaining = promoDoc.autoExpire && promoDoc.endsAt ? differenceInDays(new Date(promoDoc.endsAt), new Date()) : '∞';

                return (
                  <div key={grant.id} className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground truncate">{grant.user.name}</div>
                        <div className="text-muted-foreground break-all">{grant.user.email}</div>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        {grant.newPlan}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div>
                        <span className="text-muted-foreground">By: </span>
                        <span className="font-medium text-foreground">{grant.changedBy}</span>
                        {grant.reason && <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">({grant.reason})</span>}
                      </div>
                      <div className="font-bold">
                        {isExpiredLocally ? (
                          <span className="text-red-500 inline-flex items-center gap-1"><ShieldAlert size={13}/> Expired</span>
                        ) : daysRemaining !== '∞' && daysRemaining <= 7 ? (
                          <span className="text-amber-500">{daysRemaining} days left</span>
                        ) : (
                          <span className="text-emerald-500 inline-flex items-center gap-1"><BadgeCheck size={13}/> Active {daysRemaining !== '∞' ? `(${daysRemaining}d)` : ''}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50 flex flex-wrap justify-between gap-1">
                      <span>Granted: {format(grantedDate, 'MMM dd, yyyy')}</span>
                      <span>{promoDoc.autoExpire && promoDoc.endsAt ? `Expires: ${format(new Date(promoDoc.endsAt), 'MMM dd, yyyy')}` : 'Permanent Access'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                 <thead className="bg-surface-muted text-muted-foreground">
                   <tr>
                     <th className="px-6 py-3 font-semibold">Trader</th>
                     <th className="px-6 py-3 font-semibold">Plan Granted</th>
                     <th className="px-6 py-3 font-semibold">Granted By</th>
                     <th className="px-6 py-3 font-semibold">Date Granted</th>
                     <th className="px-6 py-3 font-semibold">Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                   {filteredGrantees.length === 0 ? (
                      <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No founding traders found matching your search.</td></tr>
                   ) : filteredGrantees.map(grant => {
                        const grantedDate = new Date(grant.createdAt);
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
                               <div className="text-foreground font-medium">{format(grantedDate, 'MMM dd, yyyy')}</div>
                               {promoDoc.autoExpire && promoDoc.endsAt ? (
                                  <div className="text-muted-foreground mt-1">Expires: {format(new Date(promoDoc.endsAt), 'MMM dd, yyyy')}</div>
                               ) : <div className="text-muted-foreground mt-1">Permanent Access</div>}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold">
                               {isExpiredLocally ? (
                                 <span className="text-red-500 flex items-center gap-1.5"><ShieldAlert size={14}/> Expired</span>
                               ) : daysRemaining !== '∞' && daysRemaining <= 7 ? (
                                 <span className="text-amber-500 flex items-center gap-1.5">{daysRemaining} days left</span>
                               ) : (
                                 <span className="text-emerald-500 flex items-center gap-1.5"><BadgeCheck size={14}/> Active {daysRemaining !== '∞' ? `(${daysRemaining} days remaining)` : ''}</span>
                               )}
                            </td>
                          </tr>
                        )
                   })}
                 </tbody>
              </table>
            </div>

            {!loading && total > 50 && (
              <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                 <span className="text-xs text-muted-foreground text-center sm:text-left">Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} grants</span>
                 <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold disabled:opacity-50 hover:bg-surface-muted">Previous</button>
                    <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold disabled:opacity-50 hover:bg-surface-muted">Next</button>
                 </div>
              </div>
            )}
          </div>
       )}
    </div>
  )
};

export default FoundingTraderAdmin;
