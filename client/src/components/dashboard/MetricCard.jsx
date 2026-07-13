import React from 'react';

const accentClasses = {
  positive: {
    icon: 'bg-emerald-50 text-emerald-700 shadow-none dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[0_0_22px_rgba(16,185,129,0.12)]',
    value: 'text-emerald-700 dark:text-emerald-300',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    sparkline: '#10b981',
    glow: 'from-emerald-500/5 dark:from-emerald-500/12',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-700 shadow-none dark:bg-sky-500/10 dark:text-sky-300 dark:shadow-[0_0_22px_rgba(56,189,248,0.1)]',
    value: 'text-sky-700 dark:text-slate-50',
    badge: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300',
    sparkline: '#38bdf8',
    glow: 'from-sky-500/5 dark:from-sky-500/12',
  },
  purple: {
    icon: 'bg-violet-50 text-violet-700 shadow-none dark:bg-violet-500/10 dark:text-violet-300 dark:shadow-[0_0_22px_rgba(139,92,246,0.1)]',
    value: 'text-violet-700 dark:text-slate-50',
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300',
    sparkline: '#8b5cf6',
    glow: 'from-violet-500/5 dark:from-violet-500/12',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 shadow-none dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-[0_0_22px_rgba(245,158,11,0.1)]',
    value: 'text-amber-700 dark:text-slate-50',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300',
    sparkline: '#f59e0b',
    glow: 'from-amber-500/5 dark:from-amber-500/12',
  },
  negative: {
    icon: 'bg-red-50 text-red-700 shadow-none dark:bg-red-500/10 dark:text-red-300 dark:shadow-[0_0_22px_rgba(239,68,68,0.1)]',
    value: 'text-red-700 dark:text-red-300',
    badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300',
    sparkline: '#ef4444',
    glow: 'from-red-500/5 dark:from-red-500/12',
  },
  neutral: {
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-foreground',
    value: 'text-foreground dark:text-slate-50',
    badge: 'border-border bg-surface text-foreground dark:border-slate-500/30 dark:bg-surface/80',
    sparkline: '#94a3b8',
    glow: 'from-slate-500/5 dark:from-slate-500/10',
  },
};

const valueTones = {
  positive: 'text-emerald-700 dark:text-emerald-300',
  negative: 'text-red-700 dark:text-red-300',
  neutral: 'text-foreground dark:text-slate-50',
  muted: 'text-muted',
  blue: 'text-sky-700 dark:text-sky-300',
  purple: 'text-violet-700 dark:text-violet-300',
  amber: 'text-amber-700 dark:text-amber-300',
};



const MetricCard = ({
  icon: Icon,
  label,
  value,
  accent = 'neutral',
  valueTone,
  statusTone,
  supportingText,
}) => {
  const theme = accentClasses[accent] || accentClasses.neutral;
  const valueClass = valueTones[valueTone] || theme.value;
  const badgeClass = accentClasses[statusTone]?.badge || accentClasses.neutral.badge;

  return (
    <article className="group relative flex min-h-[9.5rem] min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 dark:border-slate-400/15 dark:shadow-[0_18px_40px_rgba(2,6,23,0.26)] dark:hover:border-slate-300/25 dark:hover:shadow-[0_22px_48px_rgba(2,6,23,0.34)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.glow} via-transparent to-transparent opacity-80`} />
      <div className="relative flex min-w-0 items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.icon}`} aria-hidden="true">
          <Icon size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className={`mt-2 max-w-full break-words font-mono text-[1.65rem] font-black leading-none tracking-normal sm:text-[1.85rem] ${valueClass}`}>
            {value}
          </p>
        </div>
        {status && (
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${badgeClass}`}>
            {status}
          </span>
        )}
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5 text-muted">{supportingText}</p>
      </div>
    </article>
  );
};

export default MetricCard;
