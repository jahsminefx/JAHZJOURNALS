import React from 'react';
import { Camera, LineChart, ShieldCheck } from 'lucide-react';
import StatCard from './StatCard';

const DashboardMockup = () => (
  <div className="relative rounded-2xl border border-white/10 bg-background/80 p-4 shadow-2xl shadow-emerald-950/30">
    <div className="absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-emerald-400/30 via-cyan-400/10 to-transparent blur-xl" />
    <div className="flex items-center justify-between border-b border-white/10 pb-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Trader Dashboard</p>
        <h3 className="mt-1 font-bold text-white">Weekly Edge Review</h3>
      </div>
      <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        Live discipline
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      <StatCard label="Win rate" value="62%" />
      <StatCard label="Discipline" value="84/100" tone="cyan" />
      <StatCard label="Best pair" value="GBPUSD" tone="white" />
      <StatCard label="Net P/L" value="+$1,240" />
    </div>

    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <LineChart size={18} className="text-emerald-300" />
          Equity curve
        </span>
        <span className="text-xs text-muted">Last 30 trades</span>
      </div>
      <div className="flex h-28 items-end gap-2">
        {[34, 42, 38, 50, 46, 57, 62, 58, 68, 73, 70, 82].map((height, index) => (
          <div key={index} className="flex-1 rounded-t bg-emerald-400/80" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Recent trade</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-white">GBPUSD Buy</p>
            <p className="text-sm text-muted">London session · FVG setup</p>
          </div>
          <span className="text-sm font-bold text-emerald-300">+$280</span>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-cyan-300/30 bg-cyan-300/5 p-4">
        <Camera size={22} className="text-cyan-300" />
        <p className="mt-3 font-semibold text-white">Chart screenshot</p>
        <p className="text-sm text-muted">Before entry, entry, exit, and marked review.</p>
      </div>
    </div>

    <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted">
      <ShieldCheck size={18} className="text-emerald-300" />
      Worst pair this week: <span className="font-semibold text-red-300">XAUUSD</span>
    </div>
  </div>
);

export default DashboardMockup;
