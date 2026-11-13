import React, { useState, useEffect } from 'react';
import { Mailbox, Plus, Send, Trash2, CheckCircle2, Clock, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

const EmailCampaignsTab = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    subject: '',
    segment: 'ALL',
    contentHtml: ''
  });

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/emails');
      setCampaigns(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load email campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.contentHtml) {
      toast.error('Title, subject, and email body are required');
      return;
    }

    try {
      await api.post('/admin/communications/emails', form);
      toast.success('Email campaign draft created');
      setShowModal(false);
      setForm({ title: '', subject: '', segment: 'ALL', contentHtml: '' });
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create campaign');
    }
  };

  const handleSend = async (id) => {
    if (!window.confirm('Send this email campaign to all users in the target segment via Brevo?')) return;
    try {
      setSendingId(id);
      const res = await api.post(`/admin/communications/emails/${id}/send`);
      toast.success(res.data?.message || 'Campaign sent successfully!');
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to send campaign');
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/admin/communications/emails/${id}`);
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete campaign');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Mailbox className="text-emerald-500 shrink-0" size={22} /> Brevo Email Campaigns
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Dispatch mass email campaigns and product updates directly via Brevo API.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto justify-center px-4 py-2.5 min-h-[40px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus size={16} /> Create Campaign
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 sm:p-12 text-center bg-surface-muted/30 border border-dashed border-border rounded-2xl">
          <Mailbox className="text-muted-foreground mb-3" size={40} />
          <h3 className="text-sm font-bold text-foreground">No Email Campaigns Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Create your first mass email draft to reach Pro traders, Starter members, or your entire user base.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Create Draft
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-surface-muted/30 border border-border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    c.status === 'SENT' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  }`}>
                    {c.status}
                  </span>
                  <span className="bg-surface text-foreground text-[10px] font-bold px-2 py-0.5 rounded-md border border-border">
                    Segment: {c.segment}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground break-words">{c.title}</h3>
                <p className="text-xs text-muted-foreground break-words">Subject: <span className="text-foreground font-medium">{c.subject}</span></p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><Users size={13} /> {c.recipientCount || 0} Recipients</span>
                  <span className="flex items-center gap-1"><Clock size={13} /> Created {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
                {c.status !== 'SENT' && (
                  <button
                    onClick={() => handleSend(c.id)}
                    disabled={sendingId === c.id}
                    className="flex-1 md:flex-initial justify-center px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Send size={14} /> {sendingId === c.id ? 'Sending...' : 'Send Campaign'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition border border-border"
                  title="Delete Campaign"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-5 bg-surface-muted/50 shrink-0">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Mailbox size={18} className="text-emerald-500" /> Draft New Email Campaign
              </h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Campaign Internal Title</label>
                <input
                  type="text"
                  placeholder="e.g. August Pro Trader Newsletter"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Target Audience Segment</label>
                <select
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none font-bold"
                >
                  <option value="ALL">All Active Users</option>
                  <optgroup label="Trader Tiers">
                    <option value="FREE">Free Plan Users Only</option>
                    <option value="STARTER">Starter Plan Users Only</option>
                    <option value="PRO">Pro Plan Subscribers Only</option>
                    <option value="STARTER_SYNC">Starter Sync Subscribers Only</option>
                    <option value="PRO_SYNC">Pro Sync Subscribers Only</option>
                  </optgroup>
                  <optgroup label="Mentor Tiers">
                    <option value="MENTOR">All Mentors</option>
                    <option value="MENTOR_PRIVATE_COHORT">Private Cohort Mentors Only</option>
                    <option value="MENTOR_GROWTH">Growth Community Mentors Only</option>
                    <option value="MENTOR_MEGA">Mega Academy Mentors Only</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Email Subject Line</label>
                <input
                  type="text"
                  placeholder="e.g. New AI Risk Rules & Weekly Performance Breakdown"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="block text-xs font-bold text-foreground uppercase">Email HTML Content</label>
                  <span className="text-[10px] text-emerald-500 font-semibold">Supports {"{{user.name}}"} tag</span>
                </div>
                <textarea
                  rows={6}
                  placeholder="<h2>Hello {{user.name}},</h2><p>Here is your weekly update...</p>"
                  value={form.contentHtml}
                  onChange={(e) => setForm({ ...form, contentHtml: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground font-mono focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-surface-muted hover:bg-border text-foreground rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition"
                >
                  Save Campaign Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailCampaignsTab;
