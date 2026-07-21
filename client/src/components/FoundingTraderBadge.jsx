import React, { useState } from 'react';
import { Medal, CheckCircle2, Clock, X } from 'lucide-react';
import { format } from 'date-fns';

const FoundingTraderBadge = ({ subscription, badgeName = 'Founding Trader', badgeColor = 'amber', variant = 'badge' }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!subscription || subscription.source !== 'PROMOTION') return null;
  const promotion = subscription.promotion;

  let colorClass = 'text-amber-400';
  let bgClass = 'bg-amber-400/10';
  let borderClass = 'border-amber-400/20';

  if (badgeColor === 'emerald') { colorClass = 'text-emerald-400'; bgClass = 'bg-emerald-400/10'; borderClass='border-emerald-400/20'; }
  if (badgeColor === 'blue') { colorClass = 'text-blue-400'; bgClass = 'bg-blue-400/10'; borderClass='border-blue-400/20'; }

  return (
    <>
      {variant === 'button' ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
        >
          Learn More
        </button>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${bgClass} ${colorClass} ${borderClass} border rounded-full text-xs font-bold transition hover:bg-opacity-80`}
          aria-label={`View ${badgeName} details`}
        >
          <Medal size={14} />
          {badgeName}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-background border border-border shadow-2xl relative">
            <div className={`p-6 border-b border-border flex items-center gap-3`}>
               <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${bgClass} ${colorClass}`}>
                 <Medal size={24} />
               </div>
               <div>
                  <h2 id="modal-title" className="text-xl font-bold text-foreground">{badgeName}</h2>
                  <p className="text-sm text-muted">Complimentary Premium Access</p>
               </div>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Launch Benefits</h3>
                <ul className="space-y-3">
                  {promotion?.benefits?.length > 0 ? promotion.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <CheckCircle2 size={16} className={`${colorClass} shrink-0 mt-0.5`} /> {benefit}
                    </li>
                  )) : (
                    <>
                      <li className="flex items-start gap-2 text-sm text-foreground/80"><CheckCircle2 size={16} className={`${colorClass} shrink-0 mt-0.5`} /> Complimentary PRO access</li>
                      <li className="flex items-start gap-2 text-sm text-foreground/80"><CheckCircle2 size={16} className={`${colorClass} shrink-0 mt-0.5`} /> Full AI features</li>
                      <li className="flex items-start gap-2 text-sm text-foreground/80"><CheckCircle2 size={16} className={`${colorClass} shrink-0 mt-0.5`} /> Early access to new features</li>
                      <li className="flex items-start gap-2 text-sm text-foreground/80"><CheckCircle2 size={16} className={`${colorClass} shrink-0 mt-0.5`} /> Exclusive Founding Trader badge</li>
                    </>
                  )}
                </ul>
              </div>

              {subscription.expiresAt && (
                <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-sm">
                  <Clock size={16} className="text-muted shrink-0" />
                  <span className="text-foreground">Access expires: <strong>{format(new Date(subscription.expiresAt), 'dd MMMM yyyy')}</strong></span>
                </div>
              )}
            </div>

            <div className="bg-secondary/30 p-4 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Close
              </button>
            </div>
            <button
               onClick={() => setIsOpen(false)}
               className="absolute right-4 top-4 text-muted hover:text-foreground transition"
               aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FoundingTraderBadge;
