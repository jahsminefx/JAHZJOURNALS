import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Activity, BrainCircuit, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

const UserAiModal = ({ user, onClose }) => {
   const [requests, setRequests] = useState([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     api.get(`/admin/ai/requests?search=${encodeURIComponent(user.email)}&limit=100`)
        .then(res => setRequests(res.data.requests))
        .catch(() => toast.error('Failed bridging intelligence bounds'))
        .finally(() => setLoading(false));
   }, [user.email]);

   const totalBurn = requests.reduce((acc, req) => acc + (req.estimatedCost || 0), 0);
   const totalTokens = requests.reduce((acc, req) => acc + (req.inputTokens || 0) + (req.outputTokens || 0), 0);
   
   // Frequencies
   const features = requests.map(r => r.featureType);
   const favorite = features.sort((a,b) => features.filter(v => v===a).length - features.filter(v => v===b).length).pop() || 'None Isolated';

   return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto">
        <div className="relative flex w-full max-w-3xl flex-col rounded-2xl bg-surface shadow-2xl text-foreground my-8">
           <div className="flex items-center justify-between border-b border-border p-6 font-bold bg-purple-500/10 rounded-t-2xl">
              <div>
                <h2 className="text-xl text-purple-500 flex items-center gap-2"><BrainCircuit size={20}/> Telemetry Profile: {user.name}</h2>
                <p className="text-xs text-purple-400/80 mt-1 uppercase tracking-widest">{user.email}</p>
              </div>
              <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-full transition">
                <X size={20} />
              </button>
           </div>
           
           <div className="p-6">
              {loading ? (
                <div className="h-40 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-r-transparent"></div></div>
              ) : (
                <div className="space-y-6">
                   <div className="grid sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl border border-border bg-surface-muted text-center">
                         <div className="text-xs font-bold uppercase text-muted-foreground">Lifespan Hooks</div>
                         <div className="text-2xl font-black mt-2">{requests.length}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-surface-muted text-center">
                         <div className="text-xs font-bold uppercase text-muted-foreground">Tokens Yield</div>
                         <div className="text-2xl font-black mt-2">{totalTokens}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 text-center">
                         <div className="text-xs font-bold uppercase text-purple-500">Gross Estimate</div>
                         <div className="text-2xl font-black text-purple-400 mt-2">${totalBurn.toFixed(4)}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-surface-muted text-center">
                         <div className="text-xs font-bold uppercase text-muted-foreground">Primary Node</div>
                         <div className="text-xs font-bold capitalize mt-4">{favorite.replace('_', ' ')}</div>
                      </div>
                   </div>

                   <h3 className="font-bold border-b border-border pb-2">Diagnostic Tracer Logs (Latest 100)</h3>
                   {requests.length === 0 ? (
                      <div className="text-center p-8 text-muted-foreground border border-dashed rounded-xl"><ShieldAlert className="mx-auto mb-2 opacity-50" size={30}/> Zero AI payloads registered for this user boundary.</div>
                   ) : (
                      <div className="overflow-x-auto border border-border rounded-xl">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-surface-muted text-muted-foreground">
                             <tr>
                               <th className="px-4 py-3">Variant</th>
                               <th className="px-4 py-3">Provider</th>
                               <th className="px-4 py-3 right">Cost</th>
                               <th className="px-4 py-3">Time</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                             {requests.map(r => (
                               <tr key={r.id} className="hover:bg-surface-muted/50">
                                 <td className="px-4 py-3 font-bold text-xs">{r.featureType.replace('_', ' ')}</td>
                                 <td className="px-4 py-3 font-mono text-xs">{r.provider}</td>
                                 <td className="px-4 py-3 text-xs text-purple-400 font-bold">${Number(r.estimatedCost || 0).toFixed(5)}</td>
                                 <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(r.createdAt), 'MMM dd HH:mm')}</td>
                               </tr>
                             ))}
                           </tbody>
                        </table>
                      </div>
                   )}
                </div>
              )}
           </div>
        </div>
     </div>
   )
};

export default UserAiModal;
