import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { DashboardCard } from './DashboardShell';

const DashboardEmptyState = ({ type = 'trades' }) => {
  const noAccounts = type === 'accounts';

  return (
    <DashboardCard className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
        <BarChart3 size={24} />
      </div>
      <h3 className="mt-4 text-xl font-black text-foreground">{noAccounts ? 'No trading accounts yet' : 'No trades in this period'}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {noAccounts
          ? 'Create your first trading account so JAHZJOURNALS can build your performance dashboard.'
          : 'Log closed trades or widen the date range to unlock performance analytics.'}
      </p>
      <Link
        to={noAccounts ? '/accounts/new' : '/trades/new'}
        className="mt-5 inline-flex rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
      >
        {noAccounts ? 'Create your first trading account' : 'Log your first trade'}
      </Link>
    </DashboardCard>
  );
};

export default DashboardEmptyState;
