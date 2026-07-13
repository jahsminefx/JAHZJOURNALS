import React from 'react';
import DashboardFilters from './DashboardFilters';

const DashboardHeader = (props) => (
  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0">
      <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Your Sanctuary</h1>
      <p className="mt-2 text-sm font-medium text-muted">Watch your discipline take shape</p>
    </div>
    <DashboardFilters {...props} />
  </div>
);

export default DashboardHeader;
