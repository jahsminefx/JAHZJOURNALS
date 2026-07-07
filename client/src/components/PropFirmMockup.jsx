import React from 'react';
import StatCard from './StatCard';

const PropFirmMockup = () => (
  <div className="rounded-2xl border border-white/10 bg-gray-950/80 p-5 shadow-2xl shadow-cyan-950/20">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Challenge Tracker</p>
        <h3 className="mt-1 text-xl font-bold text-white">Phase 1 Account</h3>
      </div>
      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">47% progress</span>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3">
      <StatCard label="Account size" value="$10,000" tone="white" />
      <StatCard label="Profit target" value="10%" />
      <StatCard label="Daily drawdown" value="3%" tone="red" />
      <StatCard label="Max drawdown" value="8%" tone="red" />
    </div>
    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex justify-between text-sm text-gray-300">
        <span>Current progress</span>
        <span className="font-semibold text-emerald-300">47%</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-800">
        <div className="h-full w-[47%] rounded-full bg-emerald-400" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
        <span>Rules followed: 9/10</span>
        <span>Trading days: 5/10</span>
      </div>
    </div>
  </div>
);

export default PropFirmMockup;
