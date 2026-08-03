import React, { useState, useEffect } from 'react';
import { Search, Filter, Mail, LifeBuoy, X, Send, User, Calendar, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const ContactMessagesTab = () => {
  const [sourceType, setSourceType] = useState('CONTACT'); // 'CONTACT' | 'SUPPORT'
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [sourceType, statusFilter, search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (sourceType === 'CONTACT') {
        const res = await api.get('/admin/communications/contact', {
          params: { status: statusFilter, search }
        });
        const list = Array.isArray(res.data) ? res.data : (res.data?.messages || []);
        setMessages(list);
      } else {
        const params = new URLSearchParams({ page: 1, limit: 50 });
        if (statusFilter) params.append('status', statusFilter);
        if (search) params.append('search', search);

        const res = await api.get(`/admin/support/tickets?${params.toString()}`);
        setMessages(res.data?.tickets || []);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to load ${sourceType === 'CONTACT' ? 'contact messages' : 'support tickets'}`);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      if (sourceType === 'CONTACT') {
        await api.patch(`/admin/communications/contact/${id}/status`, { status: newStatus });
      } else {
        await api.put(`/admin/support/tickets/${id}`, { status: newStatus });
      }
      toast.success('Status updated');
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
      if (selectedItem?.id === id) {
        setSelectedItem(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedItem) return;

    try {
      setSendingReply(true);
      if (sourceType === 'CONTACT') {
        await api.post(`/admin/communications/contact/${selectedItem.id}/reply`, { message: replyText });
      } else {
        await api.post('/admin/support/notes', { 
          ticketId: selectedItem.id, 
          userId: selectedItem.userId, 
          content: replyText 
        });
      }
      toast.success('Reply sent successfully');
      setReplyText('');
      fetchData();
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      NEW: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      WAITING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      WAITING_ON_USER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      PENDING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      REPLIED: 'bg-green-500/20 text-green-400 border-green-500/30',
      RESOLVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      CLOSED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      SPAM: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
        {/* Source Toggle Tabs */}
        <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700 self-start md:self-auto">
          <button
            onClick={() => { setSourceType('CONTACT'); setSelectedItem(null); }}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              sourceType === 'CONTACT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Mail size={14} />
            Website Contact Messages
          </button>
          <button
            onClick={() => { setSourceType('SUPPORT'); setSelectedItem(null); }}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              sourceType === 'SUPPORT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <LifeBuoy size={14} />
            Support Tickets
          </button>
        </div>

        <div className="flex flex-1 gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${sourceType === 'CONTACT' ? 'contact messages' : 'support tickets'}...`}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-gray-900 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="">All Statuses</option>
              {sourceType === 'CONTACT' ? (
                <>
                  <option value="NEW">New</option>
                  <option value="OPEN">Open</option>
                  <option value="WAITING">Waiting</option>
                  <option value="REPLIED">Replied</option>
                  <option value="CLOSED">Closed</option>
                  <option value="SPAM">Spam</option>
                </>
              ) : (
                <>
                  <option value="OPEN">Open</option>
                  <option value="PENDING">Pending</option>
                  <option value="WAITING_ON_USER">Awaiting User</option>
                  <option value="RESOLVED">Resolved</option>
                </>
              )}
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm overflow-hidden min-h-[450px]">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-400 animate-pulse text-sm">
            Loading {sourceType === 'CONTACT' ? 'Contact Messages' : 'Support Tickets'}...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Mail size={44} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No messages found matching your criteria.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700 text-gray-400 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Customer / Sender</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/60">
              {messages.map((m) => {
                const customerName = m.name || m.user?.name || 'Guest User';
                const customerEmail = m.email || m.user?.email || 'N/A';
                const subject = m.subject || 'No Subject';
                const previewText = m.message || m.description || '';

                return (
                  <tr 
                    key={m.id} 
                    onClick={() => setSelectedItem(m)}
                    className="hover:bg-gray-750/40 cursor-pointer transition-colors group"
                  >
                    <td className="p-4">
                      <div className="font-bold text-gray-100">{customerName}</div>
                      <div className="text-xs text-gray-400">{customerEmail}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-200 font-medium truncate max-w-md">{subject}</div>
                      <div className="text-gray-400 text-xs truncate max-w-xs">{previewText}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${getStatusColor(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedItem(m); }}
                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold transition-all border border-indigo-500/30"
                      >
                        View & Reply
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Message / Ticket Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-700 bg-gray-900/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-xs font-bold border rounded-full ${getStatusColor(selectedItem.status)}`}>
                    {selectedItem.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(selectedItem.createdAt).toLocaleString()}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-100 mt-2">{selectedItem.subject || 'No Subject'}</h2>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
              {/* Customer Card */}
              <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-700/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                    {(selectedItem.name || selectedItem.user?.name || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-gray-100">{selectedItem.name || selectedItem.user?.name || 'Guest User'}</div>
                    <div className="text-xs text-gray-400">{selectedItem.email || selectedItem.user?.email || 'No Email'}</div>
                  </div>
                </div>

                {/* Status Dropdown inside Modal */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">Status:</span>
                  <select
                    value={selectedItem.status}
                    onChange={(e) => handleStatusUpdate(selectedItem.id, e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {sourceType === 'CONTACT' ? (
                      <>
                        <option value="NEW">NEW</option>
                        <option value="OPEN">OPEN</option>
                        <option value="WAITING">WAITING</option>
                        <option value="REPLIED">REPLIED</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="SPAM">SPAM</option>
                      </>
                    ) : (
                      <>
                        <option value="OPEN">OPEN</option>
                        <option value="PENDING">PENDING</option>
                        <option value="WAITING_ON_USER">AWAITING USER</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Message Content</div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/60 text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {selectedItem.message || selectedItem.description || 'No message content provided.'}
                </div>
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendReply} className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Send Response</div>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response to the customer..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <Send size={14} />
                    {sendingReply ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactMessagesTab;
