import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Bug, CheckCircle, Search } from 'lucide-react';
import { format } from 'date-fns';

const BugReports = () => {
    const [bugs, setBugs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        const fetchBugs = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/admin/support/bugs?page=${page}&limit=15`);
                setBugs(res.data.bugs);
                setTotal(res.data.total);
            } catch (e) {
                toast.error('Failure parsing bug payloads');
            } finally {
                setLoading(false);
            }
        };
        fetchBugs();
    }, [page]);

    const handleStatusUpdate = async (id, newStatus) => {
       try {
           await api.put(`/admin/support/bugs/${id}`, { status: newStatus });
           toast.success('Bug Status securely overridden');
           setBugs(bs => bs.map(b => b.id === id ? { ...b, status: newStatus } : b));
       } catch (e) {
           toast.error('Mutation failure');
       }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h1 className="text-2xl font-black text-foreground flex items-center gap-3"><Bug className="text-red-500" /> Bug Reports</h1>
           </div>

           <div className="rounded-xl border border-border bg-surface overflow-hidden">
               {/* Mobile Bug Cards */}
               <div className="md:hidden divide-y divide-border">
                  {loading ? (
                     <div className="p-6 text-center text-muted-foreground text-sm">Loading bug reports...</div>
                  ) : bugs.length === 0 ? (
                     <div className="p-6 text-center text-muted-foreground text-sm">No bug reports found.</div>
                  ) : bugs.map(b => (
                     <div key={b.id} className="p-4 space-y-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                           <div className="min-w-0">
                              {b.reporter ? (
                                <>
                                   <div className="font-bold text-sm text-foreground truncate">{b.reporter.name}</div>
                                   <div className="text-muted-foreground truncate">{b.reporter.email}</div>
                                </>
                              ) : <span className="text-muted-foreground italic">Anonymous Trader</span>}
                           </div>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest shrink-0 ${b.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500' : 'bg-surface-muted text-muted-foreground'}`}>{b.severity}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                           <span>{b.device || 'Unknown Device'} • <span className="font-mono">{b.browser || 'Browser'}</span></span>
                           <span className="font-bold uppercase text-[10px]">{b.relatedModule || 'GENERAL'}</span>
                        </div>
                        <select 
                           value={b.status}
                           onChange={e => handleStatusUpdate(b.id, e.target.value)}
                           className={`w-full text-xs px-3 py-2 min-h-[38px] rounded-lg border font-bold ${
                              b.status === 'NEW' ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                              : b.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                           }`}
                        >
                           <option value="NEW">New</option>
                           <option value="ASSIGNED">In Progress</option>
                           <option value="VERIFYING">Testing / QA</option>
                           <option value="RESOLVED">Resolved / Fixed</option>
                           <option value="ARCHIVED">Archived</option>
                        </select>
                     </div>
                  ))}
               </div>

               <div className="hidden md:block overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-surface-muted text-muted-foreground text-xs uppercase tracking-wider">
                       <tr>
                          <th className="px-6 py-3 font-semibold">Reported By</th>
                          <th className="px-6 py-3 font-semibold">Device & Browser</th>
                          <th className="px-6 py-3 font-semibold">Module & Severity</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                           <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">Loading bug reports...</td></tr>
                        ) : bugs.length === 0 ? (
                           <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">No bug reports found.</td></tr>
                        ) : bugs.map(b => (
                           <tr key={b.id} className="hover:bg-surface-muted/50 transition">
                               <td className="px-6 py-4">
                                  {b.reporter ? (
                                    <>
                                       <div className="font-bold">{b.reporter.name}</div>
                                       <div className="text-xs text-muted-foreground mt-0.5">{b.reporter.email}</div>
                                    </>
                                  ) : <span className="text-muted-foreground italic">Anonymous Trader</span>}
                               </td>
                               <td className="px-6 py-4">
                                  <div className="font-bold">{b.device || 'Unknown Device'}</div>
                                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{b.browser || 'Browser'} • {b.appVersion || 'v1.0'}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${b.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500' : 'bg-surface-muted text-muted-foreground'}`}>{b.severity}</span>
                                  <div className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">{b.relatedModule || 'GENERAL'}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <select 
                                     value={b.status}
                                     onChange={e => handleStatusUpdate(b.id, e.target.value)}
                                     className={`text-xs px-2 py-1 rounded-md border font-bold ${
                                        b.status === 'NEW' ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                        : b.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        : 'bg-surface bg-purple-500/10 text-purple-500 border-purple-500/20'
                                     }`}
                                  >
                                     <option value="NEW">New</option>
                                     <option value="ASSIGNED">In Progress</option>
                                     <option value="VERIFYING">Testing / QA</option>
                                     <option value="RESOLVED">Resolved / Fixed</option>
                                     <option value="ARCHIVED">Archived</option>
                                  </select>
                               </td>
                           </tr>
                        ))}
                    </tbody>
                 </table>
               </div>
               
               {!loading && total > 15 && (
                  <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
                     <span className="text-xs text-muted-foreground">Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} bugs</span>
                     <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 min-h-[36px] rounded border border-border text-xs disabled:opacity-50 hover:bg-surface-muted">Previous</button>
                        <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 min-h-[36px] rounded border border-border text-xs disabled:opacity-50 hover:bg-surface-muted">Next</button>
                     </div>
                  </div>
               )}
           </div>
        </div>
    )
};

export default BugReports;
