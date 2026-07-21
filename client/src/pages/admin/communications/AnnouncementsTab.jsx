import React, { useState, useEffect } from 'react';
import { Plus, Users, Globe, Edit3, Trash2, Calendar, Target, ExternalLink, Megaphone } from 'lucide-react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

const AnnouncementsTab = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/admin/communications/announcements');
      setAnnouncements(res.data);
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === 'HIGH') return 'text-amber-500 bg-amber-500/10 border border-amber-500/20';
    if (priority === 'URGENT') return 'text-red-500 bg-red-500/10 border border-red-500/20';
    return 'text-blue-500 bg-blue-500/10 border border-blue-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Broadcast Center</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition shadow-emerald">
          <Plus size={18} /> New Announcement
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
             <div className="flex justify-center p-12 text-gray-500 animate-pulse border border-gray-700/50 rounded-xl bg-gray-800">
               Loading Broadcasts...
             </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-700 rounded-xl bg-gray-800/50 text-gray-500">
              <Megaphone size={40} className="mb-4 opacity-30" />
              <p>You haven't setup any global announcements.</p>
              <button className="mt-4 text-emerald-500 font-medium hover:underline">Draft your first update</button>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition group shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${a.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                         {a.status}
                       </span>
                       <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${getPriorityColor(a.priority)}`}>
                         {a.priority}
                       </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-200">{a.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-1.5 text-gray-500 hover:text-white bg-gray-900 rounded-lg transition"><Edit3 size={16} /></button>
                    <button className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-900 rounded-lg transition"><Trash2 size={16} /></button>
                  </div>
                </div>

                <p className="text-sm text-gray-400 line-clamp-2">{a.content}</p>

                <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-700/50 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users size={14} />
                    <span>Audience: <strong>{a.targetAudiences.join(', ')}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Globe size={14} />
                    <span>Placement: <strong>{a.displayLocations.join(', ')}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
                    <Calendar size={14} />
                    <span>Added {new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
           <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-sm">
             <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
               <Target size={16} className="text-indigo-400" /> Broadcast Reach
             </h3>
             <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-sm text-gray-400">Total Displayed</span>
                 <span className="font-bold">45.2k</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-gray-400">Total Unique Clicks</span>
                 <span className="font-bold">12.5k</span>
               </div>
               <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                 <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '30%' }}></div>
               </div>
               <p className="text-xs text-center text-gray-500 mt-2">Average 27.6% CTR over last 30 days</p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsTab;
