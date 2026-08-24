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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-700 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Mailbox className="text-emerald-400" size={22} /> Brevo Email Campaigns
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Dispatch mass email campaigns and product updates directly via Brevo API.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
        >
          <Plus size={16} /> Create Campaign
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-800/40 border border-dashed border-gray-700 rounded-2xl">
          <Mailbox className="text-gray-500 mb-3" size={40} />
          <h3 className="text-sm font-bold text-gray-200">No Email Campaigns Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mt-1 mb-4">
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
            <div key={c.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    c.status === 'SENT' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}>
                    {c.status}
                  </span>
                  <span className="bg-gray-800 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-700">
                    Segment: {c.segment}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-100">{c.title}</h3>
                <p className="text-xs text-gray-400">Subject: <span className="text-gray-300 font-medium">{c.subject}</span></p>
                <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
                  <span className="flex items-center gap-1"><Users size={13} /> {c.recipientCount || 0} Recipients</span>
                  <span className="flex items-center gap-1"><Clock size={13} /> Created {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {c.status !== 'SENT' && (
                  <button
                    onClick={() => handleSend(c.id)}
                    disabled={sendingId === c.id}
                    className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Send size={14} /> {sendingId === c.id ? 'Sending...' : 'Send Campaign'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Mailbox size={18} className="text-emerald-400" /> Draft New Email Campaign
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Campaign Internal Title</label>
                <input
                  type="text"
                  placeholder="e.g. August Pro Trader Newsletter"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Target Audience Segment</label>
                <select
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ALL">All Active Users</option>
                  <option value="PRO">PRO Plan Subscribers Only</option>
                  <option value="STARTER">STARTER Plan Users Only</option>
                  <option value="FREE">FREE Plan Users Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Email Subject Line</label>
                <input
                  type="text"
                  placeholder="e.g. New AI Risk Rules & Weekly Performance Breakdown"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-300 uppercase">Email HTML Content</label>
                  <span className="text-[10px] text-emerald-400 font-semibold">Supports {"{{user.name}}"} tag</span>
                </div>
                <textarea
                  rows={6}
                  placeholder="<h2>Hello {{user.name}},</h2><p>Here is your weekly update...</p>"
                  value={form.contentHtml}
                  onChange={(e) => setForm({ ...form, contentHtml: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition"
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
