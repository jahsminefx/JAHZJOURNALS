import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, Filter, Gift, Archive, Plus, Activity, Rocket, Zap, ChevronRight, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import PromotionModal from '../../components/admin/PromotionModal';

const PromotionManagement = () => {
  const [metrics, setMetrics] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState(null);

  const fetchMetrics = async () => {
    try {
       const { data } = await api.get('/admin/promotions/metrics');
       setMetrics(data);
    } catch(err) {} 
  };

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page, limit: 20,
        ...(search && { search }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(statusFilter && { status: statusFilter })
      });
      const { data } = await api.get(`/admin/promotions?${params}`);
      setPromotions(data.promotions);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed fetching universal promotions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetrics() }, []);
  useEffect(() => {
     const timer = setTimeout(fetchPromotions, 300);
     return () => clearTimeout(timer);
  }, [search, categoryFilter, statusFilter, page]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in pl-1">
      {/* Hero Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-6 relative z-10">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 drop-shadow-sm">Promotions Engine</h1>
          <p className="text-gray-400 text-sm mt-2 max-w-xl font-medium leading-relaxed">
            Configure automated campaigns, referral structures, and universal marketing allocations natively across your enterprise architecture.
          </p>
        </div>
        <button 
          onClick={() => { setSelectedPromoId(null); setModalOpen(true); }}
          className="group relative flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-gray-950 font-black rounded-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <Plus size={20} className="relative z-10" /> 
          <span className="relative z-10">New Promotion</span>
        </button>
      </div>

      {/* Glassmorphic Metrics */}
      {metrics && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 relative z-0">
          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl shadow-xl transition-all hover:border-white/10 hover:-translate-y-1 group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500" />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Gift size={18} /></div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Configurations</p>
            </div>
            <h3 className="mt-4 text-3xl font-black text-white drop-shadow">{metrics.total}</h3>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-xl shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:-translate-y-1 group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl group-hover:bg-emerald-500/30 transition-all duration-500" />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Activity size={18} /></div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Live Campaigns</p>
            </div>
            <h3 className="mt-4 text-3xl font-black text-white drop-shadow">{metrics.active}</h3>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 backdrop-blur-xl shadow-[0_0_15px_rgba(245,158,11,0.05)] transition-all hover:border-amber-500/40 hover:-translate-y-1 group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl group-hover:bg-amber-500/30 transition-all duration-500" />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><Rocket size={18} /></div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Scheduled Hooks</p>
            </div>
            <h3 className="mt-4 text-3xl font-black text-white drop-shadow">{metrics.scheduled}</h3>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl shadow-xl transition-all hover:border-white/10 hover:-translate-y-1 group">
             <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-all duration-500" />
             <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><BarChart2 size={18} /></div>
               <p className="text-xs font-bold uppercase tracking-wider text-purple-400">Redemptions</p>
             </div>
             <h3 className="mt-4 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 drop-shadow">{metrics.totalRedemptions}</h3>
          </div>
        </div>
      )}

      {/* Main Grid / Filters */}
      <div className="space-y-6">
        
        <div className="flex flex-col md:flex-row gap-4 items-center bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 backdrop-blur-md shadow-sm">
            <div className="relative w-full md:flex-1 max-w-sm">
             <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gray-700/50 rounded-lg text-indigo-400">
               <Search size={16} />
             </div>
             <input 
               value={search} onChange={e => {setSearch(e.target.value); setPage(1)}}
               placeholder="Search internal slug or name..."
               className="pl-13 pr-4 py-3 bg-gray-900 border border-gray-700/50 rounded-xl text-sm font-medium w-full outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition-all text-gray-200 placeholder-gray-500"
             />
           </div>
           
           <div className="flex w-full md:w-auto gap-3 items-center">
             <div className="relative w-full md:w-auto">
               <select value={categoryFilter} onChange={e => {setCategoryFilter(e.target.value); setPage(1)}} className="appearance-none text-sm font-semibold text-gray-300 bg-gray-900 border border-gray-700/50 rounded-xl pl-4 pr-10 py-3 w-full outline-none focus:border-indigo-500/80 transition-all transition-shadow">
                 <option value="">🎯 All Architectures</option>
                 <option value="LAUNCH">LAUNCH (Founding Trader)</option>
                 <option value="MARKETING">MARKETING</option>
                 <option value="REFERRAL">REFERRAL</option>
                 <option value="GIFT">GIFT</option>
                 <option value="BETA">BETA</option>
                 <option value="COUPON">COUPON</option>
                 <option value="PARTNERSHIP">PARTNERSHIP</option>
                 <option value="INTERNAL">INTERNAL</option>
               </select>
               <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
             </div>
             
             <div className="relative w-full md:w-auto">
               <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setPage(1)}} className="appearance-none text-sm font-semibold text-gray-300 bg-gray-900 border border-gray-700/50 rounded-xl pl-4 pr-10 py-3 w-full outline-none focus:border-indigo-500/80 transition-all">
                 <option value="">⚙️ Any Constraints</option>
                 <option value="ACTIVE">Currently Active</option>
                 <option value="SCHEDULED">Scheduled</option>
                 <option value="EXPIRED">Archived & Expired</option>
               </select>
               <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
             </div>
           </div>
        </div>

        {/* Staggered List View */}
        <div className="space-y-3">
           {loading ? (
              <div className="flex justify-center p-12 text-indigo-400 font-bold tracking-widest animate-pulse uppercase text-sm border border-gray-700/50 rounded-2xl bg-gray-800/30">Isolating arrays...</div>
           ) : promotions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 border border-dashed border-gray-700/50 text-gray-500 rounded-2xl bg-gray-800/10">
                <Gift size={48} className="mb-4 opacity-30 text-indigo-400" />
                <p className="font-medium text-lg">No logic gates map to these configuration filters.</p>
              </div>
           ) : promotions.map(promo => {
               const isExpired = !promo.isActive || (promo.endsAt && new Date(promo.endsAt) < new Date());
               const isFuture = promo.startsAt && new Date(promo.startsAt) > new Date();
               const isActive = !isExpired && !isFuture;
               
               return (
                 <div 
                    key={promo.id} 
                    onClick={() => { setSelectedPromoId(promo.id); setModalOpen(true); }} 
                    className="relative group bg-gray-800/40 backdrop-blur-md rounded-2xl border border-gray-700/50 p-5 hover:bg-gray-800/80 hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all cursor-pointer overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
                 >
                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/5 group-hover:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="flex-1 flex items-start gap-4 z-10">
                       <div className={`p-3 rounded-xl border ${isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : isFuture ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-gray-700/30 border-gray-600/30 text-gray-500'}`}>
                         {isActive ? <Zap size={24} className="animate-pulse" /> : isFuture ? <Rocket size={24} /> : <Archive size={24} />}
                       </div>
                       
                       <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-black text-gray-100 tracking-tight">{promo.name}</h3>
                            {promo.requiresInvite && <span className="px-2 py-0.5 rounded-full border border-amber-500/30 text-[10px] uppercase font-black tracking-widest bg-amber-500/10 text-amber-400">Invite Only</span>}
                             <span className="px-2 py-0.5 rounded-md bg-gray-700/50 border border-gray-600 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{promo.category}</span>
                          </div>
                          <div className="text-indigo-400/80 text-sm font-mono mt-1 tracking-tight">{promo.slug}</div>
                       </div>
                    </div>
                    
                    <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4 md:justify-end items-center z-10 pt-2 md:pt-0 border-t md:border-none border-gray-700/50">
                       <div className="flex flex-col md:text-right">
                         <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">State Bounds</span>
                         <span className="text-sm font-bold text-gray-300">
                            {isActive ? 'Active' : isFuture ? 'Scheduled' : 'Expired'}
                         </span>
                         <span className="text-xs text-gray-500">
                           {promo.endsAt ? format(new Date(promo.endsAt), 'MMM dd') : 'Ad-infinitum'}
                         </span>
                       </div>

                       <div className="flex flex-col md:text-right">
                         <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Yield Yield</span>
                         <span className={`text-sm font-bold ${promo.planGranted === 'PRO' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                           {promo.planGranted} TIER
                         </span>
                         {promo.autoExpire && <span className="text-[10px] text-amber-400/80 font-bold uppercase tracking-tight">Auto-revokes</span>}
                       </div>

                       <div className="flex flex-col md:text-right bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                         <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Redemptions</span>
                         <div className="text-xl font-black text-gray-200">
                            {promo.currentRedemptions}
                            {promo.maxRedemptions && <span className="text-xs text-gray-500 font-semibold ml-1">/ {promo.maxRedemptions}</span>}
                         </div>
                       </div>
                       
                       <ChevronRight size={20} className="text-gray-600 group-hover:text-indigo-400 transition-colors hidden md:block" />
                    </div>
                 </div>
               )
           })}
        </div>

        {/* Pagination */
        !loading && total > 20 && (
          <div className="px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-800/40 rounded-xl border border-gray-700/50">
             <span className="text-sm font-medium text-gray-400">Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} nodes</span>
             <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-bold transition">Prev</button>
                <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-bold transition">Next Navigation</button>
             </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <PromotionModal 
           promotionId={selectedPromoId}
           onClose={() => { setModalOpen(false); setSelectedPromoId(null); }}
           onMutate={() => { fetchPromotions(); fetchMetrics(); }}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
