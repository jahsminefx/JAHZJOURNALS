import React from 'react';

const StatCard = ({ label, value, tone = 'emerald' }) => {
  const tones = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    cyan: 'text-cyan-700 dark:text-cyan-300',
    red: 'text-rose-700 dark:text-red-300',
    white: 'text-foreground',
  };

  return (
    <div className="rounded-xl border border-border dark:border-white/10 bg-surface/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
};

export default StatCard;
