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
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="min-w-0">
           <h2 className="text-lg sm:text-xl font-bold text-foreground">System Notification Center</h2>
           <p className="text-xs text-muted-foreground mt-0.5">Manage infrastructure alerts, Web Push broadcasts, and daily discipline reminders.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button 
            onClick={async () => {
              try {
                toast.loading('Triggering daily trading reminders...', { id: 'daily-rem' });
                const res = await api.post('/push-notifications/trigger-daily-reminders');
                toast.success(res.data.message || 'Daily reminders dispatched!', { id: 'daily-rem' });
              } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to trigger reminders.', { id: 'daily-rem' });
              }
            }}
            className="flex-1 sm:flex-initial justify-center flex items-center gap-2 px-3.5 py-2.5 min-h-[40px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs transition shadow-sm"
          >
            <Bell size={15} className="shrink-0" /> <span>Send Daily Reminders</span>
          </button>

          <button 
            onClick={() => setModalOpen(true)}
            className="flex-1 sm:flex-initial justify-center flex items-center gap-2 px-4 py-2.5 min-h-[40px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition shadow-sm"
          >
            <Send size={15} className="shrink-0" /> <span>Push Manual Notification</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-surface-muted/30 rounded-2xl border border-border shadow-sm overflow-hidden min-h-[360px]">
            {loading ? (
               <div className="flex justify-center p-12 text-muted-foreground animate-pulse text-xs">Fetching alert history...</div>
            ) : notifications.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-10 sm:p-16 text-muted-foreground border border-dashed border-border m-4 sm:m-6 rounded-2xl text-center">
                 <Bell size={44} className="mb-3 opacity-30 text-indigo-500" />
                 <p className="text-sm font-semibold text-foreground">No System Notifications Logged</p>
                 <p className="text-xs text-muted-foreground mt-1">Manual and automated system alerts will be recorded here.</p>
               </div>
            ) : (
               <div className="divide-y divide-border">
                 {notifications.map(n => (
                   <div key={n.id} className="p-4 hover:bg-surface-muted/50 transition flex gap-3 items-start text-xs">
                     <div className="mt-0.5 p-2 bg-surface rounded-xl border border-border shrink-0">
                       {getIcon(n.category)}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                          <h4 className="font-bold text-foreground break-words">{n.title}</h4>
                          <span className="text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                       </div>
                       <p className="text-foreground/85 leading-relaxed break-words">{n.message}</p>
                       <div className="flex flex-wrap justify-between items-center gap-2 mt-2.5 pt-2 border-t border-border">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                             <span className="flex items-center gap-1"><Users size={13}/> {n._count?.recipients || 0} Recipients</span>
                             {n.isGlobal && <span className="bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">Global Push</span>}
                             <span className="bg-surface px-2 py-0.5 rounded border border-border">{n.type}</span>
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
           <div className="bg-surface-muted/30 border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
             <h3 className="font-bold text-foreground text-xs mb-4 flex items-center gap-2 uppercase tracking-wider">
               <AlertTriangle size={16} className="text-amber-500" /> Active Alert Triggers
             </h3>
             <ul className="space-y-2 text-xs text-foreground">
               <li className="flex justify-between items-center gap-2 p-2.5 bg-surface rounded-xl border border-border">
                 <span>Subscription Renewal Warnings</span>
                 <CheckCircle size={14} className="text-emerald-500 shrink-0" />
               </li>
               <li className="flex justify-between items-center gap-2 p-2.5 bg-surface rounded-xl border border-border">
                 <span>AI Usage Rate Thresholds</span>
                 <CheckCircle size={14} className="text-emerald-500 shrink-0" />
               </li>
               <li className="flex justify-between items-center gap-2 p-2.5 bg-surface rounded-xl border border-border">
                 <span>Support Ticket Reply Notifications</span>
                 <CheckCircle size={14} className="text-emerald-500 shrink-0" />
               </li>
             </ul>
           </div>
        </div>
      </div>

      {/* Push Manual Notification Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-border bg-surface-muted/50 shrink-0">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Send size={18} className="text-indigo-500" /> Push Manual Notification
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block text-foreground font-semibold mb-1">Notification Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. New Feature Released: Risk Calculator"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Message Body</label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Type the message sent to users..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Category / Type</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="INFO">INFO (General System Message)</option>
                  <option value="WARNING">WARNING (Maintenance / Alert)</option>
                  <option value="SUCCESS">SUCCESS (Feature Announcement)</option>
                  <option value="SYSTEM_ALERT">SYSTEM ALERT (Urgent Notice)</option>
                </select>
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
                  className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-sm disabled:opacity-50"
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
