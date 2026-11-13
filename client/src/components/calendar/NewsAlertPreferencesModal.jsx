import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Bell,
  Check,
  AlertTriangle,
  Flame,
  Clock,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  History,
  Sliders,
  Search,
  CheckCircle2,
  Coins,
  Globe2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const PRESET_GROUPS = {
  MAJORS: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'],
  CROSSES: ['EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'CADJPY', 'CHFJPY', 'EURAUD', 'EURCAD', 'GBPAUD'],
  METALS_INDICES: ['XAUUSD', 'US30', 'NAS100', 'SPX500', 'GER40'],
};

const LEAD_TIME_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '24 hours before' },
];

export default function NewsAlertPreferencesModal({ isOpen, onClose, onPreferencesUpdated }) {
  const [activeTab, setActiveTab] = useState('preferences'); // 'preferences' | 'history'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  // Catalog Data
  const [supportedPairs, setSupportedPairs] = useState([]);
  const [supportedCurrencies, setSupportedCurrencies] = useState([
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF', 'NGN', 'CNY', 'ZAR'
  ]);

  // Form State (V1.1)
  const [isEnabled, setIsEnabled] = useState(true);
  const [targetingMode, setTargetingMode] = useState('CURRENCIES_AND_PAIRS'); // 'CURRENCIES_ONLY' | 'PAIRS_ONLY' | 'CURRENCIES_AND_PAIRS'
  const [currencies, setCurrencies] = useState(['USD', 'EUR', 'GBP']);
  const [pairs, setPairs] = useState(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']);
  const [impactLevels, setImpactLevels] = useState(['HIGH']);
  const [leadTimesMinutes, setLeadTimesMinutes] = useState([30]);

  // Filters for multi-select lists
  const [currencySearch, setCurrencySearch] = useState('');
  const [pairSearch, setPairSearch] = useState('');

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [prefRes, pairsRes, currsRes] = await Promise.all([
          api.get('/calendar/alerts/preferences'),
          api.get('/calendar/alerts/supported-pairs'),
          api.get('/calendar/alerts/supported-currencies').catch(() => ({ data: null })),
        ]);

        if (prefRes.data?.data) {
          const pref = prefRes.data.data;
          setIsEnabled(pref.isEnabled !== false);
          setTargetingMode(pref.targetingMode || 'CURRENCIES_AND_PAIRS');
          setCurrencies(Array.isArray(pref.currencies) && pref.currencies.length > 0 ? pref.currencies : ['USD', 'EUR', 'GBP']);
          setPairs(Array.isArray(pref.pairs) && pref.pairs.length > 0 ? pref.pairs : ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']);
          setImpactLevels(Array.isArray(pref.impactLevels) && pref.impactLevels.length > 0 ? pref.impactLevels : ['HIGH']);
          setLeadTimesMinutes(Array.isArray(pref.leadTimesMinutes) && pref.leadTimesMinutes.length > 0 ? pref.leadTimesMinutes : [30]);
        }

        if (pairsRes.data?.data) {
          setSupportedPairs(pairsRes.data.data);
        }

        if (currsRes.data?.data) {
          setSupportedCurrencies(currsRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load alert preferences:', err);
        toast.error('Failed to load news alert preferences');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  // Load History when tab clicked
  useEffect(() => {
    if (!isOpen || activeTab !== 'history') return;

    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const res = await api.get('/calendar/alerts/history?limit=40');
        if (res.data?.data) {
          setHistoryLogs(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch alert history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, activeTab]);

  // Search filtered lists
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return supportedCurrencies;
    const q = currencySearch.trim().toUpperCase();
    return supportedCurrencies.filter(c => c.includes(q));
  }, [supportedCurrencies, currencySearch]);

  const filteredPairs = useMemo(() => {
    if (!pairSearch.trim()) return supportedPairs;
    const q = pairSearch.trim().toUpperCase();
    return supportedPairs.filter(p => p.includes(q));
  }, [supportedPairs, pairSearch]);

  // Live Summary Builder
  const liveSummaryText = useMemo(() => {
    if (!isEnabled) {
      return 'Economic news notifications are currently disabled. Saved preferences are retained.';
    }

    const parts = [];
    if (targetingMode === 'CURRENCIES_ONLY' || targetingMode === 'CURRENCIES_AND_PAIRS') {
      if (currencies.length > 0) {
        parts.push(`Monitoring ${currencies.slice(0, 3).join(', ')}${currencies.length > 3 ? ` +${currencies.length - 3} more` : ''}`);
      }
    }
    if (targetingMode === 'PAIRS_ONLY' || targetingMode === 'CURRENCIES_AND_PAIRS') {
      if (pairs.length > 0) {
        parts.push(`pairs ${pairs.slice(0, 3).join(', ')}${pairs.length > 3 ? ` +${pairs.length - 3} more` : ''}`);
      }
    }

    const impacts = impactLevels.map(i => i.toLowerCase()).join(' & ') || 'high';
    const timingStr = leadTimesMinutes.map(m => m >= 60 ? `${m/60}h` : `${m}m`).join(', ') || '30m';

    const targetDesc = parts.length > 0 ? parts.join(' and ') : 'No instruments selected';
    return `${targetDesc}. ${impacts} impact releases, notified ${timingStr} before release.`;
  }, [isEnabled, targetingMode, currencies, pairs, impactLevels, leadTimesMinutes]);

  if (!isOpen) return null;

  // Toggle helpers
  const toggleCurrency = (curr) => {
    if (currencies.includes(curr)) {
      setCurrencies(currencies.filter(c => c !== curr));
    } else {
      setCurrencies([...currencies, curr]);
    }
  };

  const selectAllCurrencies = () => {
    setCurrencies([...supportedCurrencies]);
  };

  const clearCurrencies = () => {
    setCurrencies([]);
  };

  const togglePair = (pair) => {
    if (pairs.includes(pair)) {
      setPairs(pairs.filter(p => p !== pair));
    } else {
      setPairs([...pairs, pair]);
    }
  };

  const applyPairPreset = (presetKey) => {
    if (presetKey === 'ALL') {
      setPairs([...supportedPairs]);
    } else if (presetKey === 'CLEAR') {
      setPairs([]);
    } else if (PRESET_GROUPS[presetKey]) {
      const unique = Array.from(new Set([...pairs, ...PRESET_GROUPS[presetKey]]));
      setPairs(unique);
    }
  };

  const toggleImpact = (impact) => {
    if (impactLevels.includes(impact)) {
      if (impactLevels.length === 1) {
        toast.error('Select at least one impact level');
        return;
      }
      setImpactLevels(impactLevels.filter(i => i !== impact));
    } else {
      setImpactLevels([...impactLevels, impact]);
    }
  };

  const toggleLeadTime = (val) => {
    if (leadTimesMinutes.includes(val)) {
      if (leadTimesMinutes.length === 1) {
        toast.error('Select at least one alert lead time');
        return;
      }
      setLeadTimesMinutes(leadTimesMinutes.filter(m => m !== val));
    } else {
      setLeadTimesMinutes([...leadTimesMinutes, val].sort((a, b) => a - b));
    }
  };

  // Immediate Global Toggle
  const handleToggleGlobal = async (nextState) => {
    setIsEnabled(nextState);
    try {
      setTogglingGlobal(true);
      const res = await api.patch('/calendar/alerts/toggle', { isEnabled: nextState });
      if (res.data?.success) {
        toast.success(nextState ? 'Economic news alerts enabled' : 'Economic news alerts paused');
        if (onPreferencesUpdated) {
          onPreferencesUpdated(res.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to toggle global alerts:', err);
      toast.error('Failed to update alert status');
      setIsEnabled(!nextState); // revert on failure
    } finally {
      setTogglingGlobal(false);
    }
  };

  // Save Full Form
  const handleSave = async (e) => {
    e?.preventDefault();

    if (isEnabled) {
      const needsCurrs = targetingMode === 'CURRENCIES_ONLY' || targetingMode === 'CURRENCIES_AND_PAIRS';
      const needsPairs = targetingMode === 'PAIRS_ONLY' || targetingMode === 'CURRENCIES_AND_PAIRS';

      if (targetingMode === 'CURRENCIES_ONLY' && currencies.length === 0) {
        toast.error('Select at least one currency to monitor');
        return;
      }

      if (targetingMode === 'PAIRS_ONLY' && pairs.length === 0) {
        toast.error('Select at least one currency pair to monitor');
        return;
      }

      if (targetingMode === 'CURRENCIES_AND_PAIRS' && currencies.length === 0 && pairs.length === 0) {
        toast.error('Select at least one currency or currency pair to monitor');
        return;
      }
    }

    try {
      setSaving(true);
      const res = await api.put('/calendar/alerts/preferences', {
        isEnabled,
        targetingMode,
        currencies,
        pairs,
        impactLevels,
        leadTimesMinutes,
      });

      if (res.data?.success) {
        toast.success('News alert preferences saved successfully');
        if (onPreferencesUpdated) {
          onPreferencesUpdated(res.data.data);
        }
        onClose();
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
      toast.error(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-surface-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Personal Economic News Alerts</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-surface-muted text-muted border border-border'
                }`}>
                  {isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-muted">
                Receive targeted alerts before high-impact economic releases affect your trading instruments.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border px-5 bg-surface">
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <Sliders size={13} />
            <span>Alert Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <History size={13} />
            <span>Alert History</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted gap-2">
              <RefreshCw size={24} className="animate-spin text-emerald-400" />
              <p className="text-xs">Loading alert preferences...</p>
            </div>
          ) : activeTab === 'preferences' ? (
            <>
              {/* 1. Global News Alerts Switch */}
              <div className="p-4 rounded-xl border border-border bg-surface-muted/40 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-foreground">Enable Economic News Alerts</div>
                    <div className="text-[11px] text-muted">
                      Control whether JAHZJOURNALS sends you notifications about upcoming economic events.
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={togglingGlobal}
                    onClick={() => handleToggleGlobal(!isEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                      isEnabled ? 'bg-emerald-500' : 'bg-surface-muted border border-border'
                    }`}
                    aria-label="Toggle economic news alerts"
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {!isEnabled && (
                  <div className="pt-2 border-t border-border/50 text-[11px] text-amber-400/90 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                    <span>Economic news notifications are currently paused. Your saved preferences below are preserved and will resume immediately when re-enabled.</span>
                  </div>
                )}
              </div>

              {/* 2. Alert Targeting Modes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe2 size={13} className="text-emerald-400" />
                  <span>Alert Targeting Mode</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetingMode('CURRENCIES_ONLY')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      targetingMode === 'CURRENCIES_ONLY'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                        : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs">Currencies Only</div>
                    <div className="text-[10px] text-muted font-normal mt-0.5">Alerts for selected individual currencies</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetingMode('PAIRS_ONLY')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      targetingMode === 'PAIRS_ONLY'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                        : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs">Currency Pairs Only</div>
                    <div className="text-[10px] text-muted font-normal mt-0.5">Alerts affecting currencies in your pairs</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetingMode('CURRENCIES_AND_PAIRS')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      targetingMode === 'CURRENCIES_AND_PAIRS'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                        : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs">Currencies & Pairs</div>
                    <div className="text-[10px] text-muted font-normal mt-0.5">Receive alerts from both lists (deduplicated)</div>
                  </button>
                </div>
              </div>

              {/* 3. Individual Currency Alerts */}
              {(targetingMode === 'CURRENCIES_ONLY' || targetingMode === 'CURRENCIES_AND_PAIRS') && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-surface-muted/20 border border-border/80">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Coins size={13} className="text-emerald-400" />
                        <span>Individual Currencies to Monitor</span>
                      </label>
                      <p className="text-[11px] text-muted">
                        Notify for economic events matching these currencies regardless of paired instruments.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      {currencies.length} selected
                    </span>
                  </div>

                  {/* Actions & Search */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllCurrencies}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-muted hover:text-foreground transition"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearCurrencies}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-rose-400 hover:text-rose-300 transition"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="relative w-36 sm:w-44">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        placeholder="Search currency..."
                        className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Currencies Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 p-2 rounded-xl bg-background/60 border border-border/60 max-h-36 overflow-y-auto">
                    {filteredCurrencies.map((c) => {
                      const isSelected = currencies.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCurrency(c)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition border flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-bold shadow-2xs'
                              : 'bg-surface-muted/50 border-border/50 text-muted hover:text-foreground hover:bg-surface-muted'
                          }`}
                        >
                          <span>{c}</span>
                          {isSelected && <Check size={11} className="text-emerald-400 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Currency-Pair Alerts */}
              {(targetingMode === 'PAIRS_ONLY' || targetingMode === 'CURRENCIES_AND_PAIRS') && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-surface-muted/20 border border-border/80">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Layers size={13} className="text-emerald-400" />
                        <span>Currency Pairs & Instruments</span>
                      </label>
                      <p className="text-[11px] text-muted">
                        Events match either currency in a pair (e.g. EURUSD monitors EUR and USD data).
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      {pairs.length} selected
                    </span>
                  </div>

                  {/* Presets & Search */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-muted mr-1">Presets:</span>
                      <button
                        type="button"
                        onClick={() => applyPairPreset('MAJORS')}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-muted hover:text-foreground transition"
                      >
                        Forex Majors
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPairPreset('CROSSES')}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-muted hover:text-foreground transition"
                      >
                        FX Crosses
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPairPreset('METALS_INDICES')}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-muted hover:text-foreground transition"
                      >
                        Gold & Indices
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPairPreset('ALL')}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-muted hover:text-foreground transition"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPairPreset('CLEAR')}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted border border-border/70 text-rose-400 hover:text-rose-300 transition"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="relative w-36 sm:w-44">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        value={pairSearch}
                        onChange={(e) => setPairSearch(e.target.value)}
                        placeholder="Search pairs..."
                        className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Pair Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 p-2 rounded-xl bg-background/60 border border-border/60 max-h-40 overflow-y-auto">
                    {filteredPairs.map((p) => {
                      const isSelected = pairs.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePair(p)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition border flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-bold shadow-2xs'
                              : 'bg-surface-muted/50 border-border/50 text-muted hover:text-foreground hover:bg-surface-muted'
                          }`}
                        >
                          <span>{p}</span>
                          {isSelected && <Check size={11} className="text-emerald-400 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Economic Impact Levels */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Flame size={13} className="text-rose-400" />
                  <span>Impact Levels to Monitor</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* High */}
                  <button
                    type="button"
                    onClick={() => toggleImpact('HIGH')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      impactLevels.includes('HIGH')
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                        : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                      <Flame size={14} className="text-rose-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>High Impact</span>
                        {impactLevels.includes('HIGH') && <Check size={12} className="stroke-[3]" />}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">NFP, CPI, Central Bank Rate Decisions</div>
                    </div>
                  </button>

                  {/* Medium */}
                  <button
                    type="button"
                    onClick={() => toggleImpact('MEDIUM')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      impactLevels.includes('MEDIUM')
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>Medium Impact</span>
                        {impactLevels.includes('MEDIUM') && <Check size={12} className="stroke-[3]" />}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">PMIs, Retail Sales, Trade Balance</div>
                    </div>
                  </button>

                  {/* Low */}
                  <button
                    type="button"
                    onClick={() => toggleImpact('LOW')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      impactLevels.includes('LOW')
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                        : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Layers size={14} className="text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>Low Impact</span>
                        {impactLevels.includes('LOW') && <Check size={12} className="stroke-[3]" />}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">Minor surveys, peripheral speeches</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 6. Notification Timing */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock size={13} className="text-emerald-400" />
                  <span>Advance Notice Lead Time</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LEAD_TIME_OPTIONS.map((opt) => {
                    const isSelected = leadTimesMinutes.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleLeadTime(opt.value)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                            : 'bg-surface-muted/40 border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Summary Box */}
              <div className="p-3 rounded-xl bg-background border border-border text-xs flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-foreground">Summary: </span>
                  <span className="text-muted leading-relaxed">{liveSummaryText}</span>
                </div>
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              <div className="text-xs text-muted">
                Audit log of dispatched economic news alerts across your currencies and trading instruments.
              </div>

              {historyLoading ? (
                <div className="py-8 flex justify-center text-muted">
                  <RefreshCw size={20} className="animate-spin text-emerald-400" />
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="py-12 text-center text-muted border border-border/60 rounded-xl bg-surface-muted/20">
                  <Bell size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">No economic news alerts recorded yet.</p>
                  <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                    Alerts will automatically appear here as upcoming economic releases match your selected currencies or instruments.
                  </p>
                </div>
              ) : (
                <div className="border border-border/80 rounded-xl overflow-hidden divide-y divide-border/60">
                  {historyLogs.map((log) => {
                    const isHigh = log.impact === 'HIGH';
                    const isMed = log.impact === 'MEDIUM';
                    return (
                      <div key={log.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-muted/30 transition">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isHigh ? 'bg-rose-500/20 text-rose-400' : isMed ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {log.eventCountry} &bull; {log.impact}
                            </span>
                            <span className="font-semibold text-foreground">{log.eventTitle}</span>
                          </div>
                          <div className="text-[11px] text-muted">
                            Targets affected: <strong className="text-foreground font-mono">{log.pair}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted self-end sm:self-center">
                          <span className="px-2 py-0.5 rounded bg-surface-muted border border-border font-mono text-[10px]">
                            {log.channel}
                          </span>
                          <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-surface-muted/20 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted hidden sm:block">
            {isEnabled ? 'Settings synchronize across devices' : 'Alerts are paused'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground border border-border bg-surface hover:bg-surface-muted transition"
            >
              Close
            </button>
            {activeTab === 'preferences' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} className="stroke-[3]" />
                    <span>Save Alert Preferences</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
