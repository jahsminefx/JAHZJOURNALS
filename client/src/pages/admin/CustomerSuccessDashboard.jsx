import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Activity, Users, AlertCircle, MessageSquare, Ticket, Bug, Lightbulb, LifeBuoy } from 'lucide-react';
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
      { label: 'Open Support Tickets', value: kpis.waitingAdmin, icon: Ticket, sub: `${kpis.totalOpenTickets} Total Open`, color: 'text-amber-500', bg: 'bg-amber-500/10' },
      { label: 'Awaiting User Reply', value: kpis.waitingUser, icon: MessageSquare, sub: `Waiting for Trader`, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { label: 'Reported Bugs', value: kpis.newBugs, icon: Bug, sub: `Needs Investigation`, color: 'text-red-500', bg: 'bg-red-500/10' },
      { label: 'Feature Ideas', value: kpis.newFeatures, icon: Lightbulb, sub: `Under Review`, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      { label: 'New Contact Messages', value: kpis.newContacts, icon: AlertCircle, sub: `From Contact Form`, color: 'text-pink-500', bg: 'bg-pink-500/10' },
      { label: 'Resolved Tickets', value: kpis.resolved, icon: Activity, sub: `${kpis.averageSatisfaction > 0 ? (kpis.averageSatisfaction).toFixed(1) + '/5 ★ CSAT' : 'No ratings yet'}`, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
   ];

   return (
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 sm:p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
             <div className="min-w-0">
               <h1 className="text-xl sm:text-2xl font-black text-emerald-500 tracking-wide flex items-center gap-3">
                 <LifeBuoy size={24} className="shrink-0" /> <span>Customer Support &amp; Feedback</span>
               </h1>
               <p className="text-emerald-600/80 dark:text-emerald-400/80 text-sm mt-2 font-medium max-w-2xl">
                 Manage customer support tickets, reported bugs, feature requests, and contact inquiries in one central place.
               </p>
             </div>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {metrics.map((m, idx) => {
               const Icon = m.icon;
               return (
                  <div key={idx} className="p-4 sm:p-6 rounded-xl border border-border bg-surface flex flex-col justify-between hover:shadow-lg transition">
                     <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${m.bg} ${m.color}`}><Icon size={20} /></div>
                        <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-muted-foreground">{m.label}</div>
                     </div>
                     <div className="mt-auto">
                        <div className="text-3xl sm:text-4xl font-black text-foreground">{m.value}</div>
                        <div className={`text-xs font-bold uppercase tracking-widest mt-2 ${m.color}`}>{m.sub}</div>
                     </div>
                  </div>
               )
            })}
         </div>

         <div className="min-h-[160px] mt-6 border border-border bg-surface-muted/30 rounded-xl flex items-center justify-center p-6 sm:p-8 text-center flex-col">
            <Activity className="opacity-20 mb-3" size={36} />
            <h3 className="font-bold text-muted-foreground text-sm">Response Time & Satisfaction Trends</h3>
            <p className="text-xs text-muted-foreground opacity-70 max-w-sm mt-1">Detailed charts tracking resolution speeds and satisfaction ratings will appear here as more tickets are resolved.</p>
         </div>
      </div>
   );
};

export default CustomerSuccessDashboard;
