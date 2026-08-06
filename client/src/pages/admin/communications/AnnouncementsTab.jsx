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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Broadcast Center</h2>
          <p className="text-xs text-gray-400 mt-0.5">Publish global announcements, maintenance alerts, and product updates.</p>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} /> New Announcement
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
             <div className="flex justify-center items-center h-48 text-gray-500 animate-pulse border border-gray-800 rounded-2xl bg-gray-900/50 text-xs">
               Loading Broadcasts...
             </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/30 text-gray-500 text-center">
              <Megaphone size={40} className="mb-3 opacity-30 text-indigo-400" />
              <p className="text-sm font-semibold text-gray-300">No Announcements Created Yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">Draft announcements to broadcast platform updates or scheduled maintenance.</p>
              <button 
                onClick={() => handleOpenModal()}
                className="mt-4 text-xs text-emerald-400 font-bold hover:underline"
              >
                + Draft your first update
              </button>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="bg-gray-850 border border-gray-750 rounded-2xl p-5 hover:border-gray-650 transition group shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${a.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-700/50 text-gray-400 border-gray-600/30'}`}>
                         {a.status}
                       </span>
                       <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${getPriorityColor(a.priority)}`}>
                         {a.priority}
                       </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-100">{a.title}</h3>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(a)}
                      className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-xl transition border border-gray-700"
                      title="Edit Announcement"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(a.id)}
                      className="p-2 text-gray-400 hover:text-rose-400 bg-gray-800 rounded-xl transition border border-gray-700"
                      title="Delete Announcement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{a.content}</p>

                <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-750 text-[11px] text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-indigo-400" />
                    <span>Audience: <strong className="text-gray-200">{formatList(a.targetAudiences)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-indigo-400" />
                    <span>Placement: <strong className="text-gray-200">{formatList(a.displayLocations)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Calendar size={13} className="text-gray-500" />
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Info Card */}
        <div className="space-y-6">
           <div className="bg-gray-850 border border-gray-750 rounded-2xl p-5 shadow-sm">
             <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
               <Target size={16} className="text-indigo-400" /> Broadcast Reach & Stats
             </h3>
             <div className="space-y-4 text-xs">
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">Total Active Announcements</span>
                 <span className="font-bold text-gray-100">{announcements.filter(a => a.status === 'PUBLISHED').length}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">Total Drafts</span>
                 <span className="font-bold text-gray-100">{announcements.filter(a => a.status === 'DRAFT').length}</span>
               </div>
               <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
                 <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
               </div>
               <p className="text-[11px] text-center text-gray-400 mt-2">Announcements render directly across trader dashboards and notifications.</p>
             </div>
           </div>
        </div>
      </div>

      {/* New / Edit Announcement Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-850 border border-gray-750 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-gray-750 bg-gray-900/80">
              <h3 className="text-base font-bold text-gray-100">
                {editingId ? 'Edit Announcement' : 'Create New Announcement'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Announcement Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Scheduled System Maintenance on Sunday"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Content / Message</label>
                <textarea
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write the full announcement message for traders..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-750">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-750 hover:bg-gray-700 text-gray-300 rounded-xl font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl font-bold transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
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
