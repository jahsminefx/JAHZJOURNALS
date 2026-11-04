import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, ArrowRight, X, Flame } from 'lucide-react';
import api from '../../utils/api';

const UpcomingNewsTicker = ({ className = '' }) => {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchUpcoming = async () => {
      try {
        const res = await api.get('/calendar/upcoming?window=360'); // next 6 hours
        if (isMounted && res.data?.data) {
          setUpcomingEvents(res.data.data);
        }
      } catch (err) {
        // Silent fail for ticker to not disrupt dashboard
        console.warn('Could not fetch upcoming news ticker:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60000); // refresh every minute

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (dismissed || loading || upcomingEvents.length === 0) {
    return null;
  }

  // Get nearest high-impact event first, otherwise first event
  const primaryEvent = upcomingEvents.find((e) => e.impact === 'High') || upcomingEvents[0];
  const isHighImpact = primaryEvent.impact === 'High';

  const formatEventTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 shadow-md ${
        isHighImpact
          ? 'bg-gradient-to-r from-red-950/40 via-surface to-red-950/20 border-red-500/30'
          : 'bg-gradient-to-r from-amber-950/30 via-surface to-surface border-amber-500/30'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isHighImpact
                ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {isHighImpact ? <Flame size={18} /> : <AlertTriangle size={18} />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isHighImpact
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isHighImpact ? 'High Impact News' : 'Medium Impact News'}
              </span>

              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-surface-muted border border-border text-foreground">
                {primaryEvent.country}
              </span>

              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Clock size={12} />
                <span>{primaryEvent.countdown || formatEventTime(primaryEvent.date)}</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm font-bold text-foreground mt-1 truncate">
              {primaryEvent.title}
              {primaryEvent.forecast && (
                <span className="font-normal text-muted ml-2 text-xs">
                  Forecast: <strong className="text-foreground">{primaryEvent.forecast}</strong>
                  {primaryEvent.previous && ` | Prev: ${primaryEvent.previous}`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Link
            to="/calendar"
            className="px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-emerald-500/40 text-xs font-semibold text-foreground hover:text-emerald-400 transition flex items-center gap-1.5 shadow-2xs"
          >
            <span>Economic Calendar</span>
            <ArrowRight size={13} />
          </Link>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition"
            title="Dismiss notice"
            aria-label="Dismiss news notice"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpcomingNewsTicker;
