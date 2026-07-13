import React from 'react';

export const DashboardCard = ({ children, className = '' }) => (
  <section className={`min-w-0 overflow-hidden rounded-lg border border-border/80 bg-surface shadow-[0_0_28px_rgba(15,23,42,0.35)] ${className}`}>
    {children}
  </section>
);

export const CardHeader = ({ title, eyebrow, action }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-foreground sm:text-base">{title}</h3>
      {eyebrow && <p className="mt-1 text-xs leading-5 text-muted">{eyebrow}</p>}
    </div>
    {action}
  </div>
);
