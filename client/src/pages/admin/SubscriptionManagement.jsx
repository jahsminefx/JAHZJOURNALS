import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, CreditCard, ChevronRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import SubscriptionDetailModal from '../../components/admin/SubscriptionDetailModal';

const SubscriptionManagement = () => {
  const [metrics, setMetrics] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  
  const [selectedSubId, setSelectedSubId] = useState(null);

  const fetchMetrics = async () => {
    try {
      const { data } = await api.get('/admin/subscriptions/metrics');
      setMetrics(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(search && { search }),
        ...(planFilter && { plan: planFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(sourceFilter && { source: sourceFilter }),
      });
      
      const { data } = await api.get(`/admin/subscriptions?${params}`);
      setSubscriptions(data.subscriptions);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubscriptions();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, planFilter, statusFilter, sourceFilter, page]);

  const getStatusColor = (status) => {
    const map = {
      ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      EXPIRED: 'bg-red-500/10 text-red-500 border-red-500/20',
      CANCELLED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      SUSPENDED: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      INACTIVE: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    };
    return map[status] || 'bg-surface text-foreground';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscription Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor billing states, promotions, and active memberships centrally.</p>
      </div>

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-muted-foreground">Total Subscribers</p>
            <h3 className="mt-2 text-2xl font-black text-foreground">{metrics.totalSubs}</h3>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-emerald-500">Active Pro</p>
            <h3 className="mt-2 text-2xl font-black text-foreground">{metrics.plans?.PRO || 0}</h3>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-blue-500">Starter Core</p>
            <h3 className="mt-2 text-2xl font-black text-foreground">{metrics.plans?.STARTER || 0}</h3>
          </div>
          <div className="rounded-xl border border-border bg-amber-500/10 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-500">Promotions</p>
            <h3 className="mt-2 text-2xl font-black text-amber-400">{metrics.sources?.PROMOTION || 0}</h3>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-purple-500">Standard MRR (Est)</p>
            <h3 className="mt-2 text-2xl font-black text-foreground">₦---</h3>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface flex flex-col overflow-hidden">
        
        {/* Filters Top Bar */}
        <div className="p-4 border-b border-border bg-surface-muted/30 flex flex-wrap gap-4 items-center justify-between">
           <div className="relative w-full sm:w-64">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input 
               value={search}
               onChange={(e) => { setSearch(e.target.value); setPage(1); }}
               placeholder="Search by name or email..."
               className="pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm w-full outline-none focus:border-emerald-500 transition"
             />
           </div>
           
           <div className="flex flex-wrap gap-3 items-center">
             <Filter size={16} className="text-muted-foreground hidden sm:block" />
             <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }} className="text-sm bg-surface border border-border rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500">
               <option value="">All Plans</option>
               <option value="FREE">Free</option>
               <option value="STARTER">Starter</option>
               <option value="PRO">Pro</option>
             </select>
             
             <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="text-sm bg-surface border border-border rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500">
               <option value="">All Statuses</option>
               <option value="ACTIVE">Active</option>
               <option value="EXPIRED">Expired</option>
               <option value="CANCELLED">Cancelled</option>
             </select>

             <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} className="text-sm bg-surface border border-border rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500">
               <option value="">All Sources</option>
               <option value="PAYMENT">Payment</option>
               <option value="PROMOTION">Promotion</option>
               <option value="ADMIN">Admin</option>
             </select>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">User details</th>
                <th className="px-6 py-3 font-semibold">Current Plan</th>
                <th className="px-6 py-3 font-semibold">Status / Source</th>
                <th className="px-6 py-3 font-semibold">Timeframe</th>
                <th className="px-6 py-3 font-semibold text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">Loading subscriptions...</td>
                 </tr>
              ) : subscriptions.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">No records matched your filters.</td>
                 </tr>
              ) : subscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-surface-muted/50 transition cursor-pointer" onClick={() => setSelectedSubId(sub.id)}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground truncate max-w-[200px]">{sub.user.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{sub.user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{sub.plan}</div>
                    {sub.promotion && <div className="text-xs text-amber-500 font-medium mt-0.5">🏅 {sub.promotion.name}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-bold leading-5 ${getStatusColor(sub.status)}`}>
                       {sub.status}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 capitalize font-medium">{sub.source.toLowerCase()}</div>
                  </td>
                  <td className="px-6 py-4 text-xs whitespace-nowrap">
                     <div className="text-muted-foreground">Since {format(new Date(sub.startedAt), 'MMM dd, yyyy')}</div>
                     <div className={sub.expiresAt ? (new Date(sub.expiresAt) > new Date() ? 'text-emerald-400 font-medium mt-1' : 'text-red-400 font-medium mt-1') : 'text-foreground font-medium mt-1'}>
                       {sub.expiresAt ? `Ends ${format(new Date(sub.expiresAt), 'MMM dd, yyyy')}` : 'Auto-renews'}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <button className="inline-flex items-center text-muted-foreground hover:text-emerald-500 transition">
                       <ChevronRight size={20} />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */
        !loading && total > 20 && (
          <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
             <span className="text-xs text-muted-foreground">Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} records</span>
             <div className="flex gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold disabled:opacity-50 hover:bg-surface-muted transition"
                >
                  Previous
                </button>
                <button 
                  disabled={page * 20 >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold disabled:opacity-50 hover:bg-surface-muted transition"
                >
                  Next
                </button>
             </div>
          </div>
        )}
      </div>

      {selectedSubId && (
        <SubscriptionDetailModal 
          subscriptionId={selectedSubId} 
          onClose={() => setSelectedSubId(null)} 
          onMutate={() => fetchSubscriptions()}
        />
      )}
    </div>
  );
};

export default SubscriptionManagement;
