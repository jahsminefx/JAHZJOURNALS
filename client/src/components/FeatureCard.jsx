import React from 'react';

const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="group rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-surface-muted dark:hover:bg-white/[0.07]">
    {Icon && (
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300">
        <Icon size={22} />
      </div>
    )}
    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
  </div>
);

export default FeatureCard;
