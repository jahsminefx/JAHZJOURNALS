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
    return <div className="p-12 text-center text-xs text-muted-foreground">Loading settings...</div>;
  }

  const { brevo = {}, adminEmail = 'jahzjournals@gmail.com' } = data || {};

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-surface-muted/30 border border-border rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Settings className="text-muted-foreground shrink-0" size={22} />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">Global Communication Settings</h3>
              <p className="text-xs text-muted-foreground">Manage Brevo API status, executive digest briefings, and retention rules.</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50 shrink-0"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="space-y-6">
          {/* Section 1: Weekly Executive Digest */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
            <div>
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <BarChart3 size={16} className="text-emerald-500 shrink-0" /> Executive Digest
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Automated Monday morning briefing for Super Admin covering signups, active volume, revenue, and platform health.
              </p>
            </div>

            <div className="md:col-span-2 space-y-4 bg-background p-4 sm:p-5 rounded-xl border border-border min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Recipient Email</span>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Mail size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-mono font-bold text-foreground break-all">{adminEmail}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      Designated Super Admin
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface-muted border border-border px-3 py-1.5 rounded-lg self-start sm:self-auto shrink-0">
                  <Clock size={13} className="text-sky-500" />
                  <span>Every Monday &bull; 08:00 UTC</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Sends automated 7-day retrospective metrics directly to your inbox.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadPreview}
                    disabled={loadingPreview}
                    className="flex-1 sm:flex-initial justify-center px-3 py-2 bg-surface hover:bg-surface-muted text-foreground border border-border text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Eye size={13} /> {loadingPreview ? 'Loading...' : 'Preview Metrics'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendDigestNow}
                    disabled={sendingDigest}
                    className="flex-1 sm:flex-initial justify-center px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={13} /> {sendingDigest ? 'Dispatching...' : 'Send Digest Now'}
                  </button>
                </div>
              </div>

              {/* In-Line Preview Modal / Box if loaded */}
              {digestPreview && (
                <div className="mt-4 p-4 rounded-xl bg-surface-muted/50 border border-border space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-bold text-sky-500">
                      7-Day Metric Snapshot ({digestPreview.periodStart} &mdash; {digestPreview.periodEnd})
                    </span>
                    <button
                      type="button"
                      onClick={() => setDigestPreview(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-surface p-2.5 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">New Signups</div>
                      <div className="text-lg font-bold text-emerald-500">+{digestPreview.users?.newThisWeek || 0}</div>
                      <div className="text-[10px] text-muted-foreground">{digestPreview.users?.total || 0} Total</div>
                    </div>
                    <div className="bg-surface p-2.5 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">Weekly Trades</div>
                      <div className="text-lg font-bold text-sky-500">{digestPreview.trades?.totalThisWeek || 0}</div>
                      <div className="text-[10px] text-muted-foreground">{digestPreview.trades?.winRate || '0.0'}% Win Rate</div>
                    </div>
                    <div className="bg-surface p-2.5 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">Revenue (USD)</div>
                      <div className="text-lg font-bold text-purple-500">${(digestPreview.financials?.revenueUsd || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">Fee: ${(digestPreview.financials?.platformFeeUsd || 0).toFixed(2)}</div>
                    </div>
                    <div className="bg-surface p-2.5 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase">DB Latency</div>
                      <div className="text-lg font-bold text-emerald-500">{digestPreview.health?.dbLatencyMs || 0}ms</div>
                      <div className="text-[10px] text-muted-foreground">Uptime: {digestPreview.health?.uptimeFormatted}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Section 2: Brevo API Integration Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
            <div>
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Zap size={16} className="text-emerald-500 shrink-0" /> Brevo API Engine
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Reads <code className="text-emerald-500 bg-surface-muted px-1 py-0.5 rounded">BREVO_API_KEY</code> from environment.
              </p>
            </div>

            <div className="md:col-span-2 space-y-4 bg-background p-4 rounded-xl border border-border min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${brevo.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-xs font-bold text-foreground">
                    Status: {brevo.status || (brevo.isConfigured ? 'Brevo API Connected' : 'Brevo API Not Configured')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground break-all">
                  Sender: <span className="text-foreground font-semibold">{brevo.senderName}</span> ({brevo.senderEmail})
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !brevo.isConfigured}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={13} /> {testing ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Section 3: Data Retention & Cleanup */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
            <div>
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" /> Data Retention Rules
              </h4>
              <p className="text-xs text-muted-foreground mt-1">Configure automated archiving for support messages and old logs.</p>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Auto-archive resolved support threads (Days)
                </label>
                <input
                  type="number"
                  value={form.autoArchiveDays}
                  onChange={(e) => setForm({ ...form, autoArchiveDays: parseInt(e.target.value) || 30 })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Auto-delete old announcement logs (Months)
                </label>
                <input
                  type="number"
                  value={form.autoDeleteAnnouncementsMonths}
                  onChange={(e) => setForm({ ...form, autoDeleteAnnouncementsMonths: parseInt(e.target.value) || 6 })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
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
