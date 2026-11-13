import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, Filter, Gift, Archive, Plus, Activity, Rocket, Zap, ChevronRight, BarChart2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import PromotionModal from '../../components/admin/PromotionModal';

const formatPlanName = (plan) => {
  switch (plan) {
    case 'PRO_SYNC': return 'Pro Sync';
    case 'STARTER_SYNC':
    case 'SYNC_PLUS': return 'Starter Sync';
    case 'PRO': return 'Pro';
    case 'STARTER': return 'Starter';
    case 'FREE': return 'Free';
    case 'MENTOR_MEGA': return 'Mega Academy';
    case 'MENTOR_GROWTH': return 'Growth Community';
    case 'MENTOR_PRIVATE_COHORT': return 'Private Cohort';
    case 'MENTOR': return 'Mentor';
    default: return plan;
  }
};

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
  const [sweeping, setSweeping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchMetrics = async () => {
    try {
      const { data } = await api.get('/admin/promotions/metrics');
      setMetrics(data);
    } catch (err) {}
  };

  const handleSweepExpired = async () => {
    setSweeping(true);
    const toastId = toast.loading('Checking expired promotions & downgrading users to Free...');
    try {
      const { data } = await api.post('/admin/promotions/sweep-expired');
      toast.success(
        data.message || `Sweep completed: ${data.result?.downgradedUsersCount || 0} user(s) transitioned to Free.`,
        { id: toastId }
      );
      await fetchMetrics();
      await fetchPromotions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sweep expired promotions.', { id: toastId });
    } finally {
      setSweeping(false);
    }
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

  useEffect(() => { fetchMetrics(); }, []);
  useEffect(() => {
    const timer = setTimeout(fetchPromotions, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, statusFilter, page]);

  const handleCopySlug = (e, promo) => {
    e.stopPropagation();
    if (!promo?.slug) return;
    navigator.clipboard?.writeText(promo.slug);
    setCopiedId(promo.id);
    toast.success(`Copied code: ${promo.slug}`);
    setTimeout(() => setCopiedId((prev) => (prev === promo.id ? null : prev)), 1500);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-8 animate-fade-in">
      {/* Hero Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Promotions &amp; Discounts</h1>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-xl font-medium leading-relaxed">
            Create and manage promotional discounts, special launch offers, and coupon codes for your traders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleSweepExpired}
            disabled={sweeping}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-400 border border-amber-500/30 font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 text-xs sm:text-sm"
            title="Force-downgrade any users whose promotions have ended back to Free"
          >
            <Zap size={16} className={sweeping ? 'animate-spin shrink-0' : 'shrink-0'} />
            <span>{sweeping ? 'Sweeping...' : 'Sweep Expired'}</span>
          </button>
          <button
            onClick={() => { setSelectedPromoId(null); setModalOpen(true); }}
            className="flex-1 sm:flex-initial group relative flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl transition-all shadow-sm text-xs sm:text-sm"
          >
            <Plus size={18} className="shrink-0" />
            <span>New Promotion</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm transition-all">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/15 rounded-lg text-indigo-500 dark:text-indigo-400"><Gift size={18} /></div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Promos</p>
            </div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-black text-foreground">{metrics.total}</h3>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-6 shadow-sm transition-all">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/15 rounded-lg text-emerald-600 dark:text-emerald-400"><Activity size={18} /></div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Promos</p>
            </div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-black text-foreground">{metrics.active}</h3>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-6 shadow-sm transition-all">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/15 rounded-lg text-amber-600 dark:text-amber-400"><Rocket size={18} /></div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Scheduled</p>
            </div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-black text-foreground">{metrics.scheduled}</h3>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm transition-all">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-500/15 rounded-lg text-purple-600 dark:text-purple-400"><BarChart2 size={18} /></div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Times Claimed</p>
            </div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-black text-foreground">{metrics.totalRedemptions}</h3>
          </div>
        </div>
      )}

      {/* Main Grid / Filters */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-sm">
          <div className="relative w-full lg:flex-1 lg:max-w-sm">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-surface-muted rounded-lg text-indigo-500 dark:text-indigo-400 pointer-events-none">
              <Search size={15} />
            </div>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search promo name or code..."
              className="pl-12 pr-4 py-2.5 min-h-[44px] bg-surface-muted border border-border rounded-xl text-sm font-medium w-full outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex w-full lg:w-auto gap-3 items-center">
            <div className="relative w-full lg:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="appearance-none text-sm font-semibold text-foreground bg-surface-muted border border-border rounded-xl pl-4 pr-10 py-2.5 min-h-[44px] w-full outline-none focus:border-indigo-500 transition-all"
              >
                <option value="">All Categories</option>
                <option value="LAUNCH">Launch Special</option>
                <option value="MARKETING">Marketing Campaign</option>
                <option value="REFERRAL">Referral Program</option>
                <option value="GIFT">Gift / Custom</option>
                <option value="BETA">Beta Testing</option>
                <option value="COUPON">Coupon</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="INTERNAL">Internal Team</option>
              </select>
              <Filter size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative w-full lg:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="appearance-none text-sm font-semibold text-foreground bg-surface-muted border border-border rounded-xl pl-4 pr-10 py-2.5 min-h-[44px] w-full outline-none focus:border-indigo-500 transition-all"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Currently Active</option>
                <option value="SCHEDULED">Upcoming / Scheduled</option>
                <option value="EXPIRED">Expired / Inactive</option>
              </select>
              <Filter size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center p-10 text-indigo-500 dark:text-indigo-400 font-bold tracking-widest animate-pulse uppercase text-sm border border-border rounded-2xl bg-surface">
              Loading promotions...
            </div>
          ) : promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border text-muted-foreground rounded-2xl bg-surface text-center">
              <Gift size={40} className="mb-3 opacity-40 text-indigo-500 dark:text-indigo-400" />
              <p className="font-medium text-base">No promotions match your search or filters.</p>
            </div>
          ) : promotions.map((promo) => {
            const isExpired = !promo.isActive || (promo.endsAt && new Date(promo.endsAt) < new Date());
            const isFuture = promo.startsAt && new Date(promo.startsAt) > new Date();
            const isActive = !isExpired && !isFuture;
            const isDiscount = promo.discountType === 'PERCENTAGE_DISCOUNT' || (promo.discountPercent && promo.discountPercent < 100);
            const usagePct = promo.maxRedemptions
              ? Math.min(100, Math.round((promo.currentRedemptions / promo.maxRedemptions) * 100))
              : null;

            return (
              <div
                key={promo.id}
                onClick={() => { setSelectedPromoId(promo.id); setModalOpen(true); }}
                className="relative group bg-surface rounded-2xl border border-border p-4 sm:p-5 hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6"
              >
                <div className="flex-1 flex items-start gap-3.5 min-w-0">
                  <div
                    className={`p-2.5 sm:p-3 rounded-xl border shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
                        : isFuture
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400'
                        : 'bg-surface-muted border-border text-muted-foreground'
                    }`}
                  >
                    {isActive ? <Zap size={20} /> : isFuture ? <Rocket size={20} /> : <Archive size={20} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight break-words">{promo.name}</h3>
                      {promo.requiresInvite && (
                        <span className="px-2 py-0.5 rounded-full border border-amber-500/30 text-[10px] uppercase font-black tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Invite Only
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {promo.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-indigo-500 dark:text-indigo-400 text-xs sm:text-sm font-mono break-all">
                        Code: <strong>{promo.slug}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopySlug(e, promo)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted hover:bg-indigo-500/10 border border-border text-[11px] font-semibold text-muted-foreground hover:text-indigo-500 transition"
                        title="Copy promo code"
                      >
                        {copiedId === promo.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{copiedId === promo.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-nowrap items-center gap-3 sm:gap-6 pt-3 lg:pt-0 border-t lg:border-none border-border">
                  <div className="flex flex-col lg:text-right min-w-0">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Status</span>
                    <span className={`text-sm font-bold ${isActive ? 'text-emerald-500 dark:text-emerald-400' : isFuture ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      {isActive ? 'Active' : isFuture ? 'Scheduled' : 'Expired'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {promo.endsAt ? `Ends ${format(new Date(promo.endsAt), 'MMM dd, yyyy')}` : 'No expiration'}
                    </span>
                  </div>

                  <div className="flex flex-col lg:text-right min-w-0">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Benefit</span>
                    <span className={`text-sm font-bold ${promo.planGranted === 'PRO' ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-500 dark:text-indigo-400'}`}>
                      {isDiscount ? `${promo.discountPercent}% OFF` : `${formatPlanName(promo.planGranted)} Plan`}
                    </span>
                    {promo.autoExpire && (
                      <span className="text-[10px] text-amber-500 dark:text-amber-400 font-bold uppercase tracking-tight">Auto-expires</span>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex flex-col lg:text-right bg-surface-muted px-3.5 py-2 rounded-xl border border-border min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Times Claimed</span>
                    <div className="text-lg font-black text-foreground">
                      {promo.currentRedemptions}
                      {promo.maxRedemptions && (
                        <span className="text-xs text-muted-foreground font-semibold ml-1">/ {promo.maxRedemptions} max</span>
                      )}
                    </div>
                    {usagePct !== null && (
                      <div className="w-full h-1.5 rounded-full bg-background mt-1.5 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${usagePct}%` }} />
                      </div>
                    )}
                  </div>

                  <ChevronRight size={20} className="text-muted-foreground group-hover:text-indigo-500 transition-colors hidden lg:block shrink-0" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {!loading && total > 20 && (
          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface rounded-xl border border-border">
            <span className="text-sm font-medium text-muted-foreground text-center sm:text-left">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} promotions
            </span>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex-1 sm:flex-initial px-4 py-2 min-h-[40px] bg-surface-muted hover:bg-border disabled:opacity-50 text-foreground rounded-lg text-sm font-bold border border-border transition"
              >
                Previous
              </button>
              <button
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="flex-1 sm:flex-initial px-4 py-2 min-h-[40px] bg-surface-muted hover:bg-border disabled:opacity-50 text-foreground rounded-lg text-sm font-bold border border-border transition"
              >
                Next
              </button>
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
