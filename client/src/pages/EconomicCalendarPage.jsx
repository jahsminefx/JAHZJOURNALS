import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, Flame, AlertTriangle, Search,
  RefreshCw, Globe, ShieldAlert, X, CheckCircle2,
  Info, ExternalLink, Bell, Sliders
} from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import NewsAlertPreferencesModal from '../components/calendar/NewsAlertPreferencesModal';
import { useAuth } from '../context/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const CURRENCIES = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

const IMPACT_OPTIONS = [
  { id: 'ALL', label: 'All Impacts' },
  { id: 'High', label: 'High Impact', icon: Flame, colorClass: 'text-rose-400' },
  { id: 'Medium', label: 'Medium Impact', icon: AlertTriangle, colorClass: 'text-amber-400' },
  { id: 'Low', label: 'Low Impact', colorClass: 'text-muted' },
  { id: 'Holiday', label: 'Holidays', colorClass: 'text-sky-400' },
];

const RANGE_TABS = [
  { id: 'this_week', label: 'This Week' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'upcoming', label: 'Upcoming Only' },
];

export default function EconomicCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedImpact, setSelectedImpact] = useState('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState('ALL');
  const [selectedRange, setSelectedRange] = useState('this_week');
  const [fetchError, setFetchError] = useState(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertPrefs, setAlertPrefs] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Live 1-second clock tick for accurate real-time countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAlertPreferences = useCallback(async () => {
    try {
      const res = await api.get('/calendar/alerts/preferences');
      if (res.data?.data) {
        setAlertPrefs(res.data.data);
      }
    } catch (err) {
      console.warn('Could not load user alert preferences summary:', err?.message || err);
    }
  }, []);

  const fetchEvents = useCallback(async (isManual = false, isSilent = false) => {
    if (!isSilent) {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);
    }

    try {
      const params = new URLSearchParams();
      if (selectedImpact !== 'ALL') params.append('impact', selectedImpact);
      if (selectedCurrency !== 'ALL') params.append('currency', selectedCurrency);
      if (selectedRange !== 'this_week') params.append('range', selectedRange);
      if (search.trim()) params.append('search', search.trim());
      if (isManual || isSilent) params.append('force', 'true');

      const res = await api.get(`/calendar?${params.toString()}`);
      setEvents(res.data?.data || []);
      if (res.data?.lastSyncedAt) {
        setLastSyncedAt(res.data.lastSyncedAt);
      } else {
        setLastSyncedAt(new Date().toISOString());
      }
    } catch (err) {
      if (!isSilent) {
        console.error('Failed to load economic events:', err);
        setFetchError(err.response?.data?.message || 'Unable to retrieve economic calendar feed. Please try again.');
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedImpact, selectedCurrency, selectedRange, search]);

  useEffect(() => {
    fetchEvents();
    if (user) {
      fetchAlertPreferences();
    }
  }, [fetchEvents, fetchAlertPreferences, user]);

  // Detect if any event is actively releasing right now (0 to 3 mins after scheduled time without an actual value yet)
  const hasActivelyReleasingEvent = useMemo(() => {
    return events.some((ev) => {
      if (ev.actual || ev.impact === 'Holiday') return false;
      const diffMs = new Date(ev.date).getTime() - nowMs;
      return diffMs <= 5000 && diffMs >= -3 * 60 * 1000;
    });
  }, [events, nowMs]);

  // Auto-poll every 15s during an active release window to grab Actual numbers immediately, or every 2m otherwise
  useEffect(() => {
    const intervalMs = hasActivelyReleasingEvent ? 15000 : 120000;
    const poll = setInterval(() => {
      fetchEvents(false, true);
    }, intervalMs);
    return () => clearInterval(poll);
  }, [hasActivelyReleasingEvent, fetchEvents]);

  // Group events by local date string
  const groupedEvents = useMemo(() => {
    const groups = {};
    for (const ev of events) {
      const dateObj = new Date(ev.date);
      const dateKey = dateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(ev);
    }
    return groups;
  }, [events]);

  // Statistics derived purely from existing data + live clock
  const stats = useMemo(() => {
    const total = events.length;
    const high = events.filter((e) => e.impact === 'High').length;
    const medium = events.filter((e) => e.impact === 'Medium').length;
    const upcomingNext = events.find((e) => new Date(e.date).getTime() > nowMs);

    return { total, high, medium, upcomingNext };
  }, [events, nowMs]);

  // Prop firm restriction status based on upcoming high-impact events
  const propFirmStatus = useMemo(() => {
    const highEvents = events.filter((e) => e.impact === 'High');

    // Check if an event is currently within ±5 minutes
    const activeRestricted = highEvents.find((e) => {
      const t = new Date(e.date).getTime();
      return Math.abs(t - nowMs) <= 5 * 60 * 1000;
    });

    if (activeRestricted) {
      return {
        level: 'CRITICAL',
        title: 'Active Prohibited News Window',
        badge: 'Stand Down Active (±5m buffer)',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-bold',
        description: `High-impact release (${activeRestricted.country} - ${activeRestricted.title}) is within the ±5m news window. Prop firm evaluation entries and closures are prohibited.`,
      };
    }

    // Check if an event is within the next 60 minutes
    const imminentRestricted = highEvents.find((e) => {
      const t = new Date(e.date).getTime();
      const diff = t - nowMs;
      return diff > 0 && diff <= 60 * 60 * 1000;
    });

    if (imminentRestricted) {
      const minsLeft = Math.max(1, Math.ceil((new Date(imminentRestricted.date).getTime() - nowMs) / 60000));
      return {
        level: 'WARNING',
        title: 'Restricted Window Imminent',
        badge: `Restricted in ${minsLeft}m`,
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold',
        description: `High-impact release (${imminentRestricted.country} - ${imminentRestricted.title}) scheduled in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}. Prepare to flatten positions or secure stop losses.`,
      };
    }

    return {
      level: 'CLEAR',
      title: 'Clear Execution Window',
      badge: 'No High-Impact News Within 60m',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold',
      description: 'Standard execution conditions. No high-impact red-folder catalysts scheduled in the immediate 60-minute window.',
    };
  }, [events, nowMs]);

  const formatEventTime = (isoString) => {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '—';
    }
  };

  const formatLastSynced = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const getTimeStatus = useCallback((ev) => {
    if (!ev || !ev.date) return null;
    const diffMs = new Date(ev.date).getTime() - nowMs;

    if (ev.impact === 'Holiday') {
      return { label: 'All Day', className: 'text-sky-400 bg-sky-500/10 border-sky-500/25 font-medium' };
    }

    // Upcoming event: live countdown
    if (diffMs > 0) {
      if (diffMs < 60 * 1000) {
        const secs = Math.max(1, Math.ceil(diffMs / 1000));
        return {
          label: `in ${secs}s`,
          className: 'text-rose-400 bg-rose-500/15 border-rose-500/30 animate-pulse font-bold font-mono tabular-nums',
        };
      }
      if (diffMs < 10 * 60 * 1000) {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return {
          label: `in ${mins}m ${secs}s`,
          className: 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-bold font-mono tabular-nums',
        };
      }
      if (diffMs < 60 * 60 * 1000) {
        const mins = Math.ceil(diffMs / 60000);
        return {
          label: `in ${mins}m`,
          className: 'text-amber-400 bg-amber-500/10 border-amber-500/30 font-bold font-mono tabular-nums',
        };
      }
      if (diffMs < 24 * 60 * 60 * 1000) {
        const totalMins = Math.floor(diffMs / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return {
          label: `in ${h}h ${m}m`,
          className: 'text-emerald-400/90 bg-emerald-500/10 border-emerald-500/20 font-semibold font-mono tabular-nums',
        };
      }
      const totalHours = Math.floor(diffMs / 3600000);
      const d = Math.floor(totalHours / 24);
      const h = totalHours % 24;
      return {
        label: `in ${d}d ${h}h`,
        className: 'text-muted bg-surface-muted/60 border-border/60 font-medium font-mono tabular-nums',
      };
    }

    // Event release time has arrived (diffMs <= 0)
    if (ev.actual) {
      return {
        label: 'Released',
        className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 font-semibold',
      };
    }

    // Only show "Releasing..." for up to 3 minutes after scheduled time while waiting for numeric actual
    if (diffMs >= -3 * 60 * 1000) {
      if (ev.forecast || ev.previous) {
        return {
          label: 'Releasing...',
          className: 'text-rose-400 bg-rose-500/15 border-rose-500/30 animate-pulse font-bold',
        };
      }
      return {
        label: 'Live Now',
        className: 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-bold',
      };
    }

    return {
      label: 'Completed',
      className: 'text-muted/60 bg-surface-muted/40 border-border/40 font-medium',
    };
  }, [nowMs]);

  const getActualColorClass = (ev) => {
    if (!ev.actual) return 'text-muted/40 font-normal';
    if (ev.actualVsForecast === 'ABOVE') return 'text-emerald-400 font-extrabold';
    if (ev.actualVsForecast === 'BELOW') return 'text-rose-400 font-extrabold';
    return 'text-foreground font-extrabold';
  };

  const handleResetFilters = () => {
    setSelectedImpact('ALL');
    setSelectedCurrency('ALL');
    setSelectedRange('this_week');
    setSearch('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedImpact !== 'ALL') count++;
    if (selectedCurrency !== 'ALL') count++;
    if (selectedRange !== 'this_week') count++;
    if (search.trim()) count++;
    return count;
  }, [selectedImpact, selectedCurrency, selectedRange, search]);

  const calendarContent = (
    <div className="space-y-6 max-w-full">
      <SEO
        title="Economic Calendar | Forex & Global News | JAHZJOURNALS"
        description="Live economic calendar tracking high-impact central bank announcements, CPI, NFP, interest rate decisions, and prop-firm news windows."
      />

      <Breadcrumbs items={user ? [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Economic Calendar' }] : [{ label: 'Home', path: '/' }, { label: 'Economic Calendar' }]} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Economic Feed</span>
            </span>
            {lastSyncedAt && (
              <span className="text-[11px] text-muted">
                &bull; Updated {formatLastSynced(lastSyncedAt)}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Economic Calendar</h1>
          <p className="text-xs sm:text-sm text-muted/90 max-w-2xl mt-1 leading-relaxed">
            Track high-impact macroeconomic releases, central bank rate decisions, and prop-firm prohibited news windows.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (user) {
                setIsAlertModalOpen(true);
              } else {
                toast('Create a free account or log in to enable custom alerts for your watchlist.', { icon: '🔔' });
                navigate('/register');
              }
            }}
            className="h-9 px-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition flex items-center gap-2 shadow-2xs hover:border-emerald-500/30 active:scale-98 cursor-pointer"
            title="Configure personal news alerts for your currency pairs"
          >
            <Bell size={14} className={alertPrefs?.isEnabled ? 'text-emerald-400' : 'text-muted'} />
            <span>News Alerts</span>
            <span
              className={`w-2 h-2 rounded-full ${
                alertPrefs?.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-muted/40'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className="h-9 px-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition flex items-center gap-2 shadow-2xs hover:border-emerald-500/30 active:scale-98 disabled:opacity-50"
            title="Force refresh economic events from live feed"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : 'text-muted'} />
            <span>{refreshing ? 'Syncing...' : 'Sync Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Alert Status Banner */}
      {alertPrefs && (
        <div className="px-4 py-2.5 rounded-xl border border-border/70 bg-surface-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${alertPrefs.isEnabled ? 'bg-emerald-400' : 'bg-muted'}`} />
            <span className="text-muted">
              {alertPrefs.isEnabled ? (
                <>
                  <strong className="text-foreground">Personal News Alerts:</strong> Active &bull;{' '}
                  {alertPrefs.targetingMode === 'CURRENCIES_ONLY' ? (
                    <>Monitoring <span className="text-emerald-400 font-mono font-semibold">{alertPrefs.currencies?.length || 0} currencies</span> ({(alertPrefs.currencies || []).join(', ')})</>
                  ) : alertPrefs.targetingMode === 'PAIRS_ONLY' ? (
                    <>Monitoring <span className="text-emerald-400 font-mono font-semibold">{alertPrefs.pairs?.length || 0} pairs</span> ({(alertPrefs.pairs || []).slice(0, 4).join(', ')}{(alertPrefs.pairs || []).length > 4 ? '...' : ''})</>
                  ) : (
                    <>Monitoring <span className="text-emerald-400 font-mono font-semibold">{alertPrefs.currencies?.length || 0} currencies</span> ({(alertPrefs.currencies || []).slice(0, 3).join(', ')}) & <span className="text-emerald-400 font-mono font-semibold">{alertPrefs.pairs?.length || 0} pairs</span></>
                  )}{' '}
                  &bull; <span className="text-foreground font-semibold">{(alertPrefs.impactLevels || ['HIGH']).join('/')}</span> impact.
                </>
              ) : (
                <>
                  <strong className="text-foreground">Personal News Alerts:</strong> Paused. Saved configurations are preserved. Click to re-enable.
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAlertModalOpen(true)}
            className="text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] flex items-center gap-1 self-start sm:self-auto transition shrink-0"
          >
            <span>Manage Preferences</span>
            <ExternalLink size={11} />
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Scheduled */}
        <div className="bg-surface border border-border/80 hover:border-border rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Total Scheduled</span>
            <div className="w-8 h-8 rounded-xl bg-surface-muted border border-border/60 flex items-center justify-center text-muted shrink-0">
              <Calendar size={15} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-mono tabular-nums">
              {stats.total}
            </p>
            <p className="text-[11px] text-muted mt-0.5 font-medium">Weekly global releases</p>
          </div>
        </div>

        {/* 2. High Impact (Red) */}
        <div className="bg-surface border border-rose-500/20 hover:border-rose-500/35 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <span>High Impact</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0">
              <Flame size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-400 tracking-tight font-mono tabular-nums">
              {stats.high}
            </p>
            <p className="text-[11px] text-rose-400/80 mt-0.5 font-medium">High-volatility catalysts</p>
          </div>
        </div>

        {/* 3. Medium Impact (Amber) */}
        <div className="bg-surface border border-amber-500/20 hover:border-amber-500/35 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span>Medium Impact</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight font-mono tabular-nums">
              {stats.medium}
            </p>
            <p className="text-[11px] text-amber-400/80 mt-0.5 font-medium">Moderate volume drivers</p>
          </div>
        </div>

        {/* 4. Next Release */}
        <div className="bg-surface border border-emerald-500/20 hover:border-emerald-500/35 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Next Release</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <Clock size={15} />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            {stats.upcomingNext ? (
              <>
                <p className="text-xs sm:text-sm font-bold text-foreground truncate" title={`${stats.upcomingNext.country} - ${stats.upcomingNext.title}`}>
                  <span className="text-emerald-400 font-mono mr-1.5 font-bold">[{stats.upcomingNext.country}]</span>
                  {stats.upcomingNext.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {formatEventTime(stats.upcomingNext.date)}
                  </span>
                  {getTimeStatus(stats.upcomingNext) && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border ${getTimeStatus(stats.upcomingNext)?.className}`}>
                      {getTimeStatus(stats.upcomingNext)?.label}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs sm:text-sm font-bold text-muted truncate">No releases pending</p>
                <p className="text-[11px] text-muted/70 mt-0.5">All scheduled events completed</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Toolbar */}
      <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
        {/* Row 1: Segmented Range Tabs + Search Input */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-xl bg-surface-muted/70 border border-border/60 gap-1 overflow-x-auto max-w-full shrink-0">
            {RANGE_TABS.map((tab) => {
              const active = selectedRange === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedRange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    active
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event (e.g. CPI, NFP, Fed)..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Impact Filters */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1.5 select-none">Impact:</span>
          {IMPACT_OPTIONS.map((opt) => {
            const active = selectedImpact === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedImpact(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold shadow-2xs'
                    : 'bg-surface-muted/60 border-border/60 text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                {Icon && <Icon size={12} className={active ? 'text-emerald-400' : opt.colorClass} />}
                <span>{opt.label}</span>
              </button>
            );
          })}

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-auto text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
            >
              <X size={12} />
              <span>Reset filters ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* Row 3: Currency Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1.5 select-none">Currency:</span>
          {CURRENCIES.map((curr) => {
            const active = selectedCurrency === curr;
            return (
              <button
                key={curr}
                type="button"
                onClick={() => setSelectedCurrency(curr)}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono transition border ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-surface border-border/80 text-muted hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                {curr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Events Stream */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50 animate-pulse">
            <div className="h-4 w-40 bg-surface-muted rounded" />
            <div className="h-4 w-16 bg-surface-muted rounded" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border/30 animate-pulse">
              <div className="h-4 w-16 bg-surface-muted rounded" />
              <div className="h-4 w-10 bg-surface-muted rounded" />
              <div className="h-4 w-20 bg-surface-muted rounded" />
              <div className="h-4 flex-1 bg-surface-muted rounded" />
              <div className="h-4 w-16 bg-surface-muted rounded" />
              <div className="h-4 w-16 bg-surface-muted rounded" />
              <div className="h-4 w-16 bg-surface-muted rounded" />
              <div className="h-4 w-20 bg-surface-muted rounded" />
            </div>
          ))}
        </div>
      ) : fetchError ? (
        <div className="py-16 bg-surface border border-rose-500/30 rounded-2xl text-center p-8 space-y-3">
          <AlertTriangle size={36} className="text-rose-400 mx-auto opacity-80" />
          <h3 className="text-base font-bold text-foreground">Economic Feed Unavailable</h3>
          <p className="text-xs text-muted max-w-md mx-auto">{fetchError}</p>
          <button
            type="button"
            onClick={() => fetchEvents(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : Object.keys(groupedEvents).length === 0 ? (
        <div className="py-16 bg-surface border border-border rounded-2xl text-center p-8 space-y-3">
          <Globe size={36} className="text-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-foreground">No Economic Releases Found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            No events match your current filter settings. Try clearing search, adjusting impact, or selecting another currency.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-block shadow-xs"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([dateStr, dayEvents]) => (
            <div key={dateStr} className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
              {/* Day Header */}
              <div className="bg-surface-muted/50 px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-emerald-500 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">{dateStr}</h3>
                </div>
                <span className="text-[11px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-md border border-border/60">
                  {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Desktop Table Column Header */}
              <div className="hidden sm:grid grid-cols-[72px_56px_96px_1fr_80px_80px_80px_110px] gap-3 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted/70 border-b border-border/40 bg-surface-muted/20 select-none">
                <div>Time</div>
                <div>Curr</div>
                <div>Impact</div>
                <div>Event Title</div>
                <div className="text-right">Actual</div>
                <div className="text-right">Forecast</div>
                <div className="text-right">Previous</div>
                <div className="text-right">Status</div>
              </div>

              {/* Event Rows */}
              <div className="divide-y divide-border/40">
                {dayEvents.map((ev) => {
                  const isHigh = ev.impact === 'High';
                  const isMedium = ev.impact === 'Medium';
                  const isHoliday = ev.impact === 'Holiday';
                  const status = getTimeStatus(ev);
                  const isReleasingPending = status?.label === 'Releasing...' && !ev.actual;

                  return (
                    <div
                      key={ev.id}
                      className={`transition-colors ${
                        isHigh
                          ? 'border-l-[3px] border-l-rose-500 bg-rose-500/[0.015] hover:bg-rose-500/[0.04]'
                          : isMedium
                          ? 'border-l-[3px] border-l-amber-500 bg-amber-500/[0.015] hover:bg-amber-500/[0.04]'
                          : 'border-l-[3px] border-l-transparent hover:bg-surface-muted/30'
                      }`}
                    >
                      {/* Desktop Grid Row (sm+) */}
                      <div className="hidden sm:grid grid-cols-[72px_56px_96px_1fr_80px_80px_80px_110px] gap-3 px-5 py-3 items-center">
                        {/* 1. Time */}
                        <div className="font-mono text-xs font-bold text-foreground/90 tabular-nums">
                          {formatEventTime(ev.date)}
                        </div>

                        {/* 2. Currency */}
                        <div>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-surface-muted border border-border/80 text-foreground text-center inline-block">
                            {ev.country}
                          </span>
                        </div>

                        {/* 3. Impact */}
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                              isHigh
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : isMedium
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : isHoliday
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-surface-muted text-muted border-border/60'
                            }`}
                          >
                            {isHigh && <Flame size={10} />}
                            {isMedium && <AlertTriangle size={10} />}
                            <span>{ev.impact}</span>
                          </span>
                        </div>

                        {/* 4. Event Title */}
                        <div className="min-w-0 pr-2">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate" title={ev.title}>
                            {ev.title}
                          </p>
                        </div>

                        {/* 5. Actual */}
                        <div className={`text-right font-mono text-xs tabular-nums ${getActualColorClass(ev)}`}>
                          {ev.actual ? (
                            ev.actual
                          ) : isReleasingPending ? (
                            <span className="text-[10px] text-amber-400 animate-pulse font-semibold">Pending</span>
                          ) : (
                            <span className="text-muted/40 font-normal">—</span>
                          )}
                        </div>

                        {/* 6. Forecast */}
                        <div className="text-right font-mono text-xs font-bold text-foreground/85 tabular-nums">
                          {ev.forecast ? ev.forecast : <span className="text-muted/40 font-normal">—</span>}
                        </div>

                        {/* 7. Previous */}
                        <div className="text-right font-mono text-xs text-muted tabular-nums">
                          {ev.previous ? ev.previous : <span className="text-muted/40 font-normal">—</span>}
                        </div>

                        {/* 8. Status / Countdown */}
                        <div className="text-right">
                          {status ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] border whitespace-nowrap inline-block ${status.className}`}>
                              {status.label}
                            </span>
                          ) : (
                            <span className="text-muted/40 text-xs">—</span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card Row (<sm) */}
                      <div className="sm:hidden p-3.5 space-y-2">
                        {/* Mobile Top Sub-row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                              {formatEventTime(ev.date)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-surface-muted border border-border text-foreground">
                              {ev.country}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                isHigh
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : isMedium
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-surface-muted text-muted border-border'
                              }`}
                            >
                              {isHigh && <Flame size={9} />}
                              {isMedium && <AlertTriangle size={9} />}
                              <span>{ev.impact}</span>
                            </span>
                          </div>

                          {status && (
                            <span className={`px-2 py-0.5 rounded text-[9.5px] border whitespace-nowrap ${status.className}`}>
                              {status.label}
                            </span>
                          )}
                        </div>

                        {/* Mobile Event Title */}
                        <p className="text-xs font-semibold text-foreground leading-snug">
                          {ev.title}
                        </p>

                        {/* Mobile Actual, Forecast & Previous values */}
                        {(ev.actual || ev.forecast || ev.previous || isReleasingPending) && (
                          <div className="flex items-center gap-3 flex-wrap text-[11px] pt-1 text-muted font-mono">
                            {(ev.actual || isReleasingPending) && (
                              <span>
                                Actual:{' '}
                                {ev.actual ? (
                                  <strong className={getActualColorClass(ev)}>{ev.actual}</strong>
                                ) : (
                                  <span className="text-amber-400 animate-pulse font-semibold">Pending</span>
                                )}
                              </span>
                            )}
                            {ev.forecast && (
                              <span>
                                Forecast: <strong className="text-foreground">{ev.forecast}</strong>
                              </span>
                            )}
                            {ev.previous && (
                              <span>
                                Prev: <span>{ev.previous}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prop Firm News Trading Protection Section */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Prop Firm News Trading Protocol
              </h3>
              <p className="text-xs text-muted">
                Automated risk guard & prohibited execution window monitoring.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border ${propFirmStatus.badgeClass}`}>
              <span>{propFirmStatus.badge}</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-muted/90 leading-relaxed">
          {propFirmStatus.description}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">1. Execution Buffer</span>
            <p className="text-xs text-foreground/90 font-medium">
              Major firms (FTMO, FundedNext, 5%ers) enforce a strict <strong>&plusmn;2 to &plusmn;5 minute</strong> buffer around Red-Folder news.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">2. Spread & Slippage</span>
            <p className="text-xs text-foreground/90 font-medium">
              Liquidity gaps during NFP/CPI widen spreads by up to <strong>20&times;</strong>, causing severe slippage past stop-losses.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">3. Automated Correlation</span>
            <p className="text-xs text-foreground/90 font-medium">
              JAHZJOURNALS automatically checks your trade entry times against this schedule and tags news trades in your review.
            </p>
          </div>
        </div>
      </div>

      {/* News Alert Preferences Modal */}
      <NewsAlertPreferencesModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        onPreferencesUpdated={(updated) => setAlertPrefs(updated)}
      />

      {/* Anonymous Trader Callout Banner */}
      {!user && (
        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-surface to-surface p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>⚡</span> Free Forex Journaling
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-foreground">
              Never get blindsided by high-impact news spikes again.
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              JAHZJOURNALS automatically correlates your trade entries with this economic calendar, tags news spikes in your review, and enforces strict prop-firm drawdown rules.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 transition-all text-center whitespace-nowrap"
            >
              Start Journaling Free →
            </Link>
            <Link
              to="/risk-calculator"
              className="inline-flex items-center justify-center px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground text-xs font-bold transition-all text-center whitespace-nowrap"
            >
              Position Size Calculator
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full flex-1">
          {calendarContent}
        </main>
        <Footer />
      </div>
    );
  }

  return calendarContent;
}
