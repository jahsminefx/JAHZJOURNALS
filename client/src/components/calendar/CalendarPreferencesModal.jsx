import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Settings,
  Globe,
  Filter,
  Layout,
  ShieldAlert,
  Bell,
  Search,
  Check,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import {
  CALENDAR_CURRENCIES,
  CALENDAR_IMPACTS,
  CALENDAR_CATEGORIES,
  DEFAULT_CALENDAR_PREFERENCES,
  getDeviceTimeZone,
  formatTimeZoneBadge,
  getSearchableTimeZones,
  sanitizeCalendarPreferences,
  resolveWatchedCurrencies,
} from '../../utils/calendarUtils';
import {
  isPushNotificationSupported,
  getPushPermissionState,
  getDeviceSubscription,
  enablePushNotifications,
  disablePushNotifications,
} from '../../utils/pushNotificationHelper';

const SECTIONS = [
  { id: 'timezone', label: 'Time Zone', icon: Globe },
  { id: 'filters', label: 'Saved Filters', icon: Filter },
  { id: 'display', label: 'Display', icon: Layout },
  { id: 'safeguards', label: 'Safeguards', icon: ShieldAlert },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

const BUFFER_PRESETS = [2, 5, 10];
const ALERT_LEAD_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '60 minutes before' },
];

const QUICK_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'EURGBP', 'XAUUSD', 'US30', 'NAS100', 'SPX500', 'GER40',
];

