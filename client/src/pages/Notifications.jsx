import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  MessageSquare, 
  Sparkles, 
  AlertTriangle, 
  Info, 
  Trash2, 
  ExternalLink,
  Filter,
  CheckCircle2
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'SUPPORT_REPLY' | 'SYSTEM'

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (recipientId) => {
    try {
      await api.put(`/notifications/${recipientId}/read`);
      setNotifications(prev => prev.map(item => 
        item.id === recipientId ? { ...item, status: 'READ', readAt: new Date().toISOString() } : item
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      toast.success('Marked as read');
    } catch (error) {
      toast.error('Could not update notification status');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(item => ({ ...item, status: 'READ', readAt: new Date().toISOString() })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Could not mark all as read');
    }
  };

  const handleDelete = async (recipientId) => {
    try {
      await api.delete(`/notifications/${recipientId}`);
      setNotifications(prev => prev.filter(item => item.id !== recipientId));
      toast.success('Notification removed');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const getCategoryIcon = (type, category) => {
    if (type === 'SUPPORT_REPLY') return <MessageSquare className="w-5 h-5 text-indigo-400" />;
    if (category === 'SYSTEM_ALERT' || category === 'WARNING') return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    if (category === 'AI_COACH') return <Sparkles className="w-5 h-5 text-cyan-400" />;
    return <Info className="w-5 h-5 text-emerald-400" />;
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(item => {
    if (activeTab === 'UNREAD') return item.status === 'UNREAD';
    if (activeTab === 'SUPPORT_REPLY') return item.notification?.type === 'SUPPORT_REPLY';
    if (activeTab === 'SYSTEM') return item.notification?.type !== 'SUPPORT_REPLY';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/80 p-6 rounded-2xl border border-border/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              Notifications
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {unreadCount} Unread
                </span>
              )}
            </h1>
            <p className="text-sm text-muted">Stay updated with support replies, system updates, and risk alerts.</p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 font-medium text-sm transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'ALL'
              ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20'
              : 'bg-surface-muted/50 text-muted hover:text-foreground hover:bg-surface-muted'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('UNREAD')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'UNREAD'
              ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20'
              : 'bg-surface-muted/50 text-muted hover:text-foreground hover:bg-surface-muted'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setActiveTab('SUPPORT_REPLY')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'SUPPORT_REPLY'
              ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20'
              : 'bg-surface-muted/50 text-muted hover:text-foreground hover:bg-surface-muted'
          }`}
        >
          Support & Replies
        </button>
        <button
          onClick={() => setActiveTab('SYSTEM')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'SYSTEM'
              ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20'
              : 'bg-surface-muted/50 text-muted hover:text-foreground hover:bg-surface-muted'
          }`}
        >
          System & Announcements
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-3" />
          <span>Loading notifications...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-surface/50 rounded-2xl border border-border/40 p-8">
          <div className="h-16 w-16 rounded-full bg-surface-muted flex items-center justify-center text-muted mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-foreground">You're All Caught Up!</h3>
          <p className="text-sm text-muted max-w-sm mt-1">
            No notifications in this category right now. Support replies and system alerts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const notif = item.notification || {};
            const isUnread = item.status === 'UNREAD';

            return (
              <div
                key={item.id}
                className={`group relative flex items-start gap-4 p-5 rounded-2xl border transition-all ${
                  isUnread
                    ? 'bg-surface/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : 'bg-surface/40 border-border/40 hover:bg-surface/70'
                }`}
              >
                {/* Unread Pill Indicator */}
                {isUnread && (
                  <span className="absolute top-5 right-5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                )}

                {/* Category Icon */}
                <div className="h-10 w-10 rounded-xl bg-surface-muted/80 flex items-center justify-center shrink-0 border border-border/50">
                  {getCategoryIcon(notif.type, notif.category)}
                </div>

                {/* Body Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-base font-semibold ${isUnread ? 'text-foreground font-bold' : 'text-foreground/90'}`}>
                      {notif.title || 'Notification'}
                    </h4>
                    <span className="text-xs text-muted shrink-0">
                      • {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-muted/90 leading-relaxed whitespace-pre-wrap">
                    {notif.message}
                  </p>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark as Read
                      </button>
                    )}

                    {notif.actionUrl && (
                      <a
                        href={notif.actionUrl}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        View Details
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-muted hover:text-rose-400 flex items-center gap-1 transition-colors ml-auto opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
