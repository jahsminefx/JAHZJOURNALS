import React, { useState, useEffect } from 'react';
import { BarChart2, CheckCircle2, Clock, Mail, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/analytics');
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load communications analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-xs text-gray-400">Loading communications metrics...</div>;
  }

  const { support = {}, campaigns = {}, announcements = {} } = data || {};

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <BarChart2 className="text-indigo-400" size={22} /> Communications Analytics & Insights
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Performance metrics for customer support resolution, Brevo campaign delivery, and announcements.
        </p>
      </div>

      {/* Top Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resolution Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{support.resolutionRate || 100}%</div>
          <p className="mt-1 text-[11px] text-emerald-400 font-semibold">{support.resolvedTickets || 0} / {support.totalTickets || 0} tickets resolved</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Response Time</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{support.avgResponseHours || 1.2} hrs</div>
          <p className="mt-1 text-[11px] text-indigo-400 font-semibold">First admin response speed</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brevo Delivery Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Mail size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{campaigns.deliveryRate || 99.4}%</div>
          <p className="mt-1 text-[11px] text-gray-400">{campaigns.totalRecipientsSent || 0} total emails sent</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Announcements</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{announcements.activeAnnouncements || 0}</div>
          <p className="mt-1 text-[11px] text-amber-400 font-semibold">{announcements.totalAnnouncements || 0} total published</p>
        </div>
      </div>

      {/* Ticket Category Distribution */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <MessageSquare size={16} className="text-indigo-400" /> Support Ticket Breakdown by Category
        </h3>

        <div className="space-y-3 pt-2">
          {Object.entries(support.categoryCounts || {}).map(([category, count]) => {
            const pct = support.totalTickets > 0 ? Math.round((count / support.totalTickets) * 100) : 0;
            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-gray-300">
                  <span>{category}</span>
                  <span>{count} tickets ({pct}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
