import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data } = await api.get('/analytics/dashboard');
        setAnalytics(data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading dashboard...</div>;
  }

  const stats = analytics || {};
  const equityCurve = stats.equityCurve?.length ? stats.equityCurve : [{ name: 'No trades', profit: 0 }];
  const sessionStats = stats.sessionStats || [];
  const netProfitLoss = Number(stats.netProfitLoss || 0);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-100">Performance Overview</h2>
        <select className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-2.5">
          <option>All Accounts</option>
          <option>Main FTMO Challenge</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Total Net P/L</p>
            <h3 className={`text-2xl font-bold ${netProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {netProfitLoss >= 0 ? '+' : '-'}${Math.abs(netProfitLoss).toFixed(2)}
            </h3>
          </div>
          <div className="p-3 bg-green-500/20 rounded-xl"><TrendingUp size={24} className="text-green-400" /></div>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Win Rate</p>
            <h3 className="text-2xl font-bold text-gray-100">{Number(stats.winRate || 0).toFixed(1)}%</h3>
          </div>
          <div className="p-3 bg-blue-500/20 rounded-xl"><Target size={24} className="text-blue-400" /></div>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Total Trades</p>
            <h3 className="text-2xl font-bold text-gray-100">{stats.totalTrades || 0}</h3>
          </div>
          <div className="p-3 bg-purple-500/20 rounded-xl"><Activity size={24} className="text-purple-400" /></div>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-red-500/30 shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Losses</p>
            <h3 className="text-lg font-bold text-red-500 leading-tight">{stats.losses || 0}</h3>
          </div>
          <div className="p-3 bg-red-500/20 rounded-xl"><AlertTriangle size={24} className="text-red-500" /></div>
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow">
          <h3 className="text-lg font-bold text-gray-100 mb-6">Equity Curve</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" axisLine={false} tickLine={false} />
                <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem' }} />
                <Line type="monotone" dataKey="profit" stroke="#4ade80" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow">
          <h3 className="text-lg font-bold text-gray-100 mb-6">Execution Edge by Session</h3>
          <div className="space-y-6">
            {sessionStats.length === 0 ? (
              <p className="text-gray-500 text-sm">No session data yet. Logged trades will appear here.</p>
            ) : (
              sessionStats.map((session) => (
                <div key={session.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 font-medium">{session.name}</span>
                    <span className="text-green-400 font-bold">{session.winRate.toFixed(1)}% Win</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${session.winRate}%` }}></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
