import React from 'react';
import { Check } from 'lucide-react';
import Button from './Button';

const PricingCard = ({ name, price, description, features, highlighted = false, cta = 'Start Free', to = '/register' }) => (
  <div className={`relative flex h-full flex-col rounded-xl border p-6 transition-all duration-200 hover:-translate-y-1 ${
    highlighted
      ? 'border-emerald-400/60 bg-emerald-400/[0.08] shadow-[0_0_40px_rgba(52,211,153,0.12)]'
      : 'border-white/10 bg-white/[0.04]'
  }`}>
    {highlighted && (
      <div className="absolute right-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-gray-950">
        Popular
      </div>
    )}
    <h3 className="text-xl font-bold text-white">{name}</h3>
    <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    <div className="mt-6 text-3xl font-bold text-white">{price}</div>
    <ul className="mt-6 flex-1 space-y-3">
      {features.map((feature) => (
        <li key={feature} className="flex gap-3 text-sm text-muted">
          <Check size={18} className="mt-0.5 shrink-0 text-emerald-300" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <Button to={to} variant={highlighted ? 'primary' : 'secondary'} className="mt-7 w-full">
      {cta}
    </Button>
  </div>
);

export default PricingCard;
