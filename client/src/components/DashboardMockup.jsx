import React from 'react';
import { Camera, LineChart, ShieldCheck } from 'lucide-react';
import StatCard from './StatCard';

const DashboardMockup = () => (
  <div className="relative rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-background/80 p-4 shadow-xl dark:shadow-emerald-950/30">
    <div className="absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-emerald-400/30 via-cyan-400/10 to-transparent blur-xl" />
    <div className="flex items-center justify-between border-b border-border dark:border-white/10 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-400">Trader Dashboard</p>
        <h3 className="mt-1 font-bold text-foreground">Weekly Edge Review</h3>
      </div>
      <div className="rounded-full bg-slate-900 text-white dark:bg-emerald-400/20 dark:text-emerald-300 px-3.5 py-1 text-xs font-extrabold shadow-sm">
        Live discipline
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      <StatCard label="Win rate" value="62%" />
      <StatCard label="Discipline" value="84/100" tone="cyan" />
      <StatCard label="Best pair" value="GBPUSD" tone="white" />
      <StatCard label="Net P/L" value="+$1,240" />
    </div>

    <div className="mt-4 rounded-xl border border-border bg-surface-muted dark:border-white/10 dark:bg-white/[0.03] p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <LineChart size={18} className="text-emerald-700 dark:text-emerald-300" />
          Equity curve
        </span>
        <span className="text-xs font-semibold text-muted">Last 30 trades</span>
      </div>
      <div className="flex h-28 items-end gap-2">
        {[34, 42, 38, 50, 46, 57, 62, 58, 68, 73, 70, 82].map((height, index) => (
          <div key={index} className="flex-1 rounded-t bg-emerald-500 dark:bg-emerald-400/80" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface-muted dark:border-white/10 dark:bg-white/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Recent trade</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground">GBPUSD Buy</p>
            <p className="text-xs font-medium text-muted">London session · FVG setup</p>
          </div>
          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">+$280</span>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-cyan-500/40 bg-cyan-500/10 p-4">
        <Camera size={22} className="text-cyan-700 dark:text-cyan-300" />
        <p className="mt-3 font-bold text-foreground">Chart screenshot</p>
        <p className="text-xs font-medium text-muted">Before entry, entry, exit, and marked review.</p>
      </div>
    </div>

    <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-muted dark:border-white/10 dark:bg-white/[0.03] p-3 text-sm text-foreground">
      <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-300" />
      Worst pair this week: <span className="font-bold text-rose-700 dark:text-red-300">XAUUSD</span>
    </div>
  </div>
);

export default DashboardMockup;
