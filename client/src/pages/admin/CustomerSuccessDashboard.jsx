import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Activity, Users, AlertCircle, MessageSquare, Ticket, Bug, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';

const CustomerSuccessDashboard = () => {
   const [kpis, setKpis] = useState(null);

   useEffect(() => {
      api.get('/admin/support/dashboard')
         .then(res => setKpis(res.data.kpis))
         .catch(() => toast.error('Failed bridging support KPIs.'));
   }, []);

   if (!kpis) return <div className="h-40 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent"></div></div>;

   const metrics = [
      { label: 'Pending Support Tickets', value: kpis.waitingAdmin, icon: Ticket, sub: `${kpis.totalOpenTickets} Global Open`, color: 'text-amber-500', bg: 'bg-amber-500/10' },
      { label: 'Awaiting User Response', value: kpis.waitingUser, icon: MessageSquare, sub: `Customer Action Required`, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { label: 'Triaged Bugs', value: kpis.newBugs, icon: Bug, sub: `New Priority Isolations`, color: 'text-red-500', bg: 'bg-red-500/10' },
      { label: 'Feature Validations', value: kpis.newFeatures, icon: Lightbulb, sub: `Under Review`, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      { label: 'Unread Contact Proxies', value: kpis.newContacts, icon: AlertCircle, sub: `Public Gateway`, color: 'text-pink-500', bg: 'bg-pink-500/10' },
      { label: 'Resolved Volume', value: kpis.resolved, icon: Activity, sub: `${kpis.averageSatisfaction > 0 ? (kpis.averageSatisfaction).toFixed(1) + '/5 ★ CSAT' : 'No CSAT Registered'}`, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
   ];

   return (
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
             <div>
               <h1 className="text-2xl font-black text-emerald-500 tracking-wide flex items-center gap-3">
                 <LifeBuoy size={28} /> Customer Success Headquarters
               </h1>
               <p className="text-emerald-500/70 text-sm mt-2 font-medium max-w-2xl">
                 Omnichannel support aggregation mapping native Bug Reports, Timelines, and Support Tickets entirely within JAHZJournal structural limits. Backwards compatible implicitly.
               </p>
             </div>
         </div>

         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((m, idx) => {
               const Icon = m.icon;
               return (
                  <div key={idx} className="p-6 rounded-xl border border-border bg-surface flex flex-col justify-between hover:shadow-lg transition">
                     <div className="flex items-center gap-3 mb-4">
                        <div className={`p-3 rounded-xl ${m.bg} ${m.color}`}><Icon size={22} /></div>
                        <div className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{m.label}</div>
                     </div>
                     <div className="mt-auto">
                        <div className="text-4xl font-black text-foreground">{m.value}</div>
                        <div className={`text-xs font-bold uppercase tracking-widest mt-2 ${m.color}`}>{m.sub}</div>
                     </div>
                  </div>
               )
            })}
         </div>

         {/* Chart Placeholder for future implementation avoiding heavy dependencies mapping pure KPIs */}
         <div className="h-64 mt-6 border border-border bg-surface-muted rounded-xl flex items-center justify-center p-8 text-center flex-col">
            <Activity className="opacity-20 mb-4" size={40} />
            <h3 className="font-bold text-muted-foreground">Analytic Arrays Active</h3>
            <p className="text-xs text-muted-foreground opacity-60 max-w-sm mt-2">Dynamic Line Chart endpoints mapping resolution times and satisfaction trends exist natively underneath Phase 5 APIs.</p>
         </div>
      </div>
   );
};

// Internal icon import resolving above bounds
import { LifeBuoy } from 'lucide-react';
export default CustomerSuccessDashboard;
