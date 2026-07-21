import React from 'react';
import StrategySettings from '../components/settings/StrategySettings';

const StrategiesPage = () => {
  return (
    <div className="space-y-6 text-foreground font-sans">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-muted p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-400">Strategy Builder</p>
        <h2 className="text-2xl font-bold text-foreground">Trading Strategies</h2>
        <p className="text-sm text-muted">Map out your edge by building structured strategies, setups, and execution checklists.</p>
      </div>

      <StrategySettings />
    </div>
  );
};

export default StrategiesPage;
