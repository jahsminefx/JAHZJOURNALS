import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, Edit, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const SupportTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        const fetchTickets = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ page, limit: 15 });
                if (search) params.append('search', search);
                if (statusFilter) params.append('status', statusFilter);
                
                const res = await api.get(`/admin/support/tickets?${params.toString()}`);
                setTickets(res.data.tickets);
                setTotal(res.data.total);
            } catch (e) {
                toast.error('Failed fetching ticket schemas');
            } finally {
                setLoading(false);
            }
        };
        const timeout = setTimeout(fetchTickets, 300);
        return () => clearTimeout(timeout);
    }, [page, search, statusFilter]);

    const handleStatusUpdate = async (id, newStatus) => {
       try {
           const res = await api.put(`/admin/support/tickets/${id}`, { status: newStatus });
           toast.success('Ticket trajectory updated');
           setTickets(ts => ts.map(t => t.id === id ? { ...t, status: newStatus } : t));
       } catch (e) {
           toast.error('Mutation failure');
       }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h1 className="text-2xl font-black text-foreground">Support Operations</h1>
              <div className="flex gap-4 w-full sm:w-auto">
                 <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setPage(1);}} className="bg-surface border border-border rounded-lg text-sm px-3 py-2 outline-none">
                    <option value="">All Tiers</option>
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending Admin Space</option>
                    <option value="WAITING_ON_USER">Awaiting User</option>
                    <option value="RESOLVED">Resolved</option>
                 </select>
                 <div className="relative flex-1 sm:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      value={search} onChange={e => {setSearch(e.target.value); setPage(1)}}
                      placeholder="Search tickets / email..."
                      className="pl-9 pr-3 py-2 bg-surface-muted border border-border rounded-lg text-sm w-full outline-none focus:border-emerald-500"
                    />
                 </div>
              </div>
           </div>

           <div className="rounded-xl border border-border bg-surface overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-surface-muted text-muted-foreground text-xs uppercase tracking-wider">
                       <tr>
                          <th className="px-6 py-3 font-semibold">Reference Node</th>
                          <th className="px-6 py-3 font-semibold">Initiator</th>
                          <th className="px-6 py-3 font-semibold">Priority / Vector</th>
                          <th className="px-6 py-3 font-semibold">Boundary Status</th>
                          <th className="px-6 py-3 font-semibold text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                           <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">Parsing nodes...</td></tr>
                        ) : tickets.length === 0 ? (
                           <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">Zero traffic located.</td></tr>
                        ) : tickets.map(t => (
                           <tr key={t.id} className="hover:bg-surface-muted/50 transition">
                               <td className="px-6 py-4">
                                  <div className="font-mono text-xs font-bold text-foreground">{t.ticketNumber?.split('-')[0].toUpperCase() || 'LEGACY-NODE'}</div>
                                  <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{t.subject}</div>
                               </td>
                               <td className="px-6 py-4">
                                  {t.user ? (
                                    <>
                                       <div className="font-bold">{t.user.name}</div>
                                       <div className="text-xs text-muted-foreground mt-0.5">{t.user.email}</div>
                                    </>
                                  ) : <span className="text-muted-foreground italic">Ghost Session</span>}
                               </td>
                               <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${t.priority === 'CRITICAL' ? 'bg-red-500/10 text-red-500' : 'bg-surface-muted text-muted-foreground'}`}>{t.priority}</span>
                                  <div className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">{t.category}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <select 
                                     value={t.status}
                                     onChange={e => handleStatusUpdate(t.id, e.target.value)}
                                     className={`text-xs px-2 py-1 rounded-md border font-bold ${
                                        t.status === 'OPEN' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                        : t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        : 'bg-surface bg-purple-500/10 text-purple-500 border-purple-500/20'
                                     }`}
                                  >
                                     <option value="NEW">NEW</option>
                                     <option value="OPEN">OPEN</option>
                                     <option value="PENDING">PENDING ADMIN</option>
                                     <option value="WAITING_ON_USER">AWAITING USER</option>
                                     <option value="RESOLVED">RESOLVED</option>
                                  </select>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <button className="text-emerald-500 hover:text-emerald-400 text-xs font-bold px-3 py-1 bg-emerald-500/10 rounded-md transition disabled:opacity-50">
                                     Inject Note
                                  </button>
                               </td>
                           </tr>
                        ))}
                    </tbody>
                 </table>
               </div>
               
               {!loading && total > 15 && (
                  <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                     <span className="text-xs text-muted-foreground">Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)}</span>
                     <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-border text-xs hover:bg-surface-muted">Prev</button>
                        <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-border text-xs hover:bg-surface-muted">Next</button>
                     </div>
                  </div>
               )}
           </div>
        </div>
    )
};

export default SupportTickets;
