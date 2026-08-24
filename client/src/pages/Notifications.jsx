import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  X,
  Send,
  User,
  ShieldCheck,
  Paperclip,
  Clock
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'SUPPORT_REPLY' | 'SYSTEM'

  // Chat Thread Modal State
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadDetails, setThreadDetails] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [userReplyText, setUserReplyText] = useState('');
  const [sendingUserReply, setSendingUserReply] = useState(false);
  const chatBottomRef = useRef(null);

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

    // Check if URL has threadId query param
    const urlParams = new URLSearchParams(window.location.search);
    const queryThreadId = urlParams.get('threadId');
    if (queryThreadId) {
      openChatModal(queryThreadId);
    }
  }, []);

  useEffect(() => {
    if (threadDetails && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadDetails]);

  const openChatModal = async (threadId) => {
    try {
      setSelectedThreadId(threadId);
      setLoadingThread(true);
      const res = await api.get(`/support/threads/${threadId}`);
      setThreadDetails(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load conversation thread');
      setSelectedThreadId(null);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSendUserReply = async (e) => {
    e.preventDefault();
    if (!userReplyText.trim() || !selectedThreadId) return;

    try {
      setSendingUserReply(true);
      await api.post(`/support/threads/${selectedThreadId}/reply`, {
        message: userReplyText.trim()
      });

      toast.success('Reply sent to support team');
      setUserReplyText('');
      // Refresh thread to show new reply in chat stream
      openChatModal(selectedThreadId);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to post reply');
    } finally {
      setSendingUserReply(false);
    }
  };

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

  const handleViewDetails = async (item, e) => {
    if (e) e.preventDefault();

    // Automatically mark notification as READ if unread
    if (item.status === 'UNREAD') {
      handleMarkAsRead(item.id);
    }

    const notif = item.notification || {};
    const url = notif.actionUrl || '';
    const match = url.match(/threadId=([^&]+)/);
    
    if (match && match[1]) {
      openChatModal(match[1]);
      return;
    }

    if (notif.type === 'SUPPORT_REPLY' || (notif.title && notif.title.toLowerCase().includes('reply'))) {
      // Fetch user's support threads to open matching thread
      try {
        const userThreadsRes = await api.get('/support/threads');
        const userThreads = userThreadsRes.data || [];
        if (userThreads.length > 0) {
          openChatModal(userThreads[0].id);
          return;
        }
      } catch (_) {}
    }

    // Default navigation for non-chat notifications
    if (notif.actionUrl) {
      window.location.href = notif.actionUrl;
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
            className="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors flex items-center gap-2 self-start md:self-auto"
          >
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-4 overflow-x-auto scrollbar-hide">
        {[
          { id: 'ALL', label: `All (${notifications.length})` },
          { id: 'UNREAD', label: `Unread (${unreadCount})` },
          { id: 'SUPPORT_REPLY', label: 'Support & Replies' },
          { id: 'SYSTEM', label: 'System & Announcements' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-muted hover:text-foreground hover:bg-surface/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted animate-pulse">
          Loading notifications...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-surface/30 rounded-2xl border border-dashed border-border">
          <Bell className="w-10 h-10 text-muted/40 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No notifications found</h3>
          <p className="text-xs text-muted mt-1">You're all caught up with your latest alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(item => {
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

                    <button
                      onClick={(e) => handleViewDetails(item, e)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      View Details
                      <ExternalLink className="w-3 h-3" />
                    </button>

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

      {/* Full Interactive Chat Thread Modal */}
      {selectedThreadId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-gray-850 border-b border-gray-700 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Support Conversation
                  </span>
                  {threadDetails && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      threadDetails.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {threadDetails.status}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-100">
                  {threadDetails?.subject || 'Support Conversation'}
                </h3>
              </div>

              <button
                onClick={() => { setSelectedThreadId(null); setThreadDetails(null); }}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Stream Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-950/80">
              {loadingThread ? (
                <div className="p-12 text-center text-xs text-gray-400 animate-pulse">
                  Loading chat history...
                </div>
              ) : !threadDetails ? (
                <div className="p-8 text-center text-xs text-rose-400">
                  Unable to load thread details.
                </div>
              ) : (
                (() => {
                  const messages = [];

                  // Initial user query message
                  if (threadDetails.message) {
                    messages.push({
                      id: 'initial',
                      senderType: 'USER',
                      senderName: threadDetails.name || 'You',
                      message: threadDetails.message,
                      createdAt: threadDetails.createdAt
                    });
                  }

                  // Additional thread replies
                  if (threadDetails.threads && threadDetails.threads.length > 0) {
                    threadDetails.threads.forEach(t => {
                      if (!t.isInternal) {
                        messages.push({
                          id: t.id,
                          senderType: t.senderType,
                          senderName: t.senderType === 'USER' ? (t.senderName || threadDetails.name || 'You') : (t.senderName || 'JAHZJOURNALS Support'),
                          message: t.message,
                          attachments: t.attachments || [],
                          createdAt: t.createdAt
                        });
                      }
                    });
                  }

                  // Sort chronologically
                  messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                  return messages.map(msg => {
                    const isUser = msg.senderType === 'USER';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 px-1 font-medium">
                          {isUser ? <User size={12} className="text-emerald-400" /> : <ShieldCheck size={12} className="text-indigo-400" />}
                          <span>{msg.senderName}</span>
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>

                        <div
                          className={`max-w-md p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-600/10'
                              : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-none shadow-md'
                          }`}
                        >
                          {msg.message}

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-white/20 flex flex-wrap gap-2">
                              {msg.attachments.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-black/20 text-[10px] hover:underline"
                                >
                                  <Paperclip size={11} /> Attachment #{i + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Reply Input Bar */}
            {threadDetails && (
              <form onSubmit={handleSendUserReply} className="p-4 bg-gray-900 border-t border-gray-700 space-y-3">
                <textarea
                  rows={2}
                  value={userReplyText}
                  onChange={(e) => setUserReplyText(e.target.value)}
                  placeholder="Type your reply to the support team..."
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none resize-none"
                  required
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Staff will be notified instantly when you reply.
                  </span>
                  <button
                    type="submit"
                    disabled={sendingUserReply || !userReplyText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                  >
                    <Send size={13} />
                    {sendingUserReply ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
