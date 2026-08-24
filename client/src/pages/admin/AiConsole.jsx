import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Activity, Search, Server, Cpu, Layers, DollarSign, Settings, ShieldCheck, Zap } from 'lucide-react';
import { format } from 'date-fns';

const AiConsole = () => {
   const [activeTab, setActiveTab] = useState('DASHBOARD');
   
   return (
     <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 p-6 bg-purple-500/10 border border-purple-500/20 rounded-xl relative overflow-hidden">
           <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 pointer-events-none">
             <Cpu size={250} />
           </div>
           <div className="relative z-10 w-full">
             <h1 className="text-2xl font-black text-purple-400 tracking-wide flex items-center gap-3">
               <Cpu size={28} /> INTELLIGENCE OPERATIONS CENTER
             </h1>
             <p className="text-purple-400/80 text-sm mt-2 font-medium max-w-2xl">
               Real-time AI telemetry parsing Request structures mapping natively against robust Prisma Models. Isolated strictly from underlying Provider logic executing in parallel.
             </p>
             
             <div className="flex gap-2 bg-surface/50 p-2 rounded-lg mt-5 border border-purple-500/20 overflow-x-auto w-full sm:w-auto self-start">
               {['DASHBOARD', 'EXPLORER', 'CONFIG', 'HEALTH'].map(tab => (
                 <button 
                   key={tab} 
                   onClick={() => setActiveTab(tab)}
                   className={`px-4 py-2 rounded-md text-sm font-bold tracking-wide transition whitespace-nowrap ${activeTab === tab ? 'bg-purple-500 text-gray-950 shadow-md shadow-purple-500/20' : 'text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-400'}`}
                 >
                   {tab}
                 </button>
               ))}
             </div>
           </div>
        </div>

        {activeTab === 'DASHBOARD' && <DashboardTab />}
        {activeTab === 'EXPLORER' && <ExplorerTab />}
        {activeTab === 'CONFIG' && <ConfigTab />}
        {activeTab === 'HEALTH' && <HealthTab />}
     </div>
   );
};

const DashboardTab = () => {
   const [data, setData] = useState(null);
   useEffect(() => {
     api.get('/admin/ai/dashboard').then(res => setData(res.data)).catch(() => toast.error('Telemetry mapping failed'));
   }, []);

   if (!data) return <div className="h-40 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-r-transparent"></div></div>;

   return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
         <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><Activity size={16}/> <span className="text-xs font-bold uppercase">Requests Pulse (7D)</span></div>
              <div className="mt-4 flex items-end justify-between">
                 <h3 className="text-3xl font-black">{data.usage.week}</h3>
                 <div className="text-xs text-muted-foreground">{data.usage.today} Today</div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><DollarSign size={16}/> <span className="text-xs font-bold uppercase">Estimated Burn ($)</span></div>
              <div className="mt-4 flex items-end justify-between">
                 <h3 className="text-3xl font-black text-purple-400">${Number(data.costs.totalCost).toFixed(2)}</h3>
                 <div className="text-xs text-muted-foreground">Month: ${Number(data.costs.monthCost).toFixed(2)}</div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><Layers size={16}/> <span className="text-xs font-bold uppercase">Active Engine</span></div>
              <div className="mt-4">
                 <h3 className="text-2xl font-black uppercase text-foreground">{data.providers.active}</h3>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><Server size={16}/> <span className="text-xs font-bold uppercase">Native Queues</span></div>
              <div className="mt-4 flex gap-4">
                 <div>
                    <div className="text-2xl font-black">{data.queues.active}</div>
                    <div className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase">Executing</div>
                 </div>
                 <div>
                    <div className="text-2xl font-black">{data.queues.waiting}</div>
                    <div className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">Waiting</div>
                 </div>
              </div>
            </div>
         </div>
      </div>
   );
};

