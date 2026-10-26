import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Mail, CheckCircle2, Zap, Send, BarChart3, Clock, Eye, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

const SettingsTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [digestPreview, setDigestPreview] = useState(null);

  const [form, setForm] = useState({
    autoArchiveDays: 30,
    autoDeleteAnnouncementsMonths: 6
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/settings');
      setData(res.data);
      if (res.data?.settings) {
        setForm({
          autoArchiveDays: res.data.settings.autoArchiveDays || 30,
          autoDeleteAnnouncementsMonths: res.data.settings.autoDeleteAnnouncementsMonths || 6
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load communication settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const res = await api.post('/admin/communications/settings/test-brevo');
      toast.success(res.data?.message || 'Test email dispatched successfully via Brevo!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Brevo API connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put('/admin/communications/settings', form);
      toast.success('Communication settings updated');
      fetchSettings();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendDigestNow = async () => {
    try {
      setSendingDigest(true);
      const res = await api.post('/admin/executive-digest/send-now');
      if (res.data?.success) {
        toast.success(`Executive digest dispatched to ${res.data.recipient}!`);
      } else {
        toast.error(res.data?.message || 'Failed to dispatch digest.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error sending executive digest');
    } finally {
      setSendingDigest(false);
    }
  };

  const handleLoadPreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await api.get('/admin/executive-digest/preview');
      if (res.data?.success) {
        setDigestPreview(res.data.metrics);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch digest preview metrics');
    } finally {
      setLoadingPreview(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-gray-400">Loading settings...</div>;
  }

  const { brevo = {}, adminEmail = 'jahzjournals@gmail.com' } = data || {};

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-700 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Settings className="text-gray-400" size={24} />
            <div>
              <h3 className="text-base font-bold text-gray-100">Global Communication Settings</h3>
              <p className="text-xs text-gray-400">Manage Brevo API status, executive digest briefings, and retention rules.</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="space-y-6">
          {/* Section 1: Weekly Executive Digest */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div>
              <h4 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
                <BarChart3 size={16} className="text-emerald-400" /> Executive Digest
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Automated Monday morning briefing for Super Admin covering signups, active volume, revenue, and platform health.
              </p>
            </div>

            <div className="col-span-2 space-y-4 bg-gray-950 p-5 rounded-xl border border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Recipient Email</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Mail size={14} className="text-emerald-400" />
                    <span className="text-sm font-mono font-bold text-gray-100">{adminEmail}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      Designated Super Admin
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
                  <Clock size={13} className="text-sky-400" />
                  <span>Every Monday &bull; 08:00 UTC</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  Sends automated 7-day retrospective metrics directly to your inbox.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadPreview}
                    disabled={loadingPreview}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Eye size={13} /> {loadingPreview ? 'Loading...' : 'Preview Metrics'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendDigestNow}
                    disabled={sendingDigest}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={13} /> {sendingDigest ? 'Dispatching...' : 'Send Digest Now'}
                  </button>
                </div>
              </div>

              {/* In-Line Preview Modal / Box if loaded */}
              {digestPreview && (
                <div className="mt-4 p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-xs font-bold text-sky-400">
                      7-Day Metric Snapshot ({digestPreview.periodStart} &mdash; {digestPreview.periodEnd})
                    </span>
                    <button
                      type="button"
                      onClick={() => setDigestPreview(null)}
                      className="text-gray-500 hover:text-gray-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                      <div className="text-[10px] text-gray-400 uppercase">New Signups</div>
                      <div className="text-lg font-bold text-emerald-400">+{digestPreview.users?.newThisWeek || 0}</div>
                      <div className="text-[10px] text-gray-500">{digestPreview.users?.total || 0} Total</div>
                    </div>
                    <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                      <div className="text-[10px] text-gray-400 uppercase">Weekly Trades</div>
                      <div className="text-lg font-bold text-sky-400">{digestPreview.trades?.totalThisWeek || 0}</div>
                      <div className="text-[10px] text-gray-500">{digestPreview.trades?.winRate || '0.0'}% Win Rate</div>
                    </div>
                    <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                      <div className="text-[10px] text-gray-400 uppercase">Revenue (USD)</div>
                      <div className="text-lg font-bold text-purple-400">${(digestPreview.financials?.revenueUsd || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-gray-500">Fee: ${(digestPreview.financials?.platformFeeUsd || 0).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                      <div className="text-[10px] text-gray-400 uppercase">DB Latency</div>
                      <div className="text-lg font-bold text-emerald-400">{digestPreview.health?.dbLatencyMs || 0}ms</div>
                      <div className="text-[10px] text-gray-500">Uptime: {digestPreview.health?.uptimeFormatted}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* Section 2: Brevo API Integration Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div>
              <h4 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
                <Zap size={16} className="text-emerald-400" /> Brevo API Engine
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Reads <code className="text-emerald-400 bg-gray-950 px-1 py-0.5 rounded">BREVO_API_KEY</code> from environment.
              </p>
            </div>

            <div className="col-span-2 space-y-4 bg-gray-950 p-4 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${brevo.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-xs font-bold text-gray-200">
                    Status: {brevo.status || (brevo.isConfigured ? 'Brevo API Connected' : 'Brevo API Not Configured')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  Sender: <span className="text-gray-200 font-semibold">{brevo.senderName}</span> ({brevo.senderEmail})
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !brevo.isConfigured}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={13} /> {testing ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* Section 3: Data Retention & Cleanup */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div>
              <h4 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" /> Data Retention Rules
              </h4>
              <p className="text-xs text-gray-400 mt-1">Configure automated archiving for support messages and old logs.</p>
            </div>

            <div className="col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Auto-archive resolved support threads (Days)
                </label>
                <input
                  type="number"
                  value={form.autoArchiveDays}
                  onChange={(e) => setForm({ ...form, autoArchiveDays: parseInt(e.target.value) || 30 })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Auto-delete old announcement logs (Months)
                </label>
                <input
                  type="number"
                  value={form.autoDeleteAnnouncementsMonths}
                  onChange={(e) => setForm({ ...form, autoDeleteAnnouncementsMonths: parseInt(e.target.value) || 6 })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
