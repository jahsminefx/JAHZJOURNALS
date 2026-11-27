import React from 'react';
import { CalendarDays, Plus, Wallet } from 'lucide-react';
import { DATE_RANGE_OPTIONS } from '../../utils/dashboard';
import CustomSelect from '../common/CustomSelect';

const DashboardFilters = ({
  accounts = [],
  accountId,
  dateRange,
  startDate,
  endDate,
  onAccountChange,
  onDateRangeChange,
  onCustomDateChange,
  canRecordTransaction = false,
  onRecordTransaction = null,
}) => {
  const accountOptions = [
    { value: '', label: 'All Accounts' },
    ...accounts.map((account) => ({
      value: account.id,
      label: account.name,
    })),
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-start">
      <div className="relative min-w-0 lg:w-64">
        <CustomSelect
          id="dashboard-account-filter"
          aria-label="Filter trades by account"
          value={accountId || ''}
          onChange={(newVal) => onAccountChange(newVal)}
          options={accountOptions}
          placeholder="All Accounts"
          icon={Wallet}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <div className="relative min-w-0 lg:w-72">
          <CustomSelect
            id="dashboard-daterange-filter"
            aria-label="Filter trades by date range"
            value={dateRange}
            onChange={(newVal) => onDateRangeChange(newVal)}
            options={DATE_RANGE_OPTIONS}
            icon={CalendarDays}
          />
        </div>

        {dateRange === 'custom' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={startDate || ''}
              onChange={(event) => onCustomDateChange('startDate', event.target.value)}
              aria-label="Custom start date"
              className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500 shadow-sm"
            />
            <input
              type="date"
              value={endDate || ''}
              onChange={(event) => onCustomDateChange('endDate', event.target.value)}
              aria-label="Custom end date"
              className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>
        )}
      </div>

      {canRecordTransaction && typeof onRecordTransaction === 'function' && (
        <button
          type="button"
          onClick={onRecordTransaction}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-xs"
        >
          <Plus size={14} />
          <span>Record transaction</span>
        </button>
      )}
    </div>
  );
};

export default DashboardFilters;
