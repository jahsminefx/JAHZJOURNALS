import React from 'react';
import { Sparkles, Activity, PlusCircle } from 'lucide-react';

const AiOverviewHeader = () => {
  return (
    <div className="mb-10 text-center md:text-left relative overflow-hidden rounded-2xl bg-surface p-8 shadow-xl border border-border">
      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div>
          <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500">
              <Sparkles size={28} />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">JAHZ AI</h1>
          </div>
          <p className="text-lg text-muted max-w-2xl">
            Your personal trading reflection and performance coach. Review trades, uncover behavioural patterns, understand your edge, and turn journal data into practical lessons.
          </p>
        </div>
      </div>
      {/* Decorative blurred orbit */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full point-events-none" />
    </div>
  );
};

export default AiOverviewHeader;
