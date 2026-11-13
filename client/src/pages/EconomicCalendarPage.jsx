import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  Flame,
  AlertTriangle,
  Search,
  RefreshCw,
  Globe,
  ShieldAlert,
  X,
  CheckCircle2,
  ExternalLink,
  Bell,
  Settings,
  RotateCcw,
  BookmarkCheck,
  EyeOff,
  Briefcase,
  Tag,
} from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import NewsAlertPreferencesModal from '../components/calendar/NewsAlertPreferencesModal';
import CalendarPreferencesModal from '../components/calendar/CalendarPreferencesModal';
import { useAuth } from '../context/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  CALENDAR_CATEGORIES,
  DEFAULT_CALENDAR_PREFERENCES,
  GUEST_MIGRATION_DISMISSED_KEY,
  getEffectiveTimeZone,
  formatTimeZoneBadge,
  formatEventTimeInZone,
  formatDateGroupHeaderInZone,
  isEventInSelectedRange,
  classifyEventCategoryClient,
  resolveWatchedCurrencies,
  getEventReleaseDisplay,
  computePropFirmRiskStatus,
  sanitizeCalendarPreferences,
  preferencesDiffer,
  loadGuestCalendarPreferences,
  saveGuestCalendarPreferences,
  clearGuestCalendarPreferences,
  hasCustomGuestPreferences,
  areFiltersEqualToSavedPreferences,
  buildFilterSummaryText,
  getAdaptiveRefreshPlan,
} from '../utils/calendarUtils';

const QUICK_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

