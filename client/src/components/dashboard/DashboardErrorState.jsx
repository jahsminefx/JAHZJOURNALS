import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { DashboardCard } from './DashboardShell';

const DashboardErrorState = ({ message, onRetry }) => (
  <DashboardCard className="p-8 text-center">
    <h3 className="text-xl font-black text-foreground">Dashboard could not load</h3>
    <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{message || 'Something went wrong while loading your analytics.'}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
    >
      <RefreshCcw size={16} />
      Retry
    </button>
  </DashboardCard>
);

export default DashboardErrorState;
