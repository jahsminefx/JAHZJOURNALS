import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Mail, 
  Send, 
  User, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  ShieldAlert, 
  Tag, 
  UserCheck, 
  Lock, 
  Sparkles,
  Paperclip,
  CheckCheck,
  AlertTriangle,
  ChevronRight,
  MoreVertical,
  X,
  FileText
} from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const ContactMessagesTab = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL' | 'ASSIGNED_TO_ME' | 'OPEN' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED'
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMessages();
    }, 300);
    return () => clearTimeout(timer);
  }, [statusTab, priorityFilter, categoryFilter, search]);

  const fetchStaffUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      const usersList = res.data?.users || (Array.isArray(res.data) ? res.data : []);
      const staff = usersList.filter(u => ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR'].includes(u.role));
      setStaffUsers(staff);
    } catch (err) {
      console.error('Error loading staff users:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusTab !== 'ALL' && statusTab !== 'ASSIGNED_TO_ME') params.status = statusTab;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (search) params.search = search;

      const res = await api.get('/admin/communications/contact', { params });
      let list = Array.isArray(res.data) ? res.data : (res.data?.messages || []);

      if (statusTab === 'ASSIGNED_TO_ME') {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser.id) {
          list = list.filter(m => m.assignedToId === currentUser.id);
        }
      }

      setMessages(list);

      // Auto select first message if none selected
      if (list.length > 0 && !selectedThread) {
        openThread(list[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load support threads');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (threadId) => {
    try {
      setThreadLoading(true);
      const res = await api.get(`/admin/communications/contact/${threadId}`);
      setSelectedThread(res.data);
      
      // Update unread count locally in list
      setMessages(prev => prev.map(m => m.id === threadId ? { ...m, unreadForAdmin: 0 } : m));
      
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load conversation thread');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await api.patch(`/admin/communications/contact/${id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
      if (selectedThread?.id === id) {
        setSelectedThread(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handlePriorityUpdate = async (id, newPriority) => {
    try {
      await api.patch(`/admin/communications/contact/${id}/priority`, { priority: newPriority });
      toast.success(`Priority updated to ${newPriority}`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, priority: newPriority } : m));
      if (selectedThread?.id === id) {
        setSelectedThread(prev => ({ ...prev, priority: newPriority }));
      }
    } catch (error) {
      toast.error('Failed to update priority');
    }
  };

  const handleCategoryUpdate = async (id, newCategory) => {
    try {
      await api.patch(`/admin/communications/contact/${id}/category`, { category: newCategory });
      toast.success(`Category updated to ${newCategory}`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, category: newCategory } : m));
      if (selectedThread?.id === id) {
        setSelectedThread(prev => ({ ...prev, category: newCategory }));
      }
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const handleAssignStaff = async (id, adminId) => {
    try {
      await api.patch(`/admin/communications/contact/${id}/assign`, { adminId: adminId || null });
      toast.success('Assignee updated');
      const assignedUser = staffUsers.find(u => u.id === adminId);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, assignedToId: adminId, assignedTo: assignedUser } : m));
      if (selectedThread?.id === id) {
        setSelectedThread(prev => ({ ...prev, assignedToId: adminId, assignedTo: assignedUser }));
      }
    } catch (error) {
      toast.error('Failed to update assignment');
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread) return;

    try {
      setSendingReply(true);
      const res = await api.post(`/admin/communications/contact/${selectedThread.id}/reply`, {
        message: replyText.trim(),
        isInternal: isInternalNote,
      });

      toast.success(isInternalNote ? 'Internal note added' : 'Reply sent to customer');
      setReplyText('');
      setIsInternalNote(false);
      
      // Refresh thread
      openThread(selectedThread.id);
    } catch (error) {
      toast.error('Failed to send response');
    } finally {
      setSendingReply(false);
    }
  };

  const getPriorityBadge = (priority) => {
    const map = {
      URGENT: 'bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold',
      HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-semibold',
      NORMAL: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      LOW: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return map[priority] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getStatusBadge = (status) => {
    const map = {
      OPEN: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold',
      IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-semibold',
      WAITING_FOR_USER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      RESOLVED: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      CLOSED: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return map[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-[780px] bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-800/80 border-b border-gray-700/80 backdrop-blur-md">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar bg-gray-900/80 p-1 rounded-xl border border-gray-700/60">
          {[
            { id: 'ALL', label: 'Inbox' },
            { id: 'ASSIGNED_TO_ME', label: 'Assigned to Me' },
            { id: 'OPEN', label: 'Open' },
            { id: 'WAITING_FOR_USER', label: 'Awaiting User' },
            { id: 'RESOLVED', label: 'Resolved' },
            { id: 'CLOSED', label: 'Closed' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setStatusTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusTab === t.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Select Filters */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations, customers, subjects..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="GENERAL">General Inquiry</option>
            <option value="TECHNICAL">Technical Support</option>
            <option value="BILLING">Billing & Accounts</option>
            <option value="FEATURE_REQUEST">Feature Request</option>
            <option value="BUG_REPORT">Bug Report</option>
          </select>
        </div>
      </div>

      {/* Main 2-Pane Workspace */}
      <div className="flex flex-1 min-h-0">
        {/* Left Pane: Conversation List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-gray-800 bg-gray-900/60 overflow-y-auto divide-y divide-gray-800/60 shrink-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
              <span className="text-xs">Loading conversations...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-gray-500">
              <Mail size={36} className="mb-2 opacity-30 text-indigo-400" />
              <p className="text-xs font-semibold text-gray-300">No Conversations Found</p>
              <p className="text-xs text-gray-500 mt-1">Try resetting your filters or search terms.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isSelected = selectedThread?.id === m.id;
              const isUnread = m.unreadForAdmin > 0;
              const customerName = m.name || m.user?.name || 'Guest User';
              const customerEmail = m.email || m.user?.email || '';

              return (
                <div
                  key={m.id}
                  onClick={() => openThread(m.id)}
                  className={`p-4 cursor-pointer transition-all relative group ${
                    isSelected
                      ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                      : isUnread
                      ? 'bg-gray-850/80 hover:bg-gray-800'
                      : 'hover:bg-gray-800/40'
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs shrink-0">
                        {customerName[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-semibold text-gray-200'}`}>
                        {customerName}
                      </span>
                    </div>

                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(m.lastMessageAt || m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Subject */}
                  <h4 className={`text-xs mb-1 truncate ${isUnread ? 'font-bold text-indigo-300' : 'font-medium text-gray-300'}`}>
                    {m.subject || 'No Subject'}
                  </h4>

                  {/* Preview Text */}
                  <p className="text-[11px] text-gray-400 line-clamp-1 mb-2.5">
                    {m.message}
                  </p>

                  {/* Badges Row */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full border ${getStatusBadge(m.status)}`}>
                        {m.status}
                      </span>
                      {m.priority && m.priority !== 'NORMAL' && (
                        <span className={`px-1.5 py-0.5 rounded border ${getPriorityBadge(m.priority)}`}>
                          {m.priority}
                        </span>
                      )}
                    </div>

                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20 animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Pane: Active Thread Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
          {!selectedThread ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500 p-8 text-center">
              <MessageSquare size={48} className="mb-3 opacity-30 text-indigo-400" />
              <h3 className="text-sm font-bold text-gray-300">Select a Conversation</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Choose a customer thread from the inbox list to manage responses, staff notes, and ticket status.
              </p>
            </div>
          ) : threadLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              <span className="text-xs font-semibold">Loading conversation thread...</span>
            </div>
          ) : (
            <>
              {/* Thread Header Toolbar */}
              <div className="p-4 bg-gray-800/90 border-b border-gray-700/80 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-full ${getStatusBadge(selectedThread.status)}`}>
                      {selectedThread.status}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      Category: <span className="text-gray-200 font-semibold">{selectedThread.category}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate">{selectedThread.subject}</h3>
                </div>

                {/* Interactive Controls Bar */}
                <div className="flex items-center gap-2">
                  {/* Status Selector */}
                  <select
                    value={selectedThread.status}
                    onChange={(e) => handleStatusUpdate(selectedThread.id, e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1 font-semibold focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="OPEN">Status: OPEN</option>
                    <option value="IN_PROGRESS">Status: IN_PROGRESS</option>
                    <option value="WAITING_FOR_USER">Status: WAITING_FOR_USER</option>
                    <option value="RESOLVED">Status: RESOLVED</option>
                    <option value="CLOSED">Status: CLOSED</option>
                  </select>

                  {/* Priority Selector */}
                  <select
                    value={selectedThread.priority}
                    onChange={(e) => handlePriorityUpdate(selectedThread.id, e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1 font-semibold focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="LOW">Priority: LOW</option>
                    <option value="NORMAL">Priority: NORMAL</option>
                    <option value="HIGH">Priority: HIGH</option>
                    <option value="URGENT">Priority: URGENT</option>
                  </select>

                  {/* Assignee Selector */}
                  <select
                    value={selectedThread.assignedToId || ''}
                    onChange={(e) => handleAssignStaff(selectedThread.id, e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1 font-semibold focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffUsers.map(s => (
                      <option key={s.id} value={s.id}>Assign: {s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conversation Messages Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-950/40">
                {/* Customer Details Card */}
                <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                      {selectedThread.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-gray-200">{selectedThread.name}</div>
                      <div className="text-[11px] text-gray-400">{selectedThread.email}</div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-gray-400">
                    <div>Opened: {new Date(selectedThread.createdAt).toLocaleDateString()}</div>
                    {selectedThread.assignedTo && (
                      <div className="text-indigo-400 font-semibold">Assigned: {selectedThread.assignedTo.name}</div>
                    )}
                  </div>
                </div>

                {/* Unified Stream: Customer messages, Admin replies, Internal Notes */}
                {(() => {
                  const combinedStream = [];

                  // Public thread messages
                  if (selectedThread.threads && selectedThread.threads.length > 0) {
                    selectedThread.threads.forEach(t => {
                      combinedStream.push({ ...t, itemType: 'THREAD' });
                    });
                  } else if (selectedThread.message) {
                    combinedStream.push({
                      id: 'initial',
                      senderType: 'USER',
                      senderName: selectedThread.name,
                      message: selectedThread.message,
                      createdAt: selectedThread.createdAt,
                      itemType: 'THREAD'
                    });
                  }

                  // Staff internal notes
                  if (selectedThread.internalNotes && selectedThread.internalNotes.length > 0) {
                    selectedThread.internalNotes.forEach(n => {
                      combinedStream.push({ ...n, message: n.content, itemType: 'INTERNAL_NOTE' });
                    });
                  }

                  // Sort by createdAt
                  combinedStream.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                  return combinedStream.map((item) => {
                    if (item.itemType === 'INTERNAL_NOTE') {
                      return (
                        <div key={item.id} className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-2xl text-xs space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between text-amber-400 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Lock size={13} />
                              Internal Staff Note — {item.author?.name || 'Support Staff'} ({item.author?.role || 'Staff'})
                            </span>
                            <span className="text-[10px] text-amber-500 font-normal">
                              {formatTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-amber-100/90 whitespace-pre-wrap leading-relaxed">
                            {item.message}
                          </p>
                        </div>
                      );
                    }

                    const isUser = item.senderType === 'USER';

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col ${isUser ? 'items-start' : 'items-end'} space-y-1`}
                      >
                        <div className="flex items-center gap-2 px-1 text-[10px] text-gray-400 font-medium">
                          <span>{isUser ? item.senderName || selectedThread.name : item.senderName || 'Support Team'}</span>
                          <span>•</span>
                          <span>{formatTime(item.createdAt)}</span>
                        </div>

                        <div
                          className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-none'
                              : 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                          }`}
                        >
                          {item.message}

                          {item.attachments && item.attachments.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-white/20 flex flex-wrap gap-2">
                              {item.attachments.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-black/20 hover:bg-black/40 text-[11px] transition-colors"
                                >
                                  <Paperclip size={12} />
                                  Attachment #{i + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}

                <div ref={chatBottomRef} />
              </div>

              {/* Dual-Mode Reply Component */}
              <form onSubmit={handleSendReply} className="p-4 bg-gray-800/90 border-t border-gray-700/80 space-y-3">
                {/* Reply Mode Toggle Tabs */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !isInternalNote
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <MessageSquare size={13} />
                    Reply to Customer
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      isInternalNote
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Lock size={13} />
                    Internal Staff Note (Staff Only)
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isInternalNote
                        ? 'Type an internal note visible ONLY to support staff...'
                        : 'Type your response to the customer...'
                    }
                    className={`w-full border rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none transition-colors resize-none ${
                      isInternalNote
                        ? 'bg-amber-950/20 border-amber-600/40 focus:border-amber-500'
                        : 'bg-gray-900 border-gray-700 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-400">
                    {isInternalNote ? '🔒 Note will be saved to staff log' : `📬 Response will notify ${selectedThread.name}`}
                  </span>

                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg disabled:opacity-50 ${
                      isInternalNote
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                    }`}
                  >
                    <Send size={13} />
                    {sendingReply ? 'Saving...' : isInternalNote ? 'Save Note' : 'Send Response'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactMessagesTab;
