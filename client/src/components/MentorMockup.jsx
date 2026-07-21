import React from 'react';
import StatCard from './StatCard';

const MentorMockup = () => (
  <div className="rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-background/80 p-5 shadow-xl dark:shadow-emerald-950/20">
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Mentor Workspace</p>
      <h3 className="mt-1 text-xl font-bold text-foreground">Academy Review Board</h3>
    </div>
    <div className="mt-5 grid grid-cols-3 gap-3">
      <StatCard label="Students" value="24" />
      <StatCard label="Pending" value="8" tone="cyan" />
      <StatCard label="Avg score" value="76" tone="white" />
    </div>
    <div className="mt-5 space-y-3">
      {[
        ['Amina K.', 'Top improving student', '82 discipline'],
        ['David O.', 'Feedback pending', '3 screenshots'],
        ['Chinedu M.', 'Rule violation review', '2 issues'],
        ['Fatima A.', 'Weekly review complete', '91 score'],
        ['Tolu S.', 'Needs risk feedback', '1 warning'],
        ['Grace E.', 'Strong execution week', '88 discipline'],
      ].map(([name, note, stat]) => (
        <div key={name} className="flex items-center justify-between rounded-xl border border-border bg-surface-muted dark:border-white/10 dark:bg-white/[0.03] p-3">
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-sm text-muted">{note}</p>
          </div>
          <span className="text-xs font-semibold text-emerald-300">{stat}</span>
        </div>
      ))}
    </div>
  </div>
);

export default MentorMockup;
