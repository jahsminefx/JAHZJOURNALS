import React, { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { Link } from 'react-router-dom';

const FoundingTraderWelcomeModal = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const activeSub = user.subscriptions?.[0];
    const isFoundingTrader = activeSub?.source === 'PROMOTION';
    const hasSeenWelcome = localStorage.getItem('foundingTraderWelcomeShown');

    if (isFoundingTrader && !hasSeenWelcome) {
      setIsOpen(true);
      localStorage.setItem('foundingTraderWelcomeShown', 'true');
    }
  }, [user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-background border border-emerald-500/20 shadow-2xl flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="p-8 text-center relative z-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Sparkles size={40} />
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">
            🎉 Welcome to the Founding Trader Program
          </h2>
          
          <div className="space-y-4 text-muted-foreground leading-relaxed text-[15px]">
            <p>
              You've unlocked complimentary <strong>PRO access</strong> during the JAHZJOURNALS launch.
            </p>
            <p>
              Thank you for helping shape the future of the platform through your feedback and trading journey.
            </p>
            <p>
              Enjoy every premium feature while we continue building the best trading journal possible.
            </p>
          </div>
        </div>

        <div className="p-6 bg-secondary/20 border-t border-border/50 flex flex-col sm:flex-row gap-3 relative z-10">
          <Link 
            to="/dashboard"
            onClick={() => setIsOpen(false)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
          >
            Start Journaling <ChevronRight size={16} />
          </Link>
          <Link 
            to="/ai"
            onClick={() => setIsOpen(false)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition"
          >
            Explore AI Features
          </Link>
        </div>
        
        <button
           onClick={() => setIsOpen(false)}
           className="absolute right-4 top-4 text-muted hover:text-foreground transition z-20"
           aria-label="Close welcome modal"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
};

export default FoundingTraderWelcomeModal;
