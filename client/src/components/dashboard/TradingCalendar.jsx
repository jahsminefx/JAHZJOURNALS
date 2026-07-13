import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency } from '../../utils/dashboard';

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getMonthDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + index);
    return date;
  });
};

const toKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const indicatorClass = {
  PROFIT: 'bg-emerald-400',
  LOSS: 'bg-red-400',
  BREAKEVEN: 'bg-slate-400',
};

const TradingCalendar = ({ data = [], currency, className = '' }) => {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const dataByDate = useMemo(() => new Map(data.map((day) => [day.date, day])), [data]);
  const days = getMonthDays(monthDate);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthDate);

  const moveMonth = (direction) => {
    const next = new Date(monthDate);
    next.setMonth(monthDate.getMonth() + direction);
    setMonthDate(next);
    setSelectedDay(null);
  };

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader
        title="Trading Calendar"
        action={(
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => moveMonth(-1)} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
              <ChevronLeft size={16} />
            </button>
            <p className="min-w-28 text-center text-sm font-bold text-foreground">{monthLabel}</p>
            <button type="button" onClick={() => moveMonth(1)} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-muted">
        {dayLabels.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toKey(day);
          const summary = dataByDate.get(key);
          const inMonth = day.getMonth() === monthDate.getMonth();

          return (
            <button
              key={key}
              type="button"
              onClick={() => summary && setSelectedDay(summary)}
              className={`relative flex aspect-square min-h-9 items-center justify-center rounded-lg text-sm transition ${inMonth ? 'text-foreground hover:bg-surface-muted' : 'text-muted'} ${summary ? 'font-bold' : ''}`}
            >
              {day.getDate()}
              {summary && (
                <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${indicatorClass[summary.outcome] || 'bg-slate-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Profitable Day</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-400" /> Losing Day</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-500" /> Breakeven</span>
      </div>

      {selectedDay && (
        <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-foreground">{selectedDay.date}</p>
            <p className={`font-black ${selectedDay.netProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(selectedDay.netProfitLoss, currency)}
            </p>
          </div>
          <p className="mt-2 text-muted">
            {selectedDay.totalTrades} trades | {selectedDay.wins} wins | {selectedDay.losses} losses | {selectedDay.breakevens} breakevens
          </p>
        </div>
      )}
    </DashboardCard>
  );
};

export default TradingCalendar;