const IMPACT_OPTIONS = [
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

  const [rawEvents, setRawEvents] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [pollErrorCount, setPollErrorCount] = useState(0);

  // Saved Preferences (synced to account when logged in, localStorage for guests)
  const [savedPrefs, setSavedPrefs] = useState(() => loadGuestCalendarPreferences());
  const [userWatchedPairs, setUserWatchedPairs] = useState([]);
  const [alertPrefs, setAlertPrefs] = useState(null);
  const [guestMigrationCandidate, setGuestMigrationCandidate] = useState(null);

  // Temporary Page Filter State (initialized from saved preferences)
  const [selectedRange, setSelectedRange] = useState(() => savedPrefs.defaultView || 'this_week');
  const [selectedImpacts, setSelectedImpacts] = useState(() => savedPrefs.impacts || []);
  const [selectedCurrencies, setSelectedCurrencies] = useState(() => savedPrefs.currencies || []);
  const [selectedCategories, setSelectedCategories] = useState(() => savedPrefs.categories || []);
  const [watchedPairsOnly, setWatchedPairsOnly] = useState(() => Boolean(savedPrefs.watchedPairsOnly));
  const [showCompleted, setShowCompleted] = useState(() => savedPrefs.showCompleted !== false);
  const [search, setSearch] = useState('');

  // Modals & Refs
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState('timezone');
  const settingsTriggerRef = useRef(null);
  const activeFetchControllerRef = useRef(null);
  const hasLoadedPrefsRef = useRef(false);

  // Live 1-second clock tick for accurate real-time countdowns and state transitions
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to apply a preference object to active temporary page filters
  const applyPreferencesToPageFilters = useCallback((prefs) => {
    const clean = sanitizeCalendarPreferences(prefs, DEFAULT_CALENDAR_PREFERENCES);
    setSelectedRange(clean.defaultView);
    setSelectedImpacts(clean.impacts);
    setSelectedCurrencies(clean.currencies);
    setSelectedCategories(clean.categories);
    setWatchedPairsOnly(clean.watchedPairsOnly);
    setShowCompleted(clean.showCompleted);
    setSearch('');
  }, []);

  // Load Account Preferences when authenticated, or Guest localStorage preferences when anonymous
  useEffect(() => {
    let mounted = true;

    const loadPrefs = async () => {
      if (!user) {
        const guest = loadGuestCalendarPreferences();
        if (!mounted) return;
        setSavedPrefs(guest);
        setAlertPrefs(null);
        setGuestMigrationCandidate(null);
        if (!hasLoadedPrefsRef.current) {
          applyPreferencesToPageFilters(guest);
          hasLoadedPrefsRef.current = true;
        }
        return;
      }

      try {
        const res = await api.get('/calendar/preferences');
        if (!mounted) return;
        const payload = res.data?.data;
        if (payload?.calendarPreferences) {
          const accountCal = sanitizeCalendarPreferences(
            payload.calendarPreferences,
            DEFAULT_CALENDAR_PREFERENCES
          );
          setSavedPrefs(accountCal);
          setUserWatchedPairs(payload.userWatchedPairs || []);
          if (payload.alertPreferences) {
            setAlertPrefs(payload.alertPreferences);
          }
          applyPreferencesToPageFilters(accountCal);
          hasLoadedPrefsRef.current = true;

          // Offer safe guest-to-account carry-over if browser has custom preferences differing from account
          const dismissed = typeof window !== 'undefined' && window.sessionStorage?.getItem(GUEST_MIGRATION_DISMISSED_KEY);
          if (!dismissed && hasCustomGuestPreferences()) {
            const guestCal = loadGuestCalendarPreferences();
            if (preferencesDiffer(guestCal, accountCal)) {
              setGuestMigrationCandidate(guestCal);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load account calendar preferences:', err?.message || err);
      }
    };

    loadPrefs();
    return () => {
      mounted = false;
    };
  }, [user, applyPreferencesToPageFilters]);

  const effectiveTimeZone = useMemo(() => getEffectiveTimeZone(savedPrefs), [savedPrefs]);
  const timeZoneBadge = useMemo(
    () => formatTimeZoneBadge(effectiveTimeZone, new Date(nowMs)),
    [effectiveTimeZone, nowMs]
  );

  // Fetch base feed with AbortController cancellation to avoid overlapping race conditions
  const fetchEvents = useCallback(async (isManual = false, isSilent = false) => {
    if (activeFetchControllerRef.current) {
      activeFetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeFetchControllerRef.current = controller;

    if (!isSilent) {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);
    }

    try {
      const params = new URLSearchParams();
      params.append('timezone', effectiveTimeZone);
      if (isManual || isSilent) params.append('force', 'true');

      const res = await api.get(`/calendar?${params.toString()}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setRawEvents(res.data?.data || []);
      setLastSyncedAt(res.data?.lastSyncedAt || new Date().toISOString());
      setPollErrorCount(0);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      setPollErrorCount((c) => c + 1);
      if (!isSilent) {
        console.error('Failed to load economic events:', err);
        setFetchError(
          err.response?.data?.message || 'Unable to retrieve economic calendar feed. Please try again.'
        );
      }
    } finally {
      if (!controller.signal.aborted && !isSilent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [effectiveTimeZone]);

  useEffect(() => {
    fetchEvents(false, false);
    return () => {
      if (activeFetchControllerRef.current) {
        activeFetchControllerRef.current.abort();
      }
    };
  }, [fetchEvents]);

  // Adaptive Polling Scheduler (high-frequency 4s in release window, 15s medium, 120s normal, exponential backoff on failure)
  const pollPlan = useMemo(
    () => getAdaptiveRefreshPlan(rawEvents, nowMs, pollErrorCount),
    [rawEvents, nowMs, pollErrorCount]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents(false, true);
    }, pollPlan.intervalMs);
    return () => clearTimeout(timer);
  }, [pollPlan.intervalMs, lastSyncedAt, pollErrorCount, fetchEvents]);

  // Resolved currencies when Watched Pairs filter is active
  const activeWatchedPairs = useMemo(
    () => (savedPrefs.watchedPairs?.length > 0 ? savedPrefs.watchedPairs : userWatchedPairs),
    [savedPrefs.watchedPairs, userWatchedPairs]
  );
  const watchedCurrencies = useMemo(
    () => resolveWatchedCurrencies(activeWatchedPairs, savedPrefs.includeCorrelatedCurrencies),
    [activeWatchedPairs, savedPrefs.includeCorrelatedCurrencies]
  );

  // Client-side time-zone-aware & category-aware filtering (instant, zero flicker)
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rawEvents
      .map((ev) => ({
        ...ev,
        category: ev.category || classifyEventCategoryClient(ev.title, ev.impact),
        releaseDisplay: getEventReleaseDisplay(ev, nowMs, effectiveTimeZone, savedPrefs.timeFormat),
      }))
      .filter((ev) => {
        if (!isEventInSelectedRange(ev.date, selectedRange, effectiveTimeZone, nowMs)) {
          return false;
        }
        if (!showCompleted && ev.releaseDisplay?.isCompleted) {
          return false;
        }
        if (selectedImpacts.length > 0 && !selectedImpacts.includes(ev.impact)) {
          return false;
        }
        if (watchedPairsOnly && watchedCurrencies.length > 0) {
          if (!watchedCurrencies.includes(ev.country)) return false;
        } else if (selectedCurrencies.length > 0 && !selectedCurrencies.includes(ev.country)) {
          return false;
        }
        if (selectedCategories.length > 0 && !selectedCategories.includes(ev.category)) {
          return false;
        }
        if (q) {
          const titleMatch = String(ev.title || '').toLowerCase().includes(q);
          const currMatch = String(ev.country || '').toLowerCase().includes(q);
          if (!titleMatch && !currMatch) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [
    rawEvents,
    nowMs,
    effectiveTimeZone,
    savedPrefs.timeFormat,
    selectedRange,
    showCompleted,
    selectedImpacts,
    watchedPairsOnly,
    watchedCurrencies,
    selectedCurrencies,
    selectedCategories,
    search,
  ]);

  // Group filtered events by local calendar day in the chosen IANA time zone
  const groupedEvents = useMemo(() => {
    const groups = {};
    for (const ev of filteredEvents) {
      const dateHeader = formatDateGroupHeaderInZone(ev.date, effectiveTimeZone, nowMs);
      if (!groups[dateHeader]) {
        groups[dateHeader] = [];
      }
      groups[dateHeader].push(ev);
    }
    return groups;
  }, [filteredEvents, effectiveTimeZone, nowMs]);

  // Summary cards derived from filtered events + live clock
  const stats = useMemo(() => {
    const total = filteredEvents.length;
    const high = filteredEvents.filter((e) => e.impact === 'High').length;
    const medium = filteredEvents.filter((e) => e.impact === 'Medium').length;
    const upcomingNext = filteredEvents.find((e) => new Date(e.date).getTime() > nowMs);
    return { total, high, medium, upcomingNext };
  }, [filteredEvents, nowMs]);

  // Prop-firm safeguard status honoring configured pre/post buffers & release completion state
  const propFirmStatus = useMemo(
    () =>
      computePropFirmRiskStatus(
        rawEvents,
        nowMs,
        savedPrefs.preNewsBufferMinutes,
        savedPrefs.postNewsBufferMinutes
      ),
    [rawEvents, nowMs, savedPrefs.preNewsBufferMinutes, savedPrefs.postNewsBufferMinutes]
  );

  // Filter clarity summary & saved-preference comparison
  const activeFilterState = useMemo(
    () => ({
      range: selectedRange,
      currencies: selectedCurrencies,
      impacts: selectedImpacts,
      categories: selectedCategories,
      watchedPairsOnly,
      includeCorrelatedCurrencies: savedPrefs.includeCorrelatedCurrencies,
      showCompleted,
      search,
    }),
    [
      selectedRange,
      selectedCurrencies,
      selectedImpacts,
      selectedCategories,
      watchedPairsOnly,
      savedPrefs.includeCorrelatedCurrencies,
      showCompleted,
      search,
    ]
  );

  const filterSummaryText = useMemo(
    () => buildFilterSummaryText(activeFilterState),
    [activeFilterState]
  );

  const differsFromSavedPrefs = useMemo(
    () => !areFiltersEqualToSavedPreferences(activeFilterState, savedPrefs),
    [activeFilterState, savedPrefs]
  );

  const hasTemporaryFiltersActive = useMemo(
    () =>
      selectedRange !== 'this_week' ||
      selectedCurrencies.length > 0 ||
      selectedImpacts.length > 0 ||
      selectedCategories.length > 0 ||
      watchedPairsOnly ||
      !showCompleted ||
      Boolean(search.trim()),
    [
      selectedRange,
      selectedCurrencies,
      selectedImpacts,
      selectedCategories,
      watchedPairsOnly,
      showCompleted,
      search,
    ]
  );

  const handleResetTemporaryFilters = () => {
    setSelectedRange('this_week');
    setSelectedImpacts([]);
    setSelectedCurrencies([]);
    setSelectedCategories([]);
    setWatchedPairsOnly(false);
    setShowCompleted(true);
    setSearch('');
  };

  const handleApplySavedPreferences = () => {
    applyPreferencesToPageFilters(savedPrefs);
    toast.success('Applied your saved calendar preferences.');
  };

  // Persist Preferences (Account for logged in user, localStorage for guest)
  const handleSavePreferences = async (nextPrefs, nextAlertPrefs = null) => {
    const clean = sanitizeCalendarPreferences(nextPrefs, DEFAULT_CALENDAR_PREFERENCES);
    if (user) {
      const res = await api.put('/calendar/preferences', {
        calendarPreferences: clean,
        ...(nextAlertPrefs ? { alertPreferences: nextAlertPrefs } : {}),
      });
      const updated = res.data?.data?.calendarPreferences || clean;
      setSavedPrefs(updated);
      if (res.data?.data?.alertPreferences) {
        setAlertPrefs(res.data.data.alertPreferences);
      }
      applyPreferencesToPageFilters(updated);
      toast.success('Calendar preferences saved to your account.');
    } else {
      const savedLocal = saveGuestCalendarPreferences(clean);
      setSavedPrefs(savedLocal);
      applyPreferencesToPageFilters(savedLocal);
      toast.success('Calendar preferences saved to this browser.');
    }
  };

  const handleResetSavedPreferences = async (defaults) => {
    const cleanDefaults = sanitizeCalendarPreferences(defaults, DEFAULT_CALENDAR_PREFERENCES);
    if (user) {
      const res = await api.put('/calendar/preferences', {
        calendarPreferences: cleanDefaults,
      });
      const updated = res.data?.data?.calendarPreferences || cleanDefaults;
      setSavedPrefs(updated);
      applyPreferencesToPageFilters(updated);
    } else {
      clearGuestCalendarPreferences();
      setSavedPrefs(cleanDefaults);
      applyPreferencesToPageFilters(cleanDefaults);
    }
  };

  const handleAcceptGuestMigration = async () => {
    if (!guestMigrationCandidate) return;
    try {
      await handleSavePreferences(guestMigrationCandidate);
      clearGuestCalendarPreferences();
      setGuestMigrationCandidate(null);
    } catch {
      toast.error('Unable to import browser preferences.');
    }
  };

  const handleDismissGuestMigration = () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(GUEST_MIGRATION_DISMISSED_KEY, '1');
    }
    setGuestMigrationCandidate(null);
  };

  const toggleImpactFilter = (id) => {
    setSelectedImpacts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleCurrencyFilter = (curr) => {
    setWatchedPairsOnly(false);
    setSelectedCurrencies((prev) =>
      prev.includes(curr) ? prev.filter((c) => c !== curr) : [...prev, curr]
    );
  };

  const toggleCategoryFilter = (catId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const formatLastSynced = (isoString) => {
    if (!isoString) return '';
    return formatEventTimeInZone(isoString, effectiveTimeZone, savedPrefs.timeFormat);
  };

  const getActualColorClass = (ev) => {
    if (!ev.actual) return 'text-muted/60 font-normal';
    if (ev.actualVsForecast === 'ABOVE') return 'text-emerald-400 font-extrabold';
    if (ev.actualVsForecast === 'BELOW') return 'text-rose-400 font-extrabold';
    return 'text-foreground font-extrabold';
  };

  const isCompact = savedPrefs.density === 'compact';

  const calendarContent = (
    <div className="space-y-5 max-w-full">
      <SEO
        title="Economic Calendar | Forex & Global News | JAHZJOURNALS"
        description="Time-zone-aware economic calendar tracking high-impact macroeconomic releases, central bank decisions, and configurable risk-planning windows."
      />

      <Breadcrumbs
        items={
          user
            ? [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Economic Calendar' }]
            : [{ label: 'Home', path: '/' }, { label: 'Economic Calendar' }]
        }
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Economic Calendar Feed</span>
            </span>
            {lastSyncedAt && (
              <span className="text-[11px] text-muted">
                &bull; Updated {formatLastSynced(lastSyncedAt)}
              </span>
            )}
            {pollPlan.mode !== 'NORMAL' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                Active release checks ({Math.round(pollPlan.intervalMs / 1000)}s)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Economic Calendar
          </h1>
          <p className="text-xs sm:text-sm text-muted/90 max-w-2xl mt-1 leading-relaxed">
            Plan around macroeconomic releases, central bank statements, and configurable pre/post-news safeguard buffers.
          </p>
          <p className="text-[11px] text-muted/75 mt-1">
            Figures can appear shortly after their scheduled release time.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          <button
            ref={settingsTriggerRef}
            type="button"
            onClick={() => {
              setSettingsInitialSection('timezone');
              setIsSettingsModalOpen(true);
            }}
            aria-label="Open Calendar Preferences"
            className="h-9 px-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition flex items-center gap-2 shadow-2xs hover:border-emerald-500/30 active:scale-98 cursor-pointer"
            title="Configure timezone, saved filters, display density, safeguard buffers, and alerts"
          >
            <Settings size={14} className="text-emerald-400" />
            <span>Calendar Settings</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (user) {
                setIsAlertModalOpen(true);
              } else {
                toast('Create a free account or log in to enable custom alerts for your watchlist.', {
                  icon: '🔔',
                });
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
            onClick={() => fetchEvents(true, false)}
            disabled={refreshing}
            className="h-9 px-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition flex items-center gap-2 shadow-2xs hover:border-emerald-500/30 active:scale-98 disabled:opacity-50 cursor-pointer"
            title="Refresh economic events from feed"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : 'text-muted'} />
            <span>{refreshing ? 'Syncing...' : 'Sync Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Guest-to-Account Migration Prompt Banner */}
      {user && guestMigrationCandidate && (
        <div
          role="region"
          aria-label="Import browser preferences"
          className="px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <BookmarkCheck size={16} className="text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-foreground">
              You have saved calendar preferences from this browser. Carry them over into your account?
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAcceptGuestMigration}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
            >
              Carry Over to Account
            </button>
            <button
              type="button"
              onClick={handleDismissGuestMigration}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground font-semibold transition cursor-pointer"
            >
              Keep Account Settings
            </button>
          </div>
        </div>
      )}

      {/* Alert Status Banner */}
      {alertPrefs && (
        <div className="px-4 py-2.5 rounded-xl border border-border/70 bg-surface-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                alertPrefs.isEnabled ? 'bg-emerald-400' : 'bg-muted'
              }`}
            />
            <span className="text-muted">
              {alertPrefs.isEnabled ? (
                <>
                  <strong className="text-foreground">Personal News Alerts:</strong> Active &bull;{' '}
                  {alertPrefs.targetingMode === 'CURRENCIES_ONLY' ? (
                    <>
                      Monitoring{' '}
                      <span className="text-emerald-400 font-mono font-semibold">
                        {alertPrefs.currencies?.length || 0} currencies
                      </span>{' '}
                      ({(alertPrefs.currencies || []).join(', ')})
                    </>
                  ) : alertPrefs.targetingMode === 'PAIRS_ONLY' ? (
                    <>
                      Monitoring{' '}
                      <span className="text-emerald-400 font-mono font-semibold">
                        {alertPrefs.pairs?.length || 0} pairs
                      </span>{' '}
                      ({(alertPrefs.pairs || []).slice(0, 4).join(', ')}
                      {(alertPrefs.pairs || []).length > 4 ? '...' : ''})
                    </>
                  ) : (
                    <>
                      Monitoring{' '}
                      <span className="text-emerald-400 font-mono font-semibold">
                        {alertPrefs.currencies?.length || 0} currencies
                      </span>{' '}
                      ({(alertPrefs.currencies || []).slice(0, 3).join(', ')}) &amp;{' '}
                      <span className="text-emerald-400 font-mono font-semibold">
                        {alertPrefs.pairs?.length || 0} pairs
                      </span>
                    </>
                  )}{' '}
                  &bull;{' '}
                  <span className="text-foreground font-semibold">
                    {(alertPrefs.impactLevels || ['HIGH']).join('/')}
                  </span>{' '}
                  impact.
                </>
              ) : (
                <>
                  <strong className="text-foreground">Personal News Alerts:</strong> Paused. Saved configurations are preserved.
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAlertModalOpen(true)}
            className="text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] flex items-center gap-1 self-start sm:self-auto transition shrink-0 cursor-pointer"
          >
            <span>Manage Preferences</span>
            <ExternalLink size={11} />
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface border border-border/80 hover:border-border rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Matching Events</span>
            <div className="w-8 h-8 rounded-xl bg-surface-muted border border-border/60 flex items-center justify-center text-muted shrink-0">
              <Calendar size={15} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-mono tabular-nums">
              {stats.total}
            </p>
            <p className="text-[11px] text-muted mt-0.5 font-medium">For current view &amp; filters</p>
          </div>
        </div>

        <div className="bg-surface border border-rose-500/20 hover:border-rose-500/35 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">High Impact</span>
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

        <div className="bg-surface border border-amber-500/20 hover:border-amber-500/35 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Medium Impact</span>
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
                <p
                  className="text-xs sm:text-sm font-bold text-foreground truncate"
                  title={`${stats.upcomingNext.country} - ${stats.upcomingNext.title}`}
                >
                  <span className="text-emerald-400 font-mono mr-1.5 font-bold">
                    [{stats.upcomingNext.country}]
                  </span>
                  {stats.upcomingNext.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {formatEventTimeInZone(
                      stats.upcomingNext.date,
                      effectiveTimeZone,
                      savedPrefs.timeFormat
                    )}
                  </span>
                  {stats.upcomingNext.releaseDisplay && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded border ${stats.upcomingNext.releaseDisplay.className}`}
                    >
                      {stats.upcomingNext.releaseDisplay.label}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs sm:text-sm font-bold text-muted truncate">No releases pending</p>
                <p className="text-[11px] text-muted/70 mt-0.5">All filtered events completed</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Toolbar */}
      <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
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
              aria-label="Search economic events"
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5 cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Impact Filters (Multi-select + All toggle) */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1.5 select-none">
            Impact:
          </span>
          <button
            type="button"
            onClick={() => setSelectedImpacts([])}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer ${
              selectedImpacts.length === 0
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold shadow-2xs'
                : 'bg-surface-muted/60 border-border/60 text-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            All Impacts
          </button>
          {IMPACT_OPTIONS.map((opt) => {
            const active = selectedImpacts.includes(opt.id);
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleImpactFilter(opt.id)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
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

          {/* Quick Display Toggles */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {activeWatchedPairs.length > 0 && (
              <button
                type="button"
                onClick={() => setWatchedPairsOnly((v) => !v)}
                aria-pressed={watchedPairsOnly}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition cursor-pointer ${
                  watchedPairsOnly
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                    : 'bg-surface border-border/70 text-muted hover:text-foreground'
                }`}
              >
                <Briefcase size={11} />
                <span>Watched Pairs</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              aria-pressed={!showCompleted}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition cursor-pointer ${
                !showCompleted
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-400 font-bold'
                  : 'bg-surface border-border/70 text-muted hover:text-foreground'
              }`}
            >
              <EyeOff size={11} />
              <span>{showCompleted ? 'Hide Completed' : 'Hiding Completed'}</span>
            </button>
          </div>
        </div>

        {/* Row 3: Currency Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1.5 select-none">
            Currency:
          </span>
          <button
            type="button"
            onClick={() => {
              setWatchedPairsOnly(false);
              setSelectedCurrencies([]);
            }}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono transition border cursor-pointer ${
              !watchedPairsOnly && selectedCurrencies.length === 0
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-surface border-border/80 text-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            ALL
          </button>
          {QUICK_CURRENCIES.map((curr) => {
            const active = !watchedPairsOnly && selectedCurrencies.includes(curr);
            return (
              <button
                key={curr}
                type="button"
                onClick={() => toggleCurrencyFilter(curr)}
                aria-pressed={active}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono transition border cursor-pointer ${
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

        {/* Row 4: Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1.5 select-none flex items-center gap-1">
            <Tag size={10} />
            <span>Category:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategories([])}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition border cursor-pointer ${
              selectedCategories.length === 0
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                : 'bg-surface border-border/80 text-muted hover:text-foreground'
            }`}
          >
            All Categories
          </button>
          {CALENDAR_CATEGORIES.map((cat) => {
            const active = selectedCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategoryFilter(cat.id)}
                aria-pressed={active}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition border cursor-pointer ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                    : 'bg-surface border-border/80 text-muted hover:text-foreground'
                }`}
              >
                {cat.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Filter Clarity Summary + Reset vs Apply Saved Preferences */}
        <div className="pt-2.5 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <p className="font-semibold text-foreground/90" data-testid="active-filter-summary">
            {filterSummaryText}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {differsFromSavedPrefs && (
              <button
                type="button"
                onClick={handleApplySavedPreferences}
                className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Apply saved preferences</span>
              </button>
            )}

            {hasTemporaryFiltersActive && (
              <button
                type="button"
                onClick={handleResetTemporaryFilters}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <X size={11} />
                <span>Reset filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visible IANA Time Zone Label Above Events Table */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => {
            setSettingsInitialSection('timezone');
            setIsSettingsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted text-xs text-foreground font-semibold transition cursor-pointer"
          title="Change calendar display time zone"
        >
          <Globe size={13} className="text-emerald-400 shrink-0" />
          <span data-testid="timezone-indicator">Times shown in {timeZoneBadge}</span>
          <span className="text-[10px] text-emerald-400 font-bold ml-1">Change</span>
        </button>

        <span className="text-[11px] text-muted">
          Format: <strong className="text-foreground">{savedPrefs.timeFormat === '24h' ? '24-hour' : '12-hour'}</strong>
          {' · '}
          Density: <strong className="text-foreground capitalize">{savedPrefs.density}</strong>
        </span>
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
              <div className="h-4 w-24 bg-surface-muted rounded" />
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
            onClick={() => fetchEvents(true, false)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
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
            No events match your current filter settings. Try adjusting time range, currency, impact, or category filters.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetTemporaryFilters}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-block shadow-xs cursor-pointer"
            >
              Reset All Filters
            </button>
            {differsFromSavedPrefs && (
              <button
                type="button"
                onClick={handleApplySavedPreferences}
                className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground text-xs font-bold transition cursor-pointer"
              >
                Apply Saved Preferences
              </button>
            )}
          </div>
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
              <div className="hidden sm:grid grid-cols-[76px_54px_92px_1fr_92px_76px_76px_138px] gap-3 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted/70 border-b border-border/40 bg-surface-muted/20 select-none">
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
                  const releaseDisplay = ev.releaseDisplay;
                  const eventTimeStr = formatEventTimeInZone(
                    ev.date,
                    effectiveTimeZone,
                    savedPrefs.timeFormat
                  );
                  const categoryLabel =
                    CALENDAR_CATEGORIES.find((c) => c.id === ev.category)?.shortLabel || '';

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
                      <div
                        className={`hidden sm:grid grid-cols-[76px_54px_92px_1fr_92px_76px_76px_138px] gap-3 px-5 items-center ${
                          isCompact ? 'py-2' : 'py-3'
                        }`}
                      >
                        {/* 1. Time */}
                        <div className="font-mono text-xs font-bold text-foreground/90 tabular-nums">
                          {eventTimeStr}
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

                        {/* 4. Event Title & Optional Timing/Category Metadata */}
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-foreground truncate" title={ev.title}>
                              {ev.title}
                            </p>
                            {!isCompact && categoryLabel && (
                              <span className="hidden lg:inline-block shrink-0 px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-surface-muted/70 text-muted border border-border/50">
                                {categoryLabel}
                              </span>
                            )}
                          </div>
                          {releaseDisplay?.timingSublabel && (
                            <p className="text-[10px] text-muted font-mono mt-0.5 truncate">
                              {releaseDisplay.timingSublabel}
                            </p>
                          )}
                        </div>

                        {/* 5. Actual */}
                        <div className={`text-right font-mono text-xs tabular-nums ${getActualColorClass(ev)}`}>
                          {ev.actual ? (
                            <span title={ev.previousActual ? `Previously reported: ${ev.previousActual}` : undefined}>
                              {ev.actual}
                            </span>
                          ) : releaseDisplay?.state === 'AWAITING_RELEASE' ? (
                            <span className="text-[10px] text-amber-400 font-semibold">
                              Awaiting release
                            </span>
                          ) : releaseDisplay?.state === 'DELAYED' ? (
                            <span className="text-[10px] text-amber-400/90 font-semibold">
                              Delayed
                            </span>
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
                          {releaseDisplay ? (
                            <span
                              title={releaseDisplay.stateTitle}
                              className={`px-2 py-0.5 rounded text-[10px] border whitespace-nowrap inline-block ${releaseDisplay.className}`}
                            >
                              {releaseDisplay.label}
                            </span>
                          ) : (
                            <span className="text-muted/40 text-xs">—</span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card Row (<sm) */}
                      <div className={`sm:hidden space-y-2 ${isCompact ? 'p-3' : 'p-3.5'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                              {eventTimeStr}
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

                          {releaseDisplay && (
                            <span
                              className={`px-2 py-0.5 rounded text-[9.5px] border whitespace-nowrap ${releaseDisplay.className}`}
                            >
                              {releaseDisplay.label}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-foreground leading-snug">{ev.title}</p>

                        {releaseDisplay?.timingSublabel && (
                          <p className="text-[10px] text-muted font-mono">{releaseDisplay.timingSublabel}</p>
                        )}

                        {(ev.actual ||
                          ev.forecast ||
                          ev.previous ||
                          releaseDisplay?.isAwaiting ||
                          releaseDisplay?.isDelayed) && (
                          <div className="flex items-center gap-3 flex-wrap text-[11px] pt-0.5 text-muted font-mono">
                            {(ev.actual || releaseDisplay?.isAwaiting || releaseDisplay?.isDelayed) && (
                              <span>
                                Actual:{' '}
                                {ev.actual ? (
                                  <strong className={getActualColorClass(ev)}>{ev.actual}</strong>
                                ) : (
                                  <span className="text-amber-400 font-semibold">
                                    {releaseDisplay.actualText}
                                  </span>
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

      {/* Prop Firm News Trading Safeguards Section */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                News Window Safeguards
              </h3>
              <p className="text-xs text-muted">
                User-configured pre/post-news risk planning buffers ({savedPrefs.preNewsBufferMinutes}m pre /{' '}
                {savedPrefs.postNewsBufferMinutes}m post).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border ${propFirmStatus.badgeClass}`}>
              <span>{propFirmStatus.badge}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSettingsInitialSection('safeguards');
                setIsSettingsModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted text-[11px] font-semibold text-foreground transition cursor-pointer"
            >
              Adjust Buffer
            </button>
          </div>
        </div>

        <p className="text-xs text-muted/90 leading-relaxed">{propFirmStatus.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              1. Configurable Buffer
            </span>
            <p className="text-xs text-foreground/90 font-medium">
              Presets (2m, 5m, 10m) or custom pre/post buffers keep your planning window highlighted until the buffer elapses and the event resolves.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              2. Spread &amp; Liquidity Risk
            </span>
            <p className="text-xs text-foreground/90 font-medium">
              Around major catalysts like CPI or NFP, spreads often widen and fills can experience slippage beyond planned stops.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-muted/40 border border-border/50 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              3. Journal Correlation
            </span>
            <p className="text-xs text-foreground/90 font-medium">
              JAHZJOURNALS cross-references your trade timestamps with this schedule so you can review execution discipline objectively.
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Preferences Modal */}
      <CalendarPreferencesModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        user={user}
        initialPreferences={savedPrefs}
        initialAlertPreferences={alertPrefs}
        userWatchedPairs={userWatchedPairs}
        onSavePreferences={handleSavePreferences}
        onResetPreferences={handleResetSavedPreferences}
        onAlertPreferencesUpdated={(updated) => setAlertPrefs(updated)}
        initialSection={settingsInitialSection}
        triggerRef={settingsTriggerRef}
      />

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
              JAHZJOURNALS automatically correlates your trade entries with this economic calendar, tags news catalysts in your review, and syncs your calendar preferences across devices.
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
