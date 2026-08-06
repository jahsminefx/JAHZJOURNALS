import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, AlertTriangle, Info, CheckCircle, ShieldAlert, X } from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const NotificationCenterTab = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'INFO',
    isGlobal: true,
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/notifications');
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching notification history:', err);
      toast.error('Failed to load notification history');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      return toast.error('Title and message are required');
    }

    try {
      setSubmitting(true);
      await api.post('/admin/communications/notifications', {
        title: formData.title.trim(),
        message: formData.message.trim(),
        category: formData.category,
        userIds: formData.isGlobal ? [] : [],
      });

      toast.success('Manual notification pushed successfully');
      setModalOpen(false);
      setFormData({ title: '', message: '', category: 'INFO', isGlobal: true });
      fetchNotifications();
    } catch (err) {
      console.error('Error sending notification:', err);
      toast.error('Failed to push notification');
    } finally {
      setSubmitting(false);
    }
  };

  const getIcon = (category) => {
    switch (category) {
      case 'WARNING': return <AlertTriangle className="text-amber-400" size={18} />;
      case 'ERROR': 
      case 'SYSTEM_ALERT': return <ShieldAlert className="text-rose-400" size={18} />;
      case 'SUCCESS': return <CheckCircle className="text-emerald-400" size={18} />;
      default: return <Info className="text-indigo-400" size={18} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400">System Notification Center</h2>
           <p className="text-xs text-gray-400 mt-0.5">Manage infrastructure alerts and push manual in-app notifications globally.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-indigo-600/20"
        >
          <Send size={16} /> Push Manual Notification
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-gray-850 rounded-2xl border border-gray-750 shadow-sm overflow-hidden min-h-[400px]">
            {loading ? (
               <div className="flex justify-center p-12 text-gray-500 animate-pulse text-xs">Fetching alert history...</div>
            ) : notifications.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-16 text-gray-500 border border-dashed border-gray-750 m-6 rounded-2xl text-center">
                 <Bell size={44} className="mb-3 opacity-30 text-indigo-400" />
                 <p className="text-sm font-semibold text-gray-300">No System Notifications Logged</p>
                 <p className="text-xs text-gray-500 mt-1">Manual and automated system alerts will be recorded here.</p>
               </div>
            ) : (
               <div className="divide-y divide-gray-750">
                 {notifications.map(n => (
                   <div key={n.id} className="p-4 hover:bg-gray-800/40 transition flex gap-3 items-start text-xs">
                     <div className="mt-0.5 p-2 bg-gray-900 rounded-xl border border-gray-700/60 shrink-0">
                       {getIcon(n.category)}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-gray-200">{n.title}</h4>
                          <span className="text-[11px] text-gray-500">{new Date(n.createdAt).toLocaleString()}</span>
                       </div>
                       <p className="text-gray-300 leading-relaxed">{n.message}</p>
                       <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-gray-800">
                          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                             <span className="flex items-center gap-1"><Users size={13}/> {n._count?.recipients || 0} Recipients</span>
                             {n.isGlobal && <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">Global Push</span>}
                             <span className="bg-gray-900 px-2 py-0.5 rounded border border-gray-750">{n.type}</span>
                          </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* System Rules Sidebar */}
        <div className="space-y-6">
           <div className="bg-gray-850 border border-gray-750 rounded-2xl p-5 shadow-sm">
             <h3 className="font-bold text-gray-200 text-xs mb-4 flex items-center gap-2 uppercase tracking-wider">
               <AlertTriangle size={16} className="text-amber-400" /> Active Alert Triggers
             </h3>
             <ul className="space-y-2 text-xs text-gray-300">
               <li className="flex justify-between items-center p-2.5 bg-gray-900 rounded-xl border border-gray-750">
                 <span>Subscription Renewal Warnings</span>
                 <CheckCircle size={14} className="text-emerald-400" />
               </li>
               <li className="flex justify-between items-center p-2.5 bg-gray-900 rounded-xl border border-gray-750">
                 <span>AI Usage Rate Thresholds</span>
                 <CheckCircle size={14} className="text-emerald-400" />
               </li>
               <li className="flex justify-between items-center p-2.5 bg-gray-900 rounded-xl border border-gray-750">
                 <span>Support Ticket Reply Notifications</span>
                 <CheckCircle size={14} className="text-emerald-400" />
               </li>
             </ul>
           </div>
        </div>
      </div>

      {/* Push Manual Notification Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-850 border border-gray-750 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-gray-750 bg-gray-900/80">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Send size={18} className="text-indigo-400" /> Push Manual Notification
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Notification Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. New Feature Released: Risk Calculator"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Message Body</label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Type the message sent to users..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Category / Type</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="INFO">INFO (General System Message)</option>
                  <option value="WARNING">WARNING (Maintenance / Alert)</option>
                  <option value="SUCCESS">SUCCESS (Feature Announcement)</option>
                  <option value="SYSTEM_ALERT">SYSTEM ALERT (Urgent Notice)</option>
                </select>
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
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  <Send size={14} />
                  {submitting ? 'Pushing...' : 'Push Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenterTab;
