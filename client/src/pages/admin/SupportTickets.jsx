import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, Edit, Clock, CheckCircle, Ticket, X, MessageSquare, ExternalLink, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const SupportTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);

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

    useEffect(() => {
        const timeout = setTimeout(fetchTickets, 300);
        return () => clearTimeout(timeout);
    }, [page, search, statusFilter]);

    const handleStatusUpdate = async (id, newStatus) => {
       try {
           await api.put(`/admin/support/tickets/${id}`, { status: newStatus });
           toast.success('Ticket trajectory updated');
           setTickets(ts => ts.map(t => t.id === id ? { ...t, status: newStatus } : t));
           if (selectedTicket?.id === id) {
               setSelectedTicket(prev => ({ ...prev, status: newStatus }));
           }
       } catch (e) {
           toast.error('Mutation failure');
       }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
           {/* Header */}
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-foreground">Support Tickets</h1>
                <p className="text-xs text-muted mt-0.5">Track official customer issue reports, SLA compliance, and escalation lifecycles.</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                 <select 
                    value={statusFilter} 
                    onChange={e => {setStatusFilter(e.target.value); setPage(1);}} 
                    className="bg-surface border border-border rounded-xl text-xs px-3 py-2 outline-none font-semibold text-foreground focus:border-emerald-500"
                 >
                    <option value="">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending Admin</option>
                    <option value="WAITING_ON_USER">Waiting on Trader</option>
                    <option value="RESOLVED">Resolved</option>
                 </select>
                 <div className="relative flex-1 sm:w-64">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input 
                      value={search} 
                      onChange={e => {setSearch(e.target.value); setPage(1);}}
                      placeholder="Search ticket # or email..."
                      className="pl-9 pr-3 py-2 bg-surface-muted border border-border rounded-xl text-xs w-full outline-none focus:border-emerald-500 text-foreground placeholder:text-muted"
                    />
                 </div>
              </div>
           </div>

           {/* Table */}
           <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xs">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-surface-muted/60 text-muted text-xs uppercase tracking-wider border-b border-border">
                       <tr>
                          <th className="px-6 py-3 font-semibold">Ticket # & Subject</th>
                          <th className="px-6 py-3 font-semibold">Trader</th>
                          <th className="px-6 py-3 font-semibold">Priority & Category</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                           <tr><td colSpan="5" className="p-8 text-center text-muted">Loading tickets...</td></tr>
                        ) : tickets.length === 0 ? (
                           <tr><td colSpan="5" className="p-8 text-center text-muted">No support tickets found.</td></tr>
                        ) : tickets.map(t => (
                           <tr key={t.id} className="hover:bg-surface-muted/40 transition">
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                     <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                       #{t.ticketNumber || 'TK-XXXX'}
                                     </span>
                                     <span className="text-[10px] text-muted">
                                       {t.createdAt ? format(new Date(t.createdAt), 'MMM d, yyyy') : ''}
                                     </span>
                                  </div>
                                  <div className="text-xs text-foreground font-semibold mt-1.5 max-w-[280px] truncate" title={t.subject}>
                                    {t.subject}
                                  </div>
                               </td>
                               <td className="px-6 py-4">
                                  {t.user ? (
                                    <>
                                       <div className="font-bold text-xs text-foreground">{t.user.name}</div>
                                       <div className="text-[11px] text-muted mt-0.5">{t.user.email}</div>
                                       {t.user.subscriptionPlan && (
                                         <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-muted text-muted uppercase">
                                           {t.user.subscriptionPlan}
                                         </span>
                                       )}
                                    </>
                                  ) : <span className="text-muted italic text-xs">Guest User</span>}
                               </td>
                               <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    t.priority === 'CRITICAL' || t.priority === 'URGENT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                    : t.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-surface-muted text-muted'
                                  }`}>
                                    {t.priority}
                                  </span>
                                  <div className="text-[10px] text-muted font-bold mt-1 uppercase tracking-wide">
                                    {t.category}
                                  </div>
                                </td>
                               <td className="px-6 py-4">
                                  <select 
                                     value={t.status}
                                     onChange={e => handleStatusUpdate(t.id, e.target.value)}
                                     className={`text-xs px-2.5 py-1 rounded-lg border font-bold cursor-pointer transition ${
                                        t.status === 'OPEN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                        : t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                     }`}
                                  >
                                     <option value="NEW">New</option>
                                     <option value="OPEN">Open</option>
                                     <option value="PENDING">Pending Admin</option>
                                     <option value="WAITING_ON_USER">Waiting on Trader</option>
                                     <option value="RESOLVED">Resolved</option>
                                     <option value="CLOSED">Closed</option>
                                  </select>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                     <button
                                        type="button"
                                        onClick={() => setSelectedTicket(t)}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border bg-surface-muted hover:bg-surface text-foreground transition"
                                     >
                                        Inspect
                                     </button>
                                     <Link
                                        to={`/admin/communications/contact?search=${encodeURIComponent(t.user?.email || t.ticketNumber)}`}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition flex items-center gap-1"
                                        title="Open customer conversation desk"
                                     >
                                        <MessageSquare size={12} />
                                        <span>Live Chat</span>
                                     </Link>
                                     <a 
                                        href={`mailto:${t.user?.email || ''}?subject=Re: Ticket ${t.ticketNumber} - ${t.subject}`} 
                                        className="text-emerald-500 hover:text-emerald-400 text-xs font-bold px-2.5 py-1 bg-emerald-500/10 rounded-lg transition inline-flex items-center gap-1"
                                        title="Send direct email"
                                     >
                                        <Mail size={12} />
                                        <span>Email</span>
                                     </a>
                                  </div>
                               </td>
                           </tr>
                        ))}
                    </tbody>
                 </table>
               </div>
               
               {!loading && total > 15 && (
                  <div className="px-6 py-4 border-t border-border flex items-center justify-between text-xs text-muted">
                     <span>Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} tickets</span>
                     <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-border hover:bg-surface-muted disabled:opacity-40">Previous</button>
                        <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-border hover:bg-surface-muted disabled:opacity-40">Next</button>
                     </div>
                  </div>
               )}
           </div>

           {/* Ticket Inspection Modal */}
           {selectedTicket && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
                 <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-muted/50">
                       <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                             #{selectedTicket.ticketNumber || 'TK-XXXX'}
                          </span>
                          <span className="text-xs text-muted">
                             Created {selectedTicket.createdAt ? format(new Date(selectedTicket.createdAt), 'PPP p') : ''}
                          </span>
                       </div>
                       <button onClick={() => setSelectedTicket(null)} className="p-1 rounded-lg text-muted hover:text-foreground">
                          <X size={18} />
                       </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                       {/* Subject */}
                       <div>
                          <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">Subject</label>
                          <h3 className="text-base font-bold text-foreground">{selectedTicket.subject}</h3>
                       </div>

                       {/* Trader Info & Meta */}
                       <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-surface-muted/30 text-xs">
                          <div>
                             <span className="text-muted block text-[10px] uppercase font-bold">Trader</span>
                             <span className="font-bold text-foreground">{selectedTicket.user?.name || 'Guest'}</span>
                             <span className="text-muted block text-[11px]">{selectedTicket.user?.email || 'N/A'}</span>
                          </div>
                          <div>
                             <span className="text-muted block text-[10px] uppercase font-bold">Category & Urgency</span>
                             <span className="font-bold text-foreground uppercase">{selectedTicket.category}</span>
                             <span className="text-muted block text-[11px] font-semibold">{selectedTicket.priority} Priority</span>
                          </div>
                       </div>

                       {/* Description */}
                       <div>
                          <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">Full Description / Transmission</label>
                          <div className="p-4 rounded-xl border border-border bg-surface-muted/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                             {selectedTicket.description}
                          </div>
                       </div>

                       {/* Quick Status Update */}
                       <div className="flex items-center justify-between pt-2 border-t border-border">
                          <div className="flex items-center gap-2">
                             <span className="text-xs text-muted font-semibold">Status:</span>
                             <select
                                value={selectedTicket.status}
                                onChange={(e) => handleStatusUpdate(selectedTicket.id, e.target.value)}
                                className="text-xs px-2.5 py-1 rounded-lg border font-bold bg-surface border-border text-foreground cursor-pointer"
                             >
                                <option value="OPEN">Open</option>
                                <option value="PENDING">Pending Admin</option>
                                <option value="WAITING_ON_USER">Waiting on Trader</option>
                                <option value="RESOLVED">Resolved</option>
                                <option value="CLOSED">Closed</option>
                             </select>
                          </div>

                          <div className="flex items-center gap-2">
                             <Link
                                to={`/admin/communications/contact?search=${encodeURIComponent(selectedTicket.user?.email || selectedTicket.ticketNumber)}`}
                                onClick={() => setSelectedTicket(null)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition flex items-center gap-1.5"
                             >
                                <MessageSquare size={13} />
                                <span>Go to Conversation Desk</span>
                             </Link>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
    );
};

export default SupportTickets;
