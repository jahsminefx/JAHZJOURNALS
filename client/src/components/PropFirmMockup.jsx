import React from 'react';
import StatCard from './StatCard';
import { FloatingVisual, Reveal } from './motion/MotionSystem';

const PropFirmMockup = () => (
  <Reveal direction="up" scale={0.98} duration={680}>
    <FloatingVisual ambientGlow>
      <div className="rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-background/80 p-5 shadow-xl dark:shadow-cyan-950/20 transition-colors duration-200 hover:border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Challenge Tracker</p>
            <h3 className="mt-1 text-xl font-bold text-foreground">Phase 1 Account</h3>
          </div>
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">47% progress</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard label="Account size" value="$10,000" tone="white" animate />
          <StatCard label="Profit target" value="10%" animate />
          <StatCard label="Daily drawdown" value="3%" tone="red" animate />
          <StatCard label="Max drawdown" value="8%" tone="red" animate />
        </div>
        <div className="mt-5 rounded-xl border border-border bg-surface-muted dark:border-white/10 dark:bg-white/[0.03] p-4 transition-colors duration-200 hover:border-emerald-500/25">
          <div className="flex justify-between text-sm text-muted">
            <span>Current progress</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">47%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-[47%] rounded-full bg-emerald-400" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
            <span>Rules followed: 9/10</span>
            <span>Trading days: 5/10</span>
          </div>
        </div>
      </div>
    </FloatingVisual>
  </Reveal>
);

export default PropFirmMockup;