const ExplorerTab = () => {
   const [requests, setRequests] = useState([]);
   const [total, setTotal] = useState(0);
   const [loading, setLoading] = useState(true);
   const [page, setPage] = useState(1);
   const [search, setSearch] = useState('');
   
   useEffect(() => {
      const timer = setTimeout(() => {
        setLoading(true);
        const params = new URLSearchParams({ page, limit: 15, ...(search && { search }) });
        api.get(`/admin/ai/requests?${params}`).then(res => {
          setRequests(res.data.requests);
          setTotal(res.data.total);
        }).finally(() => setLoading(false));
      }, 300);
      return () => clearTimeout(timer);
   }, [page, search]);

   return (
     <div className="rounded-xl border border-border bg-surface flex flex-col overflow-hidden animate-in fade-in">
        <div className="p-4 border-b border-border bg-surface-muted/30 flex flex-wrap gap-4 items-center justify-between">
            <div className="relative w-full sm:w-64">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input 
               value={search} onChange={e => {setSearch(e.target.value); setPage(1)}}
               placeholder="Search by User Name or Email..."
               className="pl-9 pr-3 py-1.5 bg-surface border border-border rounded-lg text-sm w-full outline-none focus:border-purple-500 transition"
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
             <thead className="bg-surface-muted text-muted-foreground text-xs uppercase tracking-wider">
               <tr>
                 <th className="px-6 py-3 font-semibold">Initiator</th>
                 <th className="px-6 py-3 font-semibold">Engine Variant</th>
                 <th className="px-6 py-3 font-semibold text-right">Burn Cost</th>
                 <th className="px-6 py-3 font-semibold">Matrix Status</th>
                 <th className="px-6 py-3 font-semibold">Timestamp</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-border">
               {loading ? (
                  <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">Parsing payloads securely...</td></tr>
               ) : requests.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No traffic traces recorded.</td></tr>
               ) : requests.map(req => (
                 <tr key={req.id} className="hover:bg-surface-muted/50 transition">
                    <td className="px-6 py-4">
                       {req.user ? (
                         <>
                           <div className="font-bold text-foreground">{req.user.name} <span className="font-mono text-[10px] text-purple-400 font-normal ml-2">{req.user.subscriptionPlan}</span></div>
                           <div className="text-xs text-muted-foreground mt-0.5">{req.user.email}</div>
                         </>
                       ) : <div className="text-muted-foreground italic">Ghost Session / Detached</div>}
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-bold text-purple-400 capitalize">{req.featureType.replace('_', ' ')}</div>
                       <div className="text-xs text-muted-foreground mt-0.5 font-mono">{req.provider} • {req.model}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="text-foreground font-bold">${Number(req.estimatedCost || 0).toFixed(6)}</div>
                       <div className="text-xs text-muted-foreground mt-0.5">{req.inputTokens + req.outputTokens} tkn root</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded text-xs font-bold leading-none ${req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : req.status === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                         {req.status}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                        {format(new Date(req.createdAt), 'MMM dd, HH:mm:ss')}
                    </td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>
        
        {!loading && total > 15 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
             <span className="text-xs text-muted-foreground">Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} nodes</span>
             <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-md border border-border hover:bg-surface-muted transition text-xs">Previous</button>
                <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-md border border-border hover:bg-surface-muted transition text-xs">Next</button>
             </div>
          </div>
        )}
     </div>
   );
};

const ConfigTab = () => {
   const [config, setConfig] = useState(null);
   const [saving, setSaving] = useState(false);

   useEffect(() => {
     api.get('/admin/ai/config').then(res => setConfig(res.data)).catch(() => toast.error('Config engine offline'));
   }, []);

   const saveConstraints = async () => {
     try {
       setSaving(true);
       await api.put('/admin/ai/config', config);
       toast.success('Matrix parameters mutated flawlessly.');
     } catch(e) {
       toast.error('Failure mutating central parameters.');
     } finally {
       setSaving(false);
     }
   };

   if (!config) return null;

   return (
     <div className="space-y-6 animate-in fade-in">
        <div className="p-6 rounded-xl border border-border bg-surface">
           <h3 className="font-bold border-b border-border pb-4 mb-6 flex items-center gap-2"><Zap size={18} className="text-purple-500"/> Core Infrastructure Routing</h3>
           <div className="grid sm:grid-cols-2 gap-6">
             <div className="space-y-2">
               <label className="text-xs font-bold uppercase text-muted-foreground">Primary Provider Engine</label>
               <select value={config.activeProvider} onChange={e => setConfig({ ...config, activeProvider: e.target.value })} className="w-full bg-surface-muted border border-border rounded-lg outline-none focus:border-purple-500 px-4 py-2 font-bold text-sm">
                  <option value="openrouter">OpenRouter (Failsafe Mesh)</option>
                  <option value="openai">OpenAI (Direct Engine)</option>
               </select>
             </div>
           </div>
        </div>

        <div className="p-6 rounded-xl border border-border bg-surface">
           <h3 className="font-bold border-b border-border pb-4 mb-6 flex items-center gap-2"><Settings size={18} className="text-purple-500"/> Dynamic Rollout Tiers</h3>
           <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {Object.entries({
                chat: 'EVERYONE',
                visionAi: 'PRO_ONLY',
                edgeFinder: 'EVERYONE',
                tradeReview: 'PRO_ONLY',
                weeklyCoach: 'PRO_ONLY',
                journaling: 'EVERYONE',
                planGenerator: 'EVERYONE',
                ...(config.enabledFeatures || {})
             }).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-2 p-4 border border-border rounded-lg bg-surface-muted/30">
                   <div className="capitalize text-sm font-bold tracking-wide text-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                   <select 
                     value={typeof value === 'boolean' ? (value ? 'EVERYONE' : 'DISABLED') : value} 
                     onChange={e => setConfig({
                        ...config, 
                        enabledFeatures: {
                           ...config.enabledFeatures, 
                           [key]: e.target.value
                        }
                     })}
                     className="w-full bg-surface border border-border rounded-lg outline-none focus:border-purple-500 px-3 py-1.5 font-bold text-xs text-muted-foreground transition"
                   >
                     <option value="EVERYONE">Enabled for Everyone</option>
                     <option value="STARTER_AND_PRO">Enabled for STARTER & PRO</option>
                     <option value="PRO_ONLY">Enabled for PRO Only</option>
                     <option value="FOUNDING_TRADERS_ONLY">Founding Traders Only</option>
                     <option value="BETA_TESTERS_ONLY">Beta Testers Only</option>
                     <option value="SELECTED_USERS">Selected Users</option>
                     <option value="DISABLED">Disabled Globally</option>
                   </select>
                </div>
             ))}
           </div>
        </div>

        <div className="flex justify-end">
           <button disabled={saving} onClick={saveConstraints} className="px-6 py-2.5 bg-purple-500 text-gray-950 font-black tracking-wide rounded-xl hover:bg-purple-400 disabled:opacity-50 transition">
              Commit Subsystem Overrides
           </button>
        </div>
     </div>
   )
};

