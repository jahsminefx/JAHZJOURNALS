import React from 'react';

const StatCard = ({ label, value, tone = 'emerald' }) => {
  const tones = {
    emerald: 'text-emerald-300',
    cyan: 'text-cyan-300',
    red: 'text-red-300',
    white: 'text-white',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
};

export default StatCard;
