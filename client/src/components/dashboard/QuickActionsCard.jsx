import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Calculator, BookOpen, Sparkles, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';

const getCurrentSessions = () => {
  const now = new Date();
  const utcHours = now.getUTCHours();
  
  // London: 08:00 - 16:30 UTC
  // New York: 13:00 - 21:00 UTC
  // Asian/Tokyo: 00:00 - 09:00 UTC
  const isLondon = utcHours >= 8 && utcHours < 17;
  const isNewYork = utcHours >= 13 && utcHours < 21;
  const isAsian = utcHours >= 0 && utcHours < 9;

  return [
    { name: 'London', active: isLondon, time: '08:00 - 17:00 UTC' },
    { name: 'New York', active: isNewYork, time: '13:00 - 21:00 UTC' },
    { name: 'Asian / Tokyo', active: isAsian, time: '00:00 - 09:00 UTC' },
  ];
};

const QuickActionsCard = ({ className = '' }) => {
  const [sessions, setSessions] = useState(getCurrentSessions);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessions(getCurrentSessions());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader 
        title="Quick Actions & Hub" 
        eyebrow="Fast execution tools & live market sessions"
      />

      {/* Live Market Sessions */}
      <div className="mb-4 rounded-xl border border-border/80 bg-background/60 p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Clock size={14} className="text-indigo-400" /> Live Market Sessions
          </span>
          <span className="text-[11px] font-mono text-muted">UTC Time</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {sessions.map((s) => (
            <div 
              key={s.name} 
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition ${
                s.active 
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                  : 'border-border/50 bg-surface-muted/30 text-muted'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${s.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-bold leading-none">{s.name}</span>
              </div>
              <span className="text-[10px] mt-1 text-muted leading-none">
                {s.active ? 'OPEN NOW' : 'Closed'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/trades/quick"
          className="group flex flex-col justify-between p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/15 hover:border-indigo-500/40 transition"
        >
          <div className="flex items-center justify-between text-indigo-400">
            <PlusCircle size={18} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition" />
          </div>
          <div className="mt-2.5">
            <p className="text-xs font-bold text-foreground">Log New Trade</p>
            <p className="text-[11px] text-muted">Quick trade entry</p>
          </div>
        </Link>

        <Link
          to="/risk-calculator"
          className="group flex flex-col justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/40 transition"
        >
          <div className="flex items-center justify-between text-emerald-400">
            <Calculator size={18} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition" />
          </div>
          <div className="mt-2.5">
            <p className="text-xs font-bold text-foreground">Risk Calculator</p>
            <p className="text-[11px] text-muted">Position size & lots</p>
          </div>
        </Link>

        <Link
          to="/daily-review"
          className="group flex flex-col justify-between p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 hover:border-amber-500/40 transition"
        >
          <div className="flex items-center justify-between text-amber-400">
            <BookOpen size={18} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition" />
          </div>
          <div className="mt-2.5">
            <p className="text-xs font-bold text-foreground">Daily Review</p>
            <p className="text-[11px] text-muted">Journal & psychology</p>
          </div>
        </Link>

        <Link
          to="/ai"
          className="group flex flex-col justify-between p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/15 hover:border-purple-500/40 transition"
        >
          <div className="flex items-center justify-between text-purple-400">
            <Sparkles size={18} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition" />
          </div>
          <div className="mt-2.5">
            <p className="text-xs font-bold text-foreground">AI Edge Coach</p>
            <p className="text-[11px] text-muted">Automated playbook</p>
          </div>
        </Link>
      </div>
    </DashboardCard>
  );
};

export default QuickActionsCard;
