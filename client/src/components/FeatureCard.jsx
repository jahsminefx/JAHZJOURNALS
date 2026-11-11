import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, to }) => {
  const cardMarkup = (
    <div
      className={`group rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-surface-muted dark:hover:bg-white/[0.07] ${
        to ? 'cursor-pointer h-full' : ''
      }`}
    >
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300">
          <Icon size={22} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {to && (
          <ArrowRight
            size={16}
            className="text-muted group-hover:text-emerald-400 group-hover:translate-x-1 transition-all"
          />
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {cardMarkup}
      </Link>
    );
  }

  return cardMarkup;
};

export default FeatureCard;
