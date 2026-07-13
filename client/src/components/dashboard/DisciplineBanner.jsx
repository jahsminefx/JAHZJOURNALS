import React from 'react';
import { Target } from 'lucide-react';

const DisciplineBanner = () => (
  <section className="relative overflow-hidden rounded-xl border border-emerald-500/15 bg-background p-5 shadow-[0_0_35px_rgba(16,185,129,0.06)]">
    <div className="absolute inset-y-0 right-0 hidden w-2/3 opacity-50 md:block">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-emerald-950/40 to-transparent" />
      <svg viewBox="0 0 640 160" className="h-full w-full" role="img" aria-label="Subtle market wave">
        <path d="M0 120 C80 95 110 135 180 90 S295 115 350 65 460 78 520 38 590 54 640 25" fill="none" stroke="#22c55e" strokeWidth="4" opacity="0.55" />
        {Array.from({ length: 32 }).map((_, index) => {
          const x = index * 21;
          const height = 18 + ((index * 13) % 58);
          return (
            <rect
              key={x}
              x={x}
              y={130 - height}
              width="7"
              height={height}
              rx="3"
              fill={index % 3 === 0 ? '#16a34a' : '#064e3b'}
              opacity="0.65"
            />
          );
        })}
      </svg>
    </div>
    <div className="relative flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
        <Target size={26} />
      </div>
      <div>
        <h3 className="text-lg font-black text-foreground">Discipline today, freedom tomorrow.</h3>
        <p className="mt-1 text-sm text-muted">Stay consistent. The results will follow.</p>
      </div>
    </div>
  </section>
);

export default DisciplineBanner;
