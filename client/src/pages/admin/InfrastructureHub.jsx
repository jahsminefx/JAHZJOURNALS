import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Activity, Server, Database, Key, CheckCircle, XCircle, HardDrive, Cpu, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const InfrastructureHub = () => {
    const [metrics, setMetrics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isPolling, setIsPolling] = useState(true);
    const [lastPing, setLastPing] = useState(null);

    const fetchTelemetry = async (silent = false) => {
        try {
            const [metRes, logRes] = await Promise.all([
                api.get('/admin/infrastructure/metrics'),
                api.get('/admin/infrastructure/logs')
            ]);
            setMetrics(metRes.data);
            setLogs(logRes.data.logs);
            setLastPing(new Date());
        } catch (e) {
            if (!silent) toast.error('Native Telemetry Ping Failed. Check Backend Hardware.');
            setIsPolling(false);
        }
    };

    useEffect(() => {
        fetchTelemetry();

        let interval;
        if (isPolling) {
            interval = setInterval(() => fetchTelemetry(true), 5000); 
        }
        return () => clearInterval(interval);
    }, [isPolling]);

    if (!metrics) return (
       <div className="flex flex-col items-center justify-center py-32 space-y-4">
           <Activity className="text-emerald-500 animate-pulse" size={48} />
           <p className="font-mono text-emerald-500 tracking-widest uppercase font-black text-sm">Intercepting Hardware Telemetry...</p>
       </div>
    );

    const PING = ({ status, label }) => (
        <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
           <span className="text-sm font-bold text-foreground">{label}</span>
           <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${status === 'HEALTHY' ? 'text-emerald-500' : 'text-red-500'}`}>
              {status === 'HEALTHY' ? <CheckCircle size={14} /> : <XCircle size={14} />} {status}
           </span>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-border pb-6 pt-2">
              <div>
                  <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
                     <Server className="text-emerald-500" /> Infrastructure / Mission Control
                  </h1>
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                      SYS_TICK: {lastPing?.toISOString()} | {isPolling ? 'LIVE POLLING (5s)' : 'POLLING PAUSED'}
                  </p>
              </div>
              
              <button 
                  onClick={() => setIsPolling(!isPolling)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition border ${isPolling ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'}`}
              >
                  {isPolling ? 'Halt Telemetry' : 'Resume Polling'}
              </button>
           </div>

           <div className="grid lg:grid-cols-3 gap-6">
               
               {/* Compute Node */}
               <div className="space-y-4">
                   <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Cpu size={16}/> Compute Node</h2>
                   <div className="bg-surface border border-border p-5 rounded-xl space-y-4">
                      <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold">Node Process Uptime</p>
                          <p className="text-xl font-mono font-black text-foreground">{metrics.system.nodeUptimeString}</p>
                      </div>
                      <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Memory Utilization (RSS)</p>
                          <div className="w-full bg-surface-muted rounded-full h-2">
                             <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${metrics.system.memoryUsagePercentage}%` }}></div>
                          </div>
                          <p className="text-right text-[10px] font-mono text-muted-foreground mt-1">{metrics.system.memoryUsagePercentage}% LOAD</p>
                      </div>
                      <div className="pt-2 border-t border-border mt-2">
                          <p className="text-[10px] font-mono text-muted-foreground">HOST: {metrics.system.platform} {metrics.system.architecture}</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-1">CPU: {metrics.system.cpuCores}x {metrics.system.cpuModel}</p>
                      </div>
                   </div>
               </div>

               {/* Database Hooks */}
               <div className="space-y-4">
                   <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Database size={16}/> Postgres Operations</h2>
                   <div className="bg-surface border border-border p-5 rounded-xl space-y-4">
                       <div className="flex items-center gap-4">
                           <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                               <HardDrive size={24} />
                           </div>
                           <div>
                               <p className="text-[10px] uppercase font-bold text-muted-foreground">Pool Active Sync</p>
                               <p className="text-xl font-black font-mono text-foreground">{metrics.database.activeConnections} Connections</p>
                           </div>
                       </div>
                       <PING status={metrics.database.status} label="Prisma Client Vector" />
                       <div className="pt-2 border-t border-border mt-2 flex justify-between items-center text-xs">
                           <span className="font-bold text-muted-foreground uppercase">Data Volume Bounds:</span>
                           <span className="font-mono text-foreground font-black">{metrics.database.size}</span>
                       </div>
                   </div>
               </div>

               {/* External APIs & Queues */}
               <div className="space-y-4">
                   <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Key size={16}/> External Gateways & Queues</h2>
                   <div className="bg-surface border border-border p-5 rounded-xl">
                       <PING status={metrics.services.redis} label="Redis / BullMQ Matrix" />
                       <PING status={metrics.services.cloudinary} label="Cloudinary AWS Wrapper" />
                       <PING status={metrics.services.openrouter} label="OpenRouter AI Bridge" />
                       
                       <div className="mt-4 pt-4 border-t border-border">
                           <div className="grid grid-cols-3 gap-2 text-center text-xs">
                               <div className="bg-surface-muted p-2 rounded-lg">
                                   <p className="font-bold text-foreground font-mono">{metrics.queue.waiting}</p>
                                   <p className="text-[10px] uppercase text-muted-foreground">WAIT</p>
                               </div>
                               <div className="bg-blue-500/10 text-blue-500 border border-blue-500/20 p-2 rounded-lg">
                                   <p className="font-bold font-mono">{metrics.queue.active}</p>
                                   <p className="text-[10px] uppercase">ACTV</p>
                               </div>
                               <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-2 rounded-lg">
                                   <p className="font-bold font-mono">{metrics.queue.failed}</p>
                                   <p className="text-[10px] uppercase">FAIL</p>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>

           </div>

           {/* Error Center Logs */}
           <div className="space-y-4">
               <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><AlertTriangle size={16}/> Virtualized Error Trace (Tail)</h2>
               <div className="bg-surface border border-border rounded-xl max-h-[400px] overflow-y-auto">
                  {logs.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground font-bold">Zero active system exceptions detected.</div>
                  ) : (
                      <div className="divide-y divide-border">
                          {logs.map(log => (
                              <div key={log.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-surface-muted/30 transition">
                                  <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-1">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded">{log.type}</span>
                                          <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(log.timestamp), 'dd MMM HH:mm:ss')}</span>
                                      </div>
                                      <p className="text-sm font-bold text-foreground mt-1">{log.message}</p>
                                      <p className="text-xs text-muted-foreground font-mono mt-1">SOURCE: {log.source}</p>
                                  </div>
                                  <button className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground px-3 py-1 border border-border rounded-lg">Acknowledge</button>
                              </div>
                          ))}
                      </div>
                  )}
               </div>
           </div>
        </div>
    );
};

export default InfrastructureHub;
