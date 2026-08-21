import React from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DATE_RANGE_OPTIONS } from '../../utils/dashboard';

const selectClass = 'w-full min-w-0 appearance-none rounded-lg border border-border bg-surface px-4 py-3 pr-10 text-sm text-foreground outline-none transition focus:border-emerald-500 shadow-sm';

const DashboardFilters = ({
  accounts = [],
  accountId,
  dateRange,
  startDate,
  endDate,
  onAccountChange,
  onDateRangeChange,
  onCustomDateChange,
}) => (
  <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-start">
    <div className="relative min-w-0 lg:w-64">
      <select value={accountId || ''} onChange={(event) => onAccountChange(event.target.value)} className={selectClass}>
        <option value="" className="bg-surface text-foreground">All Accounts</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id} className="bg-surface text-foreground">{account.name}</option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>

    <div className="min-w-0 space-y-2">
      <div className="relative min-w-0 lg:w-72">
        <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <select value={dateRange} onChange={(event) => onDateRangeChange(event.target.value)} className={`${selectClass} pl-10`}>
          {DATE_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface text-foreground">{option.label}</option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>

      {dateRange === 'custom' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="date"
            value={startDate || ''}
            onChange={(event) => onCustomDateChange('startDate', event.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500 shadow-sm"
          />
          <input
            type="date"
            value={endDate || ''}
            onChange={(event) => onCustomDateChange('endDate', event.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500 shadow-sm"
          />
        </div>
      )}
    </div>
  </div>
);

export default DashboardFilters;
