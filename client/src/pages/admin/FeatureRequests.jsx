import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Lightbulb, ArrowUp } from 'lucide-react';
import { format } from 'date-fns';

const FeatureRequests = () => {
    const [features, setFeatures] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        const fetchFeatures = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/admin/support/features?page=${page}&limit=15`);
                setFeatures(res.data.features);
                setTotal(res.data.total);
            } catch (e) {
                toast.error('Failure parsing feature payloads');
            } finally {
                setLoading(false);
            }
        };
        fetchFeatures();
    }, [page]);

    const handleStatusUpdate = async (id, newStatus) => {
       try {
           await api.put(`/admin/support/features/${id}`, { status: newStatus });
           toast.success('Feature Roadmap securely overridden');
           setFeatures(fs => fs.map(f => f.id === id ? { ...f, status: newStatus } : f));
       } catch (e) {
           toast.error('Mutation failure');
       }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h1 className="text-2xl font-black text-foreground flex items-center gap-3"><Lightbulb className="text-purple-500" /> Feature Requests Hub</h1>
           </div>

           <div className="rounded-xl border border-border bg-surface overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-surface-muted text-muted-foreground text-xs uppercase tracking-wider">
                       <tr>
                          <th className="px-6 py-3 font-semibold">Volume</th>
                          <th className="px-6 py-3 font-semibold">Description</th>
                          <th className="px-6 py-3 font-semibold">Initiator</th>
                          <th className="px-6 py-3 font-semibold text-right">Roadmap Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                           <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">Isolating features...</td></tr>
                        ) : features.length === 0 ? (
                           <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">Zero feature structures detected.</td></tr>
                        ) : features.map(f => (
                           <tr key={f.id} className="hover:bg-surface-muted/50 transition">
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-2 p-2 bg-purple-500/10 text-purple-500 rounded-lg max-w-min font-black font-mono">
                                    <ArrowUp size={16} /> {f.votes}
                                  </div>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="font-bold max-w-sm truncate text-foreground">{f.description}</div>
                                  <div className="text-xs text-muted-foreground font-bold mt-0.5 uppercase tracking-widest">{f.category}</div>
                               </td>
                               <td className="px-6 py-4">
                                  {f.user ? (
                                    <>
                                       <div className="font-bold">{f.user.name}</div>
                                       <div className="text-xs text-muted-foreground mt-0.5">{f.user.email}</div>
                                    </>
                                  ) : <span className="text-muted-foreground italic">System Internal</span>}
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <select 
                                     value={f.status}
                                     onChange={e => handleStatusUpdate(f.id, e.target.value)}
                                     className={`text-xs px-2 py-1 rounded-md border font-bold ${
                                        f.status === 'UNDER_REVIEW' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                        : f.status === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        : 'bg-surface bg-purple-500/10 text-purple-500 border-purple-500/20'
                                     }`}
                                  >
                                     <option value="UNDER_REVIEW">UNDER REVIEW</option>
                                     <option value="PLANNED">ROADMAP PLANNED</option>
                                     <option value="DEVELOPMENT">IN DEVELOPMENT</option>
                                     <option value="RELEASED">RELEASED</option>
                                     <option value="DECLINED">DECLINED</option>
                                  </select>
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

export default FeatureRequests;
