import React from 'react';
import { Check } from 'lucide-react';
import Button from './Button';

const PricingCard = ({
  name,
  category,
  tagline,
  price,
  originalPrice,
  period = '/month',
  description,
  features = [],
  limits = [],
  highlighted = false,
  badgeText,
  badgeVariant = 'emerald', // 'emerald' | 'amber' | 'sky' | 'muted'
  cta = 'Start Free',
  onClick,
  to,
  planHeader,
  waitlistCount,
  isWaitlist = false,
  disabled = false,
  className = '',
}) => {
  const badgeClasses = {
    emerald: 'bg-emerald-400 text-slate-950 font-black',
    amber: 'bg-amber-400 text-slate-950 font-black',
    sky: 'bg-sky-400 text-slate-950 font-black',
    muted: 'bg-surface-muted text-foreground border border-border font-bold',
  };

  const activeBadgeText = badgeText || (highlighted ? 'Best for Serious Traders' : null);
  const isFree = price === '₦0' || price === '$0' || name?.toLowerCase() === 'free';
  const isSyncCard = isWaitlist || name?.toLowerCase().includes('sync');

  return (
    <div
      className={`relative flex h-full min-h-[500px] w-full flex-col rounded-[1.25rem] border p-6 sm:p-7 transition-all duration-200 ${
        highlighted
          ? 'border-emerald-500/80 dark:border-emerald-400/80 bg-emerald-500/[0.03] dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/40'
          : isSyncCard
          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] shadow-sm hover:border-sky-500/40'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
      } ${className}`}
    >
      {/* Top Floating Badge */}
      {activeBadgeText && (
        <div
          className={`absolute -top-3.5 right-6 rounded-full px-3.5 py-1 text-xs shadow-sm tracking-wide ${
            badgeClasses[badgeVariant] || badgeClasses.emerald
          }`}
        >
          {activeBadgeText}
        </div>
      )}

      {/* 1. Plan Name & 2. Category / Short Tagline */}
      <div className="space-y-1">
        <h3 className="text-2xl font-black text-foreground tracking-tight">{name}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {category && (
            <span className="text-[11px] font-black uppercase tracking-wider text-muted/70">
              {category}
            </span>
          )}
          {tagline && (
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {tagline}
            </p>
          )}
        </div>
      </div>

      {/* 3. Short Plan Description */}
      <p className="mt-3 text-[13px] leading-relaxed text-muted min-h-[40px]">
        {description}
      </p>

      {/* 4. Price and Billing Period */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-baseline gap-2 flex-wrap">
          {originalPrice && (
            <span className="text-base sm:text-lg line-through text-muted/60 font-semibold">
              {originalPrice}
            </span>
          )}
          <span className="text-3xl sm:text-4xl lg:text-[2.5rem] font-black tracking-tight text-foreground whitespace-nowrap">
            {price}
          </span>
          {price !== 'Custom' && (
            <span className="text-sm font-medium text-muted">
              {isFree ? '/forever' : period}
            </span>
          )}
        </div>

        {/* Free Plan Subtext or Waitlist Counter */}
        {isFree && (
          <p className="mt-1.5 text-xs text-muted/80 font-medium">
            100% Free • No credit card required
          </p>
        )}

        {waitlistCount && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-500 dark:text-sky-400 text-xs font-bold">
            <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>{waitlistCount} traders on the waitlist</span>
          </div>
        )}
      </div>

      {/* 5. Value Proposition & Key Limits */}
      {(planHeader || (limits && limits.length > 0)) && (
        <div className="mt-5 space-y-3">
          {planHeader && (
            <div
              className={`rounded-xl border p-3.5 text-left ${
                highlighted
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : isSyncCard
                  ? 'border-sky-500/30 bg-sky-500/10'
                  : 'border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <p className="text-xs font-bold text-foreground leading-snug">
                {typeof planHeader === 'string'
                  ? planHeader
                  : planHeader.title || planHeader.description}
              </p>
            </div>
          )}

          {limits && limits.length > 0 && (
            <div className="space-y-1.5 text-xs text-muted font-medium">
              {limits.map((limit, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{limit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Feature List */}
      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-muted mb-3.5">
          What&apos;s included:
        </p>
        <ul className="space-y-3 sm:space-y-3.5">
          {features.map((feature, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-sm sm:text-[14.5px] leading-snug text-slate-700 dark:text-slate-300"
            >
              <Check
                size={17}
                className="mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400 font-bold"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 7. CTA Button Anchored Toward the Bottom */}
      <div className="mt-8 pt-4">
        {onClick ? (
          <Button
            onClick={onClick}
            variant={highlighted ? 'primary' : 'secondary'}
            size="lg"
            disabled={disabled}
            className={`w-full py-3.5 text-sm font-bold shadow-sm transition-all ${
              highlighted ? 'shadow-emerald-500/20' : ''
            }`}
          >
            {cta}
          </Button>
        ) : to ? (
          <Button
            to={to}
            variant={highlighted ? 'primary' : 'secondary'}
            size="lg"
            disabled={disabled}
            className={`w-full py-3.5 text-sm font-bold shadow-sm transition-all ${
              highlighted ? 'shadow-emerald-500/20' : ''
            }`}
          >
            {cta}
          </Button>
        ) : (
          <Button
            disabled
            variant={highlighted ? 'primary' : 'secondary'}
            size="lg"
            className="w-full py-3.5 text-sm font-bold opacity-50 cursor-not-allowed"
          >
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
};

export default PricingCard;
