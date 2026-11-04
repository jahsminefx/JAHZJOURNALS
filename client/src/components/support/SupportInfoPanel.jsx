import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, Mail, ShieldCheck, ArrowUpRight, LineChart,
  CreditCard, Settings, BookOpen, Layers, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const COMMON_HELP_TOPICS = [
  {
    title: 'MT5 Cloud Sync',
    desc: 'Connect MetaTrader 5 accounts & auto-sync trades',
    path: '/accounts',
    icon: Layers,
  },
  {
    title: 'Trading Analytics',
    desc: 'Understand win rates, profit factor & drawdown',
    path: '/analytics',
    icon: LineChart,
  },
  {
    title: 'Subscription & Plans',
    desc: 'Starter, Pro Sync & Mentor tier details',
    path: '/pricing',
    icon: CreditCard,
  },
  {
    title: 'Account & Security',
    desc: 'Password, push alerts & session management',
    path: '/settings',
    icon: Settings,
  },
  {
    title: 'Trading Rules',
    desc: 'Define custom strategy rules & risk guard',
    path: '/rules',
    icon: BookOpen,
  },
];

export default function SupportInfoPanel({ className = '' }) {
  const { user } = useAuth();

  return (
    <div className={`space-y-4 select-none ${className}`}>
      {/* 1. Support Availability & Operational Hours */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Clock size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Support Availability</h4>
            <p className="text-[11px] text-muted">Direct Super Admin desk</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-muted leading-relaxed">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
            <span>Monitored during active London & New York market sessions (08:00 – 22:00 UTC).</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
            <span>Typical reply turnaround is under a few hours for authenticated traders.</span>
          </div>
        </div>
      </div>

      {/* 2. Common Help Topics */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
          <span>Common Topics</span>
          <span className="text-[10px] lowercase text-muted font-normal">direct links</span>
        </h4>

        <div className="space-y-1.5">
          {COMMON_HELP_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <Link
                key={topic.title}
                to={topic.path}
                className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-muted border border-transparent hover:border-border transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-surface-muted group-hover:bg-background text-muted group-hover:text-foreground transition shrink-0">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground group-hover:text-emerald-500 transition truncate">
                      {topic.title}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      {topic.desc}
                    </p>
                  </div>
                </div>
                <ArrowUpRight size={13} className="text-muted group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. Direct Contact & Escalation */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
          Direct Email Contact
        </h4>
        <p className="text-xs text-muted mb-3 leading-relaxed">
          For urgent inquiries or account recovery, email our administrative team directly:
        </p>
        <a
          href="mailto:jahzjournals@gmail.com"
          className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-muted/50 hover:bg-surface-muted text-xs font-semibold text-foreground transition group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Mail size={14} className="text-emerald-500 shrink-0" />
            <span className="truncate">jahzjournals@gmail.com</span>
          </div>
          <ArrowUpRight size={13} className="text-muted group-hover:text-foreground transition shrink-0" />
        </a>
      </div>

      {/* 4. Authenticated Channel Privacy */}
      <div className="rounded-2xl border border-border/80 bg-surface-muted/30 p-3.5 sm:p-4 text-xs text-muted">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <strong className="text-foreground font-semibold">Account-Bound Channel:</strong> Your messages are linked to your authenticated trading account ({user?.email || 'authenticated'}). Conversation history is securely stored for continuity.
          </div>
        </div>
      </div>
    </div>
  );
}
