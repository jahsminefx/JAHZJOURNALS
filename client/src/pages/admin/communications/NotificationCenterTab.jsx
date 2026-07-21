import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, AlertTriangle, Info, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const NotificationCenterTab = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/admin/communications/notifications');
      setNotifications(res.data);
    } catch {
      toast.error('Failed to load notification history');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (category) => {
    switch (category) {
      case 'WARNING': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'ERROR': return <ShieldAlert className="text-red-500" size={20} />;
      case 'SUCCESS': return <CheckCircle className="text-emerald-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pl-1">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400">System Notification Center</h2>
           <p className="text-sm text-gray-400 mt-1">Manage infrastructure alerts and fire manual push notifications globally.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition shadow-indigo">
          <Send size={18} /> Push Manual Notification
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm overflow-hidden min-h-[400px]">
            {loading ? (
               <div className="flex justify-center p-12 text-gray-500 animate-pulse">Fetching alerts...</div>
            ) : notifications.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-16 text-gray-500 border border-dashed border-gray-700/50 m-6 rounded-xl">
                 <Bell size={48} className="mb-4 opacity-30" />
                 <p className="text-sm">No recent system notifications.</p>
               </div>
            ) : (
               <div className="divide-y divide-gray-700/50">
                 {notifications.map(n => (
                   <div key={n.id} className="p-5 hover:bg-gray-750/30 transition flex gap-4 items-start">
                     <div className="mt-1 p-2 bg-gray-900 rounded-lg">
                       {getIcon(n.category)}
                     </div>
                     <div className="flex-1">
                       <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-gray-200">{n.title}</h4>
                          <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</span>
                       </div>
                       <p className="text-sm text-gray-400">{n.message}</p>
                       <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700/30">
                          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-gray-500">
                             <span className="flex items-center gap-1.5"><Users size={14}/> {n._count?.recipients || 0} Recipients</span>
                             {n.isGlobal && <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">Global Flag</span>}
                             <span className="bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{n.type}</span>
                          </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-sm">
             <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2">
               <AlertTriangle size={18} className="text-red-400" /> Active System Rules
             </h3>
             <ul className="space-y-3 text-sm text-gray-400">
               <li className="flex justify-between items-center p-2 bg-gray-900 rounded-lg border border-gray-700/50">
                 <span>Subscription Expirations</span>
                 <CheckCircle size={14} className="text-emerald-500" />
               </li>
               <li className="flex justify-between items-center p-2 bg-gray-900 rounded-lg border border-gray-700/50">
                 <span>AI Burn Rate Warning</span>
                 <CheckCircle size={14} className="text-emerald-500" />
               </li>
               <li className="flex justify-between items-center p-2 bg-gray-900 rounded-lg border border-gray-700/50">
                 <span>Weekly Coach Ready Alerts</span>
                 <CheckCircle size={14} className="text-emerald-500" />
               </li>
             </ul>
           </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenterTab;