const HealthTab = () => {
   const [health, setHealth] = useState(null);
   useEffect(() => {
     api.get('/admin/ai/health').then(res => setHealth(res.data)).catch(() => {});
   }, []);

   if (!health) return null;

   return (
     <div className="space-y-6 animate-in fade-in">
        <div className="grid sm:grid-cols-2 gap-4">
           {[ 
             { label: 'Redis Bus', status: health.redis }, 
             { label: 'BullMQ Exec', status: health.bullmq },
             { label: 'OpenRouter Relay', status: health.openRouter }, 
             { label: 'OpenAI Backbone', status: health.openai }
           ].map((g, i) => (
             <div key={i} className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between">
                <div className="font-bold tracking-wide">{g.label}</div>
                <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${g.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                   {g.status}
                </div>
             </div>
           ))}
        </div>
        
        <div className="p-6 rounded-xl border border-border bg-red-500/5">
           <h3 className="font-bold border-b border-red-500/20 pb-4 mb-6 flex items-center gap-2 text-red-500"><ShieldCheck size={18}/> Safety Constraints</h3>
           <div className="flex gap-12">
              <div>
                <div className="text-3xl font-black text-foreground">{health.safety.sanitizationEvents}</div>
                <div className="text-xs uppercase font-bold text-muted-foreground mt-1">Sanitization Overrides</div>
              </div>
              <div>
                <div className="text-3xl font-black text-red-500">{health.safety.blockedRequests}</div>
                <div className="text-xs uppercase font-bold text-red-500/70 mt-1">Malicious Blocked Injects</div>
              </div>
           </div>
        </div>
     </div>
   )
};

export default AiConsole;
