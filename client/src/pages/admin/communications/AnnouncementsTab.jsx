import React, { useState, useEffect } from 'react';
import { Plus, Users, Globe, Edit3, Trash2, Calendar, Target, Megaphone, X, Send } from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const AnnouncementsTab = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'PUBLISHED',
    priority: 'NORMAL',
    targetAudiences: ['TRADERS'],
    displayLocations: ['DASHBOARD'],
    actionUrl: '',
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/announcements');
      setAnnouncements(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      toast.error('Failed to load announcements');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (announcement = null) => {
    if (announcement) {
      setEditingId(announcement.id);
      setFormData({
        title: announcement.title || '',
        content: announcement.content || '',
        status: announcement.status || 'PUBLISHED',
        priority: announcement.priority || 'NORMAL',
        targetAudiences: Array.isArray(announcement.targetAudiences) ? announcement.targetAudiences : ['TRADERS'],
        displayLocations: Array.isArray(announcement.displayLocations) ? announcement.displayLocations : ['DASHBOARD'],
        actionUrl: announcement.actionUrl || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        content: '',
        status: 'PUBLISHED',
        priority: 'NORMAL',
        targetAudiences: ['TRADERS'],
        displayLocations: ['DASHBOARD'],
        actionUrl: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      return toast.error('Title and content are required');
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await api.put(`/admin/communications/announcements/${editingId}`, formData);
        toast.success('Announcement updated');
      } else {
        await api.post('/admin/communications/announcements', formData);
        toast.success('Announcement created & broadcasted');
      }

      setModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error('Error saving announcement:', err);
      toast.error('Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/admin/communications/announcements/${id}`);
      toast.success('Announcement deleted');
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting announcement:', err);
      toast.error('Failed to delete announcement');
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === 'HIGH') return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
    if (priority === 'URGENT') return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
    return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
  };

  const formatList = (arr) => {
    if (!arr) return 'All';
    if (Array.isArray(arr)) return arr.join(', ');
    return String(arr);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Broadcast Center</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Publish global announcements, maintenance alerts, and product updates.</p>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 min-h-[40px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition shadow-sm"
        >
          <Plus size={18} /> New Announcement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
             <div className="flex justify-center items-center h-48 text-muted-foreground animate-pulse border border-border rounded-2xl bg-surface-muted/40 text-xs">
               Loading Broadcasts...
             </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 sm:p-12 border border-dashed border-border rounded-2xl bg-surface-muted/20 text-muted-foreground text-center">
              <Megaphone size={40} className="mb-3 opacity-40 text-indigo-500" />
              <p className="text-sm font-semibold text-foreground">No Announcements Created Yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">Draft announcements to broadcast platform updates or scheduled maintenance.</p>
              <button 
                onClick={() => handleOpenModal()}
                className="mt-4 text-xs text-emerald-500 font-bold hover:underline"
              >
                + Draft your first update
              </button>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="bg-surface-muted/30 border border-border rounded-2xl p-4 sm:p-5 hover:border-indigo-500/40 transition group shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                       <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${a.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-surface-muted text-muted-foreground border-border'}`}>
                         {a.status}
                       </span>
                       <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${getPriorityColor(a.priority)}`}>
                         {a.priority}
                       </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground break-words">{a.title}</h3>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button 
                      onClick={() => handleOpenModal(a)}
                      className="p-2 text-muted-foreground hover:text-foreground bg-surface rounded-xl transition border border-border"
                      title="Edit Announcement"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(a.id)}
                      className="p-2 text-muted-foreground hover:text-rose-500 bg-surface rounded-xl transition border border-border"
                      title="Delete Announcement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap break-words">{a.content}</p>

                <div className="flex flex-wrap gap-3 sm:gap-4 pt-3 border-t border-border text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-indigo-500 shrink-0" />
                    <span>Audience: <strong className="text-foreground">{formatList(a.targetAudiences)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-indigo-500 shrink-0" />
                    <span>Placement: <strong className="text-foreground">{formatList(a.displayLocations)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:ml-auto">
                    <Calendar size={13} className="text-muted-foreground shrink-0" />
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Info Card */}
        <div className="space-y-6">
           <div className="bg-surface-muted/30 border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
             <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
               <Target size={16} className="text-indigo-500" /> Broadcast Reach &amp; Stats
             </h3>
             <div className="space-y-4 text-xs">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Total Active Announcements</span>
                 <span className="font-bold text-foreground">{announcements.filter(a => a.status === 'PUBLISHED').length}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Total Drafts</span>
                 <span className="font-bold text-foreground">{announcements.filter(a => a.status === 'DRAFT').length}</span>
               </div>
               <div className="w-full bg-surface-muted rounded-full h-1.5 mt-2 overflow-hidden">
                 <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
               </div>
               <p className="text-[11px] text-center text-muted-foreground mt-2">Announcements render directly across trader dashboards and notifications.</p>
             </div>
           </div>
        </div>
      </div>

      {/* New / Edit Announcement Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-border bg-surface-muted/60 shrink-0">
              <h3 className="text-base font-bold text-foreground">
                {editingId ? 'Edit Announcement' : 'Create New Announcement'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block text-foreground font-semibold mb-1">Announcement Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Scheduled System Maintenance on Sunday"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Content / Message</label>
                <textarea
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write the full announcement message for traders..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-foreground font-semibold mb-1">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-surface-muted hover:bg-border text-foreground rounded-xl font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl font-bold transition shadow-sm disabled:opacity-50"
                >
                  <Send size={14} />
                  {submitting ? 'Saving...' : editingId ? 'Update Broadcast' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsTab;
