import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { 
  Users, CreditCard, Activity, TrendingUp, AlertTriangle, GraduationCap,
  Sparkles, Gift, DollarSign, ShieldCheck, RefreshCw, ArrowUpRight,
  Clock, CheckCircle2, ChevronRight, Layers, ShieldAlert, Award
} from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState('');

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const { data } = await api.get('/admin/dashboard');
      setMetrics(data);
      setError('');
      if (isManual) toast.success('Dashboard metrics refreshed');
    } catch (err) {
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sweep expired promotions.', { id: toastId });
    } finally {
      setSweeping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-xs text-muted-foreground font-medium">Loading executive dashboard...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-500 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} />
          <h3 className="font-bold">Error Loading Dashboard</h3>
        </div>
        <p className="text-sm">{error || 'Could not retrieve platform metrics.'}</p>
        <button
          onClick={() => fetchMetrics(true)}
          className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { users, subscriptions, mentorship, promotions, trading, infrastructure, queues } = metrics;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Super Admin Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
              Live HQ
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Real-time platform telemetry, subscription tier health, mentorship revenue & promotion enforcement.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSweepExpired}
            disabled={sweeping}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition shadow-xs disabled:opacity-50 active:scale-95"
            title="Force-downgrade any users whose promotional upgrades have expired"
          >
            <Clock size={14} className={sweeping ? 'animate-spin' : ''} />
            {sweeping ? 'Sweeping Promos...' : 'Sweep Expired Promos'}
          </button>

          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface border border-border hover:bg-surface-muted text-foreground transition shadow-xs"
            title="Refresh All Metrics"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-500' : 'text-muted-foreground'} />
            <span>Refresh</span>
          </button>

          <Link
            to="/admin/promotions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
          >
            <Gift size={14} />
            <span>Promotions Hub</span>
          </Link>
        </div>
      </div>

      {/* Subscription Tier Distribution Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User & Subscription Distribution</h2>
          <Link to="/admin/subscriptions" className="text-xs text-emerald-500 hover:underline font-semibold flex items-center gap-1">
            View All Subscriptions <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Total Registered */}
          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Traders</span>
              <Users size={16} className="text-foreground" />
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-black text-foreground">{users.totalUsers.toLocaleString()}</h3>
              <span className="text-xs font-bold text-emerald-500">+{users.newUsersToday} today</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{users.activeUsers} active</p>
          </div>

          {/* Free Tier */}
          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Free Tier</span>
              <Layers size={16} className="text-slate-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-foreground">{subscriptions.freeUsers.toLocaleString()}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {((subscriptions.freeUsers / (users.totalUsers || 1)) * 100).toFixed(0)}% of userbase
            </p>
          </div>

          {/* Starter Plan */}
          <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-xs">
            <div className="flex items-center justify-between text-blue-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Starter Tier</span>
              <CreditCard size={16} />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-foreground">{subscriptions.starterUsers.toLocaleString()}</h3>
            <p className="mt-1 text-[11px] text-blue-500 font-semibold">Active subscribers</p>
          </div>

          {/* Pro Plan */}
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
            <div className="flex items-center justify-between text-emerald-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pro Tier</span>
              <Sparkles size={16} />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-foreground">{subscriptions.proUsers.toLocaleString()}</h3>
            <p className="mt-1 text-[11px] text-emerald-500 font-semibold">Full AI & multi-account</p>
          </div>

          {/* Mentor Plan */}
          <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-indigo-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Mentor Tier</span>
              <GraduationCap size={18} />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-foreground">{subscriptions.mentorUsers.toLocaleString()}</h3>
            <p className="mt-1 text-[11px] text-indigo-400 font-semibold">
              {mentorship.totalCohorts} active cohort{mentorship.totalCohorts === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* MENTORSHIP & ACADEMY ECOSYSTEM COMMAND CENTER */}
      <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-surface to-indigo-500/[0.04] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center font-bold">
              <GraduationCap size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">Mentorship & Academy Ecosystem</h2>
              <p className="text-xs text-muted-foreground">
                Oversee trading mentors, academy cohorts, student enrollment fees, and platform commission split.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 text-xs font-bold border border-indigo-500/20">
              5% Platform Split Active
            </span>
          </div>
        </div>

        {/* Mentorship Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 rounded-xl border border-border bg-surface">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Active Mentors</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-foreground">{mentorship.totalMentors}</span>
              <span className="text-xs text-indigo-500 font-semibold">{mentorship.totalCohorts} cohorts</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-surface">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Enrolled Students</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-foreground">{mentorship.totalStudentsEnrolled}</span>
              <span className="text-xs text-emerald-500 font-semibold">{mentorship.paidCohorts} paid groups</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              5% Platform Revenue
            </span>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 block truncate">
                {mentorship.platformFeeNgn > 0
                  ? `₦${mentorship.platformFeeNgn.toLocaleString()}`
                  : `$${mentorship.platformFeeUsd.toLocaleString()}`}
              </span>
              <span className="text-[10px] text-muted-foreground">Net platform commission</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-surface">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">95% Mentor Payouts</span>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-black text-foreground block truncate">
                {mentorship.mentorPayoutsNgn > 0
                  ? `₦${mentorship.mentorPayoutsNgn.toLocaleString()}`
                  : `$${mentorship.mentorPayoutsUsd.toLocaleString()}`}
              </span>
              <span className="text-[10px] text-muted-foreground">Credited to mentors</span>
            </div>
          </div>
        </div>

        {/* Recent Cohorts Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Active Academy Cohorts Overview</h3>
            <span className="text-[11px] text-muted-foreground">Latest created groups</span>
          </div>

          {mentorship.recentCohorts?.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
              No mentor cohorts created yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5">Cohort & Academy</th>
                    <th className="px-4 py-2.5">Mentor</th>
                    <th className="px-4 py-2.5">Enrolled Traders</th>
                    <th className="px-4 py-2.5">Access Fee</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {mentorship.recentCohorts.map((cohort) => (
                    <tr key={cohort.id} className="hover:bg-surface-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">{cohort.name}</div>
                        {cohort.academyName && (
                          <div className="text-[11px] text-muted-foreground truncate">{cohort.academyName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{cohort.mentorName}</div>
                        <div className="text-[10px] text-muted-foreground">{cohort.mentorEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-surface-muted text-foreground border border-border">
                          {cohort.studentCount} trader{cohort.studentCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {cohort.isPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {cohort.currency === 'NGN' ? '₦' : '$'}{cohort.price}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Free</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/join/cohort/${cohort.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-500 hover:underline font-semibold"
                        >
                          <span>Invite Page</span>
                          <ArrowUpRight size={13} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PROMOTIONS, TRADING & INFRASTRUCTURE TWO-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Left Column: Promotions & Lifecycle Management */}
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Gift size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">Promotions & Discount Engine</h3>
                <p className="text-xs text-muted-foreground">Campaign rules & auto-downgrade enforcement.</p>
              </div>
            </div>
            <Link
              to="/admin/promotions"
              className="text-xs text-emerald-500 hover:underline font-semibold flex items-center gap-1"
            >
              Manage <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-border bg-surface-muted/30 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Campaigns</span>
              <div className="text-xl font-black text-foreground mt-1">{promotions.total}</div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Active Live</span>
              <div className="text-xl font-black text-emerald-500 mt-1">{promotions.active}</div>
            </div>
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Expired / Inactive</span>
              <div className="text-xl font-black text-amber-500 mt-1">{promotions.expired}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-surface-muted/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" /> Auto-Downgrade Sweeper Status
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                Running (10m interval)
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When promotions end, students who received temporary upgrades are automatically transitioned back to the Free plan so they never stay upgraded indefinitely.
            </p>
            <div className="pt-1">
              <button
                onClick={handleSweepExpired}
                disabled={sweeping}
                className="w-full py-2 px-3 rounded-xl bg-surface border border-border hover:bg-surface-muted text-foreground text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                <Clock size={14} className={sweeping ? 'animate-spin text-amber-500' : 'text-amber-500'} />
                <span>{sweeping ? 'Executing Immediate Sweep...' : 'Run Force Sweep Now'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Platform Trading & System Health */}
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">Trading Volume & Infrastructure</h3>
                <p className="text-xs text-muted-foreground">Platform trade volume & service connectivity.</p>
              </div>
            </div>
            <Link
              to="/admin/infrastructure"
              className="text-xs text-emerald-500 hover:underline font-semibold flex items-center gap-1"
            >
              System Ops <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Trades Logged</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-foreground">{trading.totalTrades.toLocaleString()}</span>
                <span className="text-xs font-bold text-purple-500">+{trading.tradesToday} today</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Redis Jobs Waiting</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black font-mono text-foreground">{queues.waiting || 0}</span>
                <span className="text-xs font-bold text-emerald-500">{queues.active || 0} active</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border/60 rounded-xl border border-border bg-surface text-xs">
            <div className="p-3 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> PostgreSQL Database
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{infrastructure.database}</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${infrastructure.redis === 'Healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                Redis & BullMQ Engine
              </span>
              <span className={`font-bold ${infrastructure.redis === 'Healthy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {infrastructure.redis}
              </span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Brevo Email Dispatcher
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
