import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreVertical, Archive, AlertCircle, MessageSquare, Plus, Check, Mail } from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const ContactMessagesTab = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMessages, setSelectedMessages] = useState([]);

  useEffect(() => {
    fetchMessages();
  }, [statusFilter]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/contact', {
        params: { status: statusFilter }
      });
      setMessages(res.data);
    } catch (error) {
      toast.error('Failed to load contact messages');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id) => {
    if (selectedMessages.includes(id)) {
      setSelectedMessages(selectedMessages.filter(m => m !== id));
    } else {
      setSelectedMessages([...selectedMessages, id]);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      NEW: 'bg-emerald-500/20 text-emerald-400',
      OPEN: 'bg-blue-500/20 text-blue-400',
      WAITING: 'bg-amber-500/20 text-amber-400',
      REPLIED: 'bg-green-500/20 text-green-400',
      CLOSED: 'bg-gray-500/20 text-gray-400',
      SPAM: 'bg-red-500/20 text-red-500'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search messages..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-gray-900 border border-gray-700 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="OPEN">Open</option>
              <option value="WAITING">Waiting on Customer</option>
              <option value="REPLIED">Replied</option>
              <option value="CLOSED">Closed</option>
              <option value="SPAM">Spam</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>

        {selectedMessages.length > 0 && (
          <div className="flex gap-2 animate-fade-in text-sm border-l border-gray-700 pl-4 ml-4">
            <span className="self-center mr-2 text-gray-400 font-medium">Bulk:</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition">
              <Archive size={14} /> Archive
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition">
              <AlertCircle size={14} /> Spam
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition shadow-indigo">
              <MessageSquare size={14} /> Assign
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-400 animate-pulse">Loading Messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Mail size={48} className="mb-4 opacity-50" />
            <p>No messages found matching your criteria.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900 border-b border-gray-700 text-gray-400">
              <tr>
                <th className="p-4 w-12">
                  <input type="checkbox" className="rounded border-gray-600 bg-gray-700" />
                </th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Subject</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Assigned</th>
                <th className="p-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {messages.map((m) => (
                <tr key={m.id} className="hover:bg-gray-750/30 transition-colors group">
                  <td className="p-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-600 bg-gray-700"
                      checked={selectedMessages.includes(m.id)}
                      onChange={() => toggleSelection(m.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-200">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-300 font-medium truncate max-w-sm">{m.subject}</div>
                    <div className="text-gray-500 text-xs truncate max-w-xs">{m.message}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-gray-400">
                    {m.assignedTo?.name || <span className="italic text-gray-600">Unassigned</span>}
                  </td>
                  <td className="p-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-400 hover:text-white p-1">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ContactMessagesTab;
