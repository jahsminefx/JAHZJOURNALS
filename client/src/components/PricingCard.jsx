import React from 'react';
import { Check } from 'lucide-react';
import Button from './Button';

const PricingCard = ({
  name,
  tagline,
  price,
  period = '/month',
  description,
  features,
  limits,
  highlighted = false,
  cta = 'Start Free',
  onClick,
  to
}) => (
  <div className={`relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 ${
    highlighted
      ? 'border-emerald-400/60 bg-emerald-400/[0.08] shadow-[0_0_40px_rgba(52,211,153,0.15)] ring-1 ring-emerald-400/50'
      : 'border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] shadow-sm dark:shadow-none'
  }`}>
    {highlighted && (
      <div className="absolute -top-3.5 right-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-gray-950 shadow-md">
        Recommended
      </div>
    )}

    <div className="space-y-1">
      <h3 className="text-xl font-black text-foreground tracking-tight">{name}</h3>
      {tagline && (
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">{tagline}</p>
      )}
    </div>

    <p className="mt-3 text-xs leading-5 text-muted min-h-[40px]">{description}</p>

    <div className="mt-6 flex items-baseline gap-1">
      <span className="text-3xl font-black text-foreground">{price}</span>
      {price !== 'Custom' && <span className="text-xs text-muted font-medium">{period}</span>}
    </div>

    {limits && limits.length > 0 && (
      <div className="mt-4 pt-4 border-t border-gray-800 space-y-1.5 text-xs text-gray-300 font-medium">
        {limits.map((limit, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{limit}</span>
          </div>
        ))}
      </div>
    )}

    <ul className="mt-6 flex-1 space-y-3 pt-4 border-t border-gray-800/60">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2.5 text-xs text-muted">
          <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>

    {onClick ? (
      <Button onClick={onClick} variant={highlighted ? 'primary' : 'secondary'} className="mt-7 w-full">
        {cta}
      </Button>
    ) : to ? (
      <Button to={to} variant={highlighted ? 'primary' : 'secondary'} className="mt-7 w-full">
        {cta}
      </Button>
    ) : (
      <Button disabled variant={highlighted ? 'primary' : 'secondary'} className="mt-7 w-full opacity-50 cursor-not-allowed">
        {cta}
      </Button>
    )}
  </div>
);

export default PricingCard;
