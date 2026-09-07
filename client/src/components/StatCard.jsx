import React from 'react';

const StatCard = ({ label, value, tone = 'emerald' }) => {
  const tones = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    cyan: 'text-cyan-700 dark:text-cyan-300',
    red: 'text-rose-700 dark:text-red-300',
    white: 'text-foreground',
  };

  const valStr = String(value || '');
  const fontSizeClass = valStr.length > 14 ? 'text-base sm:text-lg' : valStr.length > 10 ? 'text-lg sm:text-xl' : 'text-2xl';

  return (
    <div className="rounded-xl border border-border dark:border-white/10 bg-surface/70 p-4 min-w-0">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500 truncate">{label}</p>
      <p 
        title={valStr}
        className={`mt-2 font-mono font-bold whitespace-nowrap truncate ${fontSizeClass} ${tones[tone] || tones.white}`}
      >
        {value}
      </p>
    </div>
  );
};

export default StatCard;
