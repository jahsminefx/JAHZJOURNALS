import React from 'react';

export const DashboardCard = ({ children, className = '' }) => (
  <section className={`min-w-0 overflow-hidden rounded-xl border border-border/80 bg-surface shadow-sm ${className}`}>
    {children}
  </section>
);

export const CardHeader = ({ title, eyebrow, action }) => (
  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-foreground sm:text-base">{title}</h3>
      {eyebrow && <p className="mt-0.5 text-xs leading-4 text-muted">{eyebrow}</p>}
    </div>
    {action}
  </div>
);
