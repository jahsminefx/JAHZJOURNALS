import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Users, CreditCard, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await api.get('/admin/dashboard');
        setMetrics(data);
      } catch (err) {
        setError('Failed to load dashboard metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-red-500">
        <AlertTriangle className="mb-2" />
        <h3 className="font-bold">Error</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview and real-time metrics.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* User Stats */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-500">
            <Users size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Total Users</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h3 className="text-3xl font-black text-foreground">{metrics.users.totalUsers.toLocaleString()}</h3>
            <span className="text-sm font-medium text-emerald-400">+{metrics.users.newUsersToday} today</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{metrics.users.activeUsers} active</p>
        </div>

        {/* Subscription Stats */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3 text-blue-500">
            <CreditCard size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Subscriptions</span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-muted-foreground">Pro:</span>
              <span className="font-bold text-foreground">{metrics.subscriptions.proUsers}</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-muted-foreground">Starter:</span>
              <span className="font-bold text-foreground">{metrics.subscriptions.starterUsers}</span>
            </div>
            <div className="flex justify-between items-center text-amber-500">
              <span className="text-sm font-medium">Founding:</span>
              <span className="font-bold">{metrics.subscriptions.foundingTraders}</span>
            </div>
          </div>
        </div>

        {/* Trade Stats */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3 text-purple-500">
            <TrendingUp size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Platform Trades</span>
          </div>
          <div className="mt-4 flex flex-col">
            <h3 className="text-3xl font-black text-foreground">{metrics.trading.totalTrades.toLocaleString()}</h3>
            <span className="text-sm font-medium text-purple-400 mt-1">+{metrics.trading.tradesToday} today</span>
          </div>
        </div>

         {/* Infrastructure Stats */}
         <div className="rounded-xl border border-border bg-surface p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 text-orange-500 mb-4">
            <Activity size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Infrastructure</span>
          </div>
          <div className="flex-1 space-y-2 text-sm">
            <div className="flex justify-between items-center">
               <span className="text-muted-foreground">Database</span>
               <span className="text-emerald-400 font-bold">{metrics.infrastructure.database}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-muted-foreground">Redis Queue</span>
               <span className={metrics.infrastructure.redis === 'Healthy' ? 'text-emerald-400 font-bold' : 'text-amber-500 font-bold'}>{metrics.infrastructure.redis}</span>
            </div>
             <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/50">
               <span className="text-muted-foreground">Jobs Waiting</span>
               <span className="font-mono text-foreground font-bold">{metrics.queues.waiting}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