export default function CalendarPreferencesModal({
  isOpen,
  onClose,
  user,
  initialPreferences,
  initialAlertPreferences,
  userWatchedPairs = [],
  onSavePreferences,
  onResetPreferences,
  onAlertPreferencesUpdated,
  initialSection = 'timezone',
  triggerRef,
}) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [formPrefs, setFormPrefs] = useState(() =>
    sanitizeCalendarPreferences(initialPreferences, DEFAULT_CALENDAR_PREFERENCES)
  );
  const [alertForm, setAlertForm] = useState({
    isEnabled: true,
    targetingMode: 'CURRENCIES_AND_PAIRS',
    currencies: ['USD', 'EUR', 'GBP'],
    pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
    impactLevels: ['HIGH'],
    categories: [],
    leadTimesMinutes: [30],
  });

  const [tzSearch, setTzSearch] = useState('');
  const [customPairInput, setCustomPairInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushToggling, setPushToggling] = useState(false);

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const deviceTimeZone = useMemo(() => getDeviceTimeZone(), []);
  const deviceTimeZoneBadge = useMemo(() => formatTimeZoneBadge(deviceTimeZone), [deviceTimeZone]);
  const allTimeZones = useMemo(() => getSearchableTimeZones(), []);

  const filteredTimeZones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return allTimeZones.slice(0, 60);
    return allTimeZones.filter((item) => item.searchText.includes(q)).slice(0, 60);
  }, [allTimeZones, tzSearch]);

  // Initialize form state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setActiveSection(initialSection || 'timezone');
    const mergedWatched = Array.from(
      new Set([...(initialPreferences?.watchedPairs || []), ...userWatchedPairs])
    );
    setFormPrefs(
      sanitizeCalendarPreferences(
        { ...initialPreferences, watchedPairs: mergedWatched },
        DEFAULT_CALENDAR_PREFERENCES
      )
    );

    if (initialAlertPreferences) {
      setAlertForm({
        isEnabled: initialAlertPreferences.isEnabled !== false,
        targetingMode: initialAlertPreferences.targetingMode || 'CURRENCIES_AND_PAIRS',
        currencies: Array.isArray(initialAlertPreferences.currencies)
          ? initialAlertPreferences.currencies
          : ['USD', 'EUR', 'GBP'],
        pairs: Array.isArray(initialAlertPreferences.pairs)
          ? initialAlertPreferences.pairs
          : ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
        impactLevels: Array.isArray(initialAlertPreferences.impactLevels)
          ? initialAlertPreferences.impactLevels
          : ['HIGH'],
        categories: Array.isArray(initialAlertPreferences.categories)
          ? initialAlertPreferences.categories
          : [],
        leadTimesMinutes: Array.isArray(initialAlertPreferences.leadTimesMinutes)
          ? initialAlertPreferences.leadTimesMinutes
          : [30],
      });
    }
  }, [isOpen, initialPreferences, initialAlertPreferences, userWatchedPairs, initialSection]);

  // Check browser push support passively WITHOUT requesting permission
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const checkPush = async () => {
      const supported = isPushNotificationSupported();
      if (!mounted) return;
      setPushSupported(supported);
      if (supported) {
        const perm = await getPushPermissionState();
        const sub = await getDeviceSubscription();
        if (!mounted) return;
        setPushPermission(perm);
        setPushSubscribed(Boolean(sub && perm === 'granted'));
      }
    };
    checkPush();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Keyboard accessibility: focus on open, Escape to close, restore trigger focus on close
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 10);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerRef?.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      } else if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const toggleArrayItem = (arr, item) =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleAddWatchedPair = () => {
    const clean = customPairInput.replace(/[\/\-_.\s]/g, '').trim().toUpperCase();
    if (!clean || clean.length < 3) return;
    if (!formPrefs.watchedPairs.includes(clean)) {
      setFormPrefs((prev) => ({
        ...prev,
        watchedPairs: [...prev.watchedPairs, clean],
      }));
    }
    setCustomPairInput('');
  };

  const handleToggleBrowserPush = async () => {
    if (!user) {
      toast('Sign in to enable browser push alerts for your account.');
      return;
    }
    setPushToggling(true);
    try {
      if (pushSubscribed) {
        await disablePushNotifications();
        setPushSubscribed(false);
        toast.success('Browser push notifications disabled for this device.');
      } else {
        await enablePushNotifications();
        setPushPermission(await getPushPermissionState());
        setPushSubscribed(true);
        toast.success('Browser push notifications enabled for this device.');
      }
    } catch (err) {
      toast.error(err?.message || 'Unable to update browser push setting.');
    } finally {
      setPushToggling(false);
    }
  };

  const handleSendTestAlert = async () => {
    if (!user) {
      toast('Sign in to send a test alert to your notification center.');
      return;
    }
    setSendingTest(true);
    try {
      const res = await api.post('/calendar/alerts/test');
      const pushSent = res.data?.data?.pushResult?.sent || 0;
      toast.success(
        pushSent > 0
          ? 'Test alert delivered to your Notification Center and browser push.'
          : 'Test alert delivered to your Notification Center.'
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send test alert.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const sanitized = sanitizeCalendarPreferences(formPrefs, DEFAULT_CALENDAR_PREFERENCES);
      await onSavePreferences(sanitized, user ? alertForm : null);
      if (user && onAlertPreferencesUpdated && alertForm) {
        onAlertPreferencesUpdated(alertForm);
      }
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to save calendar preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const defaults = {
        ...DEFAULT_CALENDAR_PREFERENCES,
        watchedPairs: userWatchedPairs,
      };
      setFormPrefs(defaults);
      await onResetPreferences(defaults);
      toast.success('Saved calendar preferences reset to defaults.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to reset calendar preferences.');
    } finally {
      setSaving(false);
    }
  };

  const effectivePreviewTz = formPrefs.useDeviceTimezone ? deviceTimeZone : formPrefs.timezone;
  const resolvedWatchedCurrencies = resolveWatchedCurrencies(
    formPrefs.watchedPairs,
    formPrefs.includeCorrelatedCurrencies
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-prefs-title"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-surface text-foreground shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-surface-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
              <Settings size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="calendar-prefs-title" className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                Calendar Preferences
              </h2>
              <p className="text-[11px] text-muted truncate">
                {user
                  ? 'Saved to your account and synced across devices.'
                  : 'Saved locally in this browser. Sign in to sync across devices.'}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close Calendar Preferences"
            className="w-8 h-8 rounded-lg border border-border/70 bg-surface hover:bg-surface-muted flex items-center justify-center text-muted hover:text-foreground transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Section Tabs */}
        <div
          role="tablist"
          aria-label="Calendar preference sections"
          className="flex items-center gap-1.5 px-5 py-2.5 border-b border-border/70 bg-surface-muted/15 overflow-x-auto"
        >
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted hover:text-foreground hover:bg-surface-muted/70'
                }`}
              >
                <Icon size={13} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* 1. TIME ZONE */}
          {activeSection === 'timezone' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-muted/25 p-4 flex items-center justify-between gap-4">
                <div>
                  <label htmlFor="use-device-tz" className="text-sm font-bold text-foreground block">
                    Use device time zone
                  </label>
                  <p className="text-xs text-muted mt-0.5">
                    Automatically matches your browser&apos;s IANA zone ({deviceTimeZoneBadge}) and adjusts for daylight saving time.
                  </p>
                </div>
                <button
                  id="use-device-tz"
                  type="button"
                  role="switch"
                  aria-checked={formPrefs.useDeviceTimezone}
                  onClick={() =>
                    setFormPrefs((prev) => ({
                      ...prev,
                      useDeviceTimezone: !prev.useDeviceTimezone,
                      timezone: !prev.useDeviceTimezone ? prev.timezone : deviceTimeZone,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    formPrefs.useDeviceTimezone ? 'bg-emerald-600' : 'bg-surface-muted border border-border'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formPrefs.useDeviceTimezone ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs flex items-center gap-2">
                <Globe size={14} className="text-emerald-400 shrink-0" />
                <span>
                  Preview: <strong className="text-foreground">Times shown in {formatTimeZoneBadge(effectivePreviewTz)}</strong>
                </span>
              </div>

              <div className={formPrefs.useDeviceTimezone ? 'opacity-60 pointer-events-none select-none space-y-2.5' : 'space-y-2.5'}>
                <label htmlFor="tz-search-input" className="text-xs font-bold uppercase tracking-wider text-muted block">
                  Select IANA Time Zone
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="tz-search-input"
                    type="search"
                    value={tzSearch}
                    onChange={(e) => setTzSearch(e.target.value)}
                    disabled={formPrefs.useDeviceTimezone}
                    placeholder="Search city, zone, or offset (e.g. Lagos, London, New_York, UTC+01:00)..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div
                  role="listbox"
                  aria-label="IANA Time Zones"
                  className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background divide-y divide-border/40"
                >
                  {filteredTimeZones.map((item) => {
                    const selected = formPrefs.timezone === item.zone;
                    return (
                      <button
                        key={item.zone}
                        role="option"
                        aria-selected={selected}
                        type="button"
                        disabled={formPrefs.useDeviceTimezone}
                        onClick={() => setFormPrefs((prev) => ({ ...prev, timezone: item.zone }))}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                          selected
                            ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                            : 'text-foreground hover:bg-surface-muted/60'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {selected && <Check size={14} className="shrink-0 text-emerald-400" />}
                      </button>
                    );
                  })}
                  {filteredTimeZones.length === 0 && (
                    <p className="p-4 text-xs text-muted text-center">No matching IANA time zones found.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. SAVED CALENDAR FILTERS */}
          {activeSection === 'filters' && (
            <div className="space-y-5">
              {/* Preferred Currencies */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Preferred Currencies
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormPrefs((p) => ({ ...p, currencies: [] }))}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {formPrefs.currencies.length === 0 ? 'All selected' : 'Clear (show all)'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CALENDAR_CURRENCIES.map((curr) => {
                    const active = formPrefs.currencies.includes(curr);
                    return (
                      <button
                        key={curr}
                        type="button"
                        onClick={() =>
                          setFormPrefs((p) => ({ ...p, currencies: toggleArrayItem(p.currencies, curr) }))
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border transition cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-background border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {curr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Impact Levels */}
              <div className="space-y-2 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Preferred Impact Levels
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormPrefs((p) => ({ ...p, impacts: [] }))}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {formPrefs.impacts.length === 0 ? 'All impacts' : 'Reset to all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CALENDAR_IMPACTS.map((imp) => {
                    const active = formPrefs.impacts.includes(imp);
                    return (
                      <button
                        key={imp}
                        type="button"
                        onClick={() =>
                          setFormPrefs((p) => ({ ...p, impacts: toggleArrayItem(p.impacts, imp) }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                            : 'bg-background border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {imp === 'Holiday' ? 'Holidays' : `${imp} Impact`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Event Categories */}
              <div className="space-y-2 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Event Categories
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormPrefs((p) => ({ ...p, categories: [] }))}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {formPrefs.categories.length === 0 ? 'All categories' : 'Show all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CALENDAR_CATEGORIES.map((cat) => {
                    const active = formPrefs.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setFormPrefs((p) => ({ ...p, categories: toggleArrayItem(p.categories, cat.id) }))
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                            : 'bg-background border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Watched Pairs Filter */}
              <div className="rounded-xl border border-border bg-surface-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label htmlFor="watched-pairs-only" className="text-xs sm:text-sm font-bold text-foreground block">
                      Show only events affecting my watched pairs
                    </label>
                    <p className="text-[11px] text-muted mt-0.5">
                      Matches base &amp; quote currencies from your watched instruments.
                    </p>
                  </div>
                  <button
                    id="watched-pairs-only"
                    type="button"
                    role="switch"
                    aria-checked={formPrefs.watchedPairsOnly}
                    onClick={() =>
                      setFormPrefs((p) => ({ ...p, watchedPairsOnly: !p.watchedPairsOnly }))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      formPrefs.watchedPairsOnly ? 'bg-emerald-600' : 'bg-surface-muted border border-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formPrefs.watchedPairsOnly ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Optional Correlated Currencies Toggle */}
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPrefs.includeCorrelatedCurrencies}
                    onChange={(e) =>
                      setFormPrefs((p) => ({ ...p, includeCorrelatedCurrencies: e.target.checked }))
                    }
                    className="rounded border-border text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Also include correlated currencies (e.g. EUR↔CHF/GBP, AUD↔NZD, USD↔CAD)</span>
                </label>

                {/* Watched Pairs Chips & Quick Add */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PAIRS.map((pair) => {
                      const active = formPrefs.watchedPairs.includes(pair);
                      return (
                        <button
                          key={pair}
                          type="button"
                          onClick={() =>
                            setFormPrefs((p) => ({ ...p, watchedPairs: toggleArrayItem(p.watchedPairs, pair) }))
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                              : 'bg-background text-muted border-border/70 hover:text-foreground'
                          }`}
                        >
                          {pair}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPairInput}
                      onChange={(e) => setCustomPairInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddWatchedPair();
                        }
                      }}
                      placeholder="Add pair or index (e.g. EURCAD, XAUUSD)..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddWatchedPair}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {resolvedWatchedCurrencies.length > 0 && (
                    <p className="text-[11px] text-muted">
                      Active currencies from pairs:{' '}
                      <span className="text-emerald-400 font-mono font-semibold">
                        {resolvedWatchedCurrencies.join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. DISPLAY PREFERENCES */}
          {activeSection === 'display' && (
            <div className="space-y-5">
              {/* Time Format */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">Time Format</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: '12h', title: '12-Hour', example: '2:30 PM' },
                    { id: '24h', title: '24-Hour', example: '14:30' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormPrefs((p) => ({ ...p, timeFormat: opt.id }))}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        formPrefs.timeFormat === opt.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-border bg-background hover:bg-surface-muted/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-foreground">{opt.title}</div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">Example: {opt.example}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default View */}
              <div className="space-y-2 pt-3 border-t border-border/50">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">Default View</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'tomorrow', label: 'Tomorrow' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'upcoming', label: 'Upcoming' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setFormPrefs((p) => ({ ...p, defaultView: v.id }))}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        formPrefs.defaultView === v.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-background text-muted border-border hover:text-foreground'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Completed Releases */}
              <div className="rounded-xl border border-border bg-surface-muted/20 p-4 flex items-center justify-between gap-4">
                <div>
                  <label htmlFor="show-completed-toggle" className="text-xs sm:text-sm font-bold text-foreground block">
                    Show completed releases
                  </label>
                  <p className="text-[11px] text-muted mt-0.5">
                    Keep earlier releases visible in the table for post-session review, or hide them to focus ahead.
                  </p>
                </div>
                <button
                  id="show-completed-toggle"
                  type="button"
                  role="switch"
                  aria-checked={formPrefs.showCompleted}
                  onClick={() => setFormPrefs((p) => ({ ...p, showCompleted: !p.showCompleted }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    formPrefs.showCompleted ? 'bg-emerald-600' : 'bg-surface-muted border border-border'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formPrefs.showCompleted ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Table Density */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">Table Density</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'comfortable', title: 'Comfortable', desc: 'Balanced row padding and spacing' },
                    { id: 'compact', title: 'Compact', desc: 'Higher information density per screen' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setFormPrefs((p) => ({ ...p, density: d.id }))}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        formPrefs.density === d.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-border bg-background hover:bg-surface-muted/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-foreground">{d.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. PROP-FIRM SAFEGUARDS */}
          {activeSection === 'safeguards' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-xs text-muted leading-relaxed">
                Configure personal execution-planning buffers around high-impact releases. Because prop-firm and broker restrictions vary by account agreement, choose presets or custom values matching your own rules.
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">Quick Buffer Presets</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {BUFFER_PRESETS.map((mins) => {
                    const active =
                      formPrefs.preNewsBufferMinutes === mins && formPrefs.postNewsBufferMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() =>
                          setFormPrefs((p) => ({
                            ...p,
                            preNewsBufferMinutes: mins,
                            postNewsBufferMinutes: mins,
                          }))
                        }
                        className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold'
                            : 'border-border bg-background text-foreground hover:bg-surface-muted/50'
                        }`}
                      >
                        <div className="text-sm font-mono font-bold">±{mins} min</div>
                        <div className="text-[10px] text-muted mt-0.5">{mins}m before &amp; after</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="pre-buffer-input" className="text-xs font-bold text-foreground block">
                    Pre-news buffer (minutes)
                  </label>
                  <input
                    id="pre-buffer-input"
                    type="number"
                    min={1}
                    max={60}
                    value={formPrefs.preNewsBufferMinutes}
                    onChange={(e) =>
                      setFormPrefs((p) => ({
                        ...p,
                        preNewsBufferMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="post-buffer-input" className="text-xs font-bold text-foreground block">
                    Post-news buffer (minutes)
                  </label>
                  <input
                    id="post-buffer-input"
                    type="number"
                    min={1}
                    max={60}
                    value={formPrefs.postNewsBufferMinutes}
                    onChange={(e) =>
                      setFormPrefs((p) => ({
                        ...p,
                        postNewsBufferMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted/20 p-3.5 text-xs text-muted flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  The safeguard risk window stays active until your{' '}
                  <strong className="text-foreground">{formPrefs.postNewsBufferMinutes}-minute post-news buffer</strong> has elapsed{' '}
                  <strong className="text-foreground">and</strong> the event is marked Released or Delayed.
                </span>
              </div>
            </div>
          )}

          {/* 5. ALERTS */}
          {activeSection === 'alerts' && (
            <div className="space-y-5">
              {!user ? (
                <div className="rounded-xl border border-border bg-surface-muted/20 p-5 text-center space-y-2">
                  <Bell size={24} className="mx-auto text-emerald-400" />
                  <h3 className="text-sm font-bold text-foreground">Account Required for Alerts</h3>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    In-app notifications and optional browser push alerts require an account so alerts can be delivered reliably across sessions. Your other calendar display and timezone settings save locally right away.
                  </p>
                </div>
              ) : (
                <>
                  {/* Global Alert Switch */}
                  <div className="rounded-xl border border-border bg-surface-muted/25 p-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-bold text-foreground block">Enable Economic News Alerts</span>
                      <p className="text-xs text-muted mt-0.5">
                        Delivered via the JAHZJOURNALS Notification Center when matching releases approach.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={alertForm.isEnabled}
                      onClick={() => setAlertForm((a) => ({ ...a, isEnabled: !a.isEnabled }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        alertForm.isEnabled ? 'bg-emerald-600' : 'bg-surface-muted border border-border'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          alertForm.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Alert Currencies */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted block">Alert Currencies</span>
                    <div className="flex flex-wrap gap-1.5">
                      {CALENDAR_CURRENCIES.map((c) => {
                        const active = alertForm.currencies.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setAlertForm((a) => ({ ...a, currencies: toggleArrayItem(a.currencies, c) }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-background border-border text-muted hover:text-foreground'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Alert Impacts */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted block">Alert Impact Levels</span>
                    <div className="flex flex-wrap gap-2">
                      {['HIGH', 'MEDIUM', 'LOW'].map((imp) => {
                        const active = alertForm.impactLevels.includes(imp);
                        return (
                          <button
                            key={imp}
                            type="button"
                            onClick={() =>
                              setAlertForm((a) => {
                                const next = toggleArrayItem(a.impactLevels, imp);
                                return { ...a, impactLevels: next.length > 0 ? next : ['HIGH'] };
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                                : 'bg-background border-border text-muted hover:text-foreground'
                            }`}
                          >
                            {imp.charAt(0) + imp.slice(1).toLowerCase()} Impact
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Alert Categories */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">Alert Categories</span>
                      <button
                        type="button"
                        onClick={() => setAlertForm((a) => ({ ...a, categories: [] }))}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      >
                        {alertForm.categories.length === 0 ? 'All categories' : 'Reset to all'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CALENDAR_CATEGORIES.map((cat) => {
                        const active = alertForm.categories.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
                              setAlertForm((a) => ({ ...a, categories: toggleArrayItem(a.categories, cat.id) }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                                : 'bg-background border-border text-muted hover:text-foreground'
                            }`}
                          >
                            {cat.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lead-Time Choices: 5, 15, 30, 60 */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted block">Alert Lead Times</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ALERT_LEAD_OPTIONS.map((opt) => {
                        const active = alertForm.leadTimesMinutes.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setAlertForm((a) => {
                                const next = toggleArrayItem(a.leadTimesMinutes, opt.value).sort((x, y) => x - y);
                                return { ...a, leadTimesMinutes: next.length > 0 ? next : [30] };
                              })
                            }
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                                : 'bg-background border-border text-muted hover:text-foreground'
                            }`}
                          >
                            {opt.value}m before
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notification Channels (In-App + Explicit Opt-In Browser Push) & Send Test Alert */}
                  <div className="rounded-xl border border-border bg-surface-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Notification Channels</span>
                        <span className="text-[11px] text-muted">
                          In-app Notification Center is active. Browser push is optional and only requests permission when clicked.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendTestAlert}
                        disabled={sendingTest}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Send size={12} />
                        <span>{sendingTest ? 'Sending...' : 'Send test alert'}</span>
                      </button>
                    </div>

                    {pushSupported && (
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-3">
                        <div className="text-xs">
                          <span className="font-semibold text-foreground">Browser Push Notifications</span>
                          <span className="block text-[11px] text-muted">
                            {pushPermission === 'denied'
                              ? 'Permission blocked in browser settings.'
                              : pushSubscribed
                              ? 'Subscribed on this browser.'
                              : 'Not enabled on this browser yet.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleBrowserPush}
                          disabled={pushToggling || pushPermission === 'denied'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                            pushSubscribed
                              ? 'border-border bg-background text-muted hover:text-foreground'
                              : 'border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500'
                          }`}
                        >
                          {pushToggling
                            ? 'Updating...'
                            : pushSubscribed
                            ? 'Disable Browser Push'
                            : 'Enable Browser Push'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-surface-muted/30 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-muted hover:text-foreground flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} />
            <span>Reset saved preferences</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Saving...' : 'Save preferences'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
