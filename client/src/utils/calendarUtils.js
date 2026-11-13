/**
 * Economic Calendar Pure Utilities (Timezone, Filtering, Release States, Persistence, Adaptive Refresh)
 * Designed to run identically in the browser and Node test environments.
 */

export const GUEST_CALENDAR_PREFS_STORAGE_KEY = 'jahz_calendar_preferences_v1';
export const GUEST_MIGRATION_DISMISSED_KEY = 'jahz_calendar_guest_migration_dismissed_v1';

export const CALENDAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'NGN', 'CNY', 'ZAR',
];

export const CALENDAR_IMPACTS = ['High', 'Medium', 'Low', 'Holiday'];

export const CALENDAR_CATEGORIES = [
  { id: 'INFLATION', label: 'Inflation', shortLabel: 'Inflation' },
  { id: 'EMPLOYMENT', label: 'Employment', shortLabel: 'Employment' },
  { id: 'CENTRAL_BANKS', label: 'Central Banks & Speeches', shortLabel: 'Central Banks' },
  { id: 'GROWTH_GDP', label: 'Growth / GDP', shortLabel: 'Growth/GDP' },
  { id: 'PMI_BUSINESS', label: 'PMI / Business Activity', shortLabel: 'PMI/Business' },
  { id: 'CONSUMER_SENTIMENT', label: 'Consumer Sentiment', shortLabel: 'Sentiment' },
  { id: 'TRADE', label: 'Trade', shortLabel: 'Trade' },
  { id: 'HOUSING', label: 'Housing', shortLabel: 'Housing' },
  { id: 'HOLIDAYS', label: 'Holidays', shortLabel: 'Holidays' },
];

export const ALLOWED_CATEGORY_IDS = CALENDAR_CATEGORIES.map((c) => c.id);
export const ALLOWED_VIEWS = ['today', 'tomorrow', 'this_week', 'upcoming'];

export const DEFAULT_CALENDAR_PREFERENCES = {
  useDeviceTimezone: true,
  timezone: 'UTC',
  timeFormat: '12h', // '12h' | '24h'
  defaultView: 'this_week', // 'today' | 'tomorrow' | 'this_week' | 'upcoming'
  showCompleted: true,
  density: 'comfortable', // 'comfortable' | 'compact'
  currencies: [], // empty = all currencies
  impacts: [], // empty = all impacts
  categories: [], // empty = all categories
  watchedPairsOnly: false,
  includeCorrelatedCurrencies: false,
  watchedPairs: [],
  preNewsBufferMinutes: 5,
  postNewsBufferMinutes: 5,
};

const CURATED_TRADING_ZONES = [
  'UTC',
  'Africa/Lagos',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'Europe/Frankfurt',
  'Europe/Zurich',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'Africa/Johannesburg',
];

const CORRELATED_CURRENCY_MAP = {
  EUR: ['CHF', 'GBP'],
  CHF: ['EUR'],
  GBP: ['EUR'],
  AUD: ['NZD', 'CAD'],
  NZD: ['AUD'],
  CAD: ['USD'],
  USD: ['CAD'],
  JPY: ['CHF'],
};

const INDEX_COMMODITY_CURRENCY_MAP = {
  US30: ['USD'],
  DJ30: ['USD'],
  NAS100: ['USD'],
  USTEC: ['USD'],
  SPX500: ['USD'],
  US500: ['USD'],
  DXY: ['USD'],
  GOLD: ['USD'],
  XAUUSD: ['USD'],
  XAGUSD: ['USD'],
  OIL: ['USD'],
  WTI: ['USD'],
  USOIL: ['USD'],
  GER40: ['EUR'],
  GER30: ['EUR'],
  DAX: ['EUR'],
  EUSTX50: ['EUR'],
  UK100: ['GBP'],
  FTSE: ['GBP'],
  JPN225: ['JPY'],
  NIKKEI: ['JPY'],
};

/**
 * Validates whether a given string is a supported IANA time zone.
 */
export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects the device's current IANA time zone with a safe UTC fallback.
 */
export function getDeviceTimeZone() {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(resolved) ? resolved : 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Resolves the effective IANA time zone from user preferences.
 */
export function getEffectiveTimeZone(prefs = DEFAULT_CALENDAR_PREFERENCES) {
  if (!prefs || prefs.useDeviceTimezone !== false) {
    return getDeviceTimeZone();
  }
  return isValidTimeZone(prefs.timezone) ? prefs.timezone : getDeviceTimeZone();
}

/**
 * Computes normalized UTC offset string like UTC+01:00, UTC-04:00, or UTC+00:00 for a given date.
 */
export function formatTimeZoneOffset(tz, referenceDate = new Date()) {
  const validTz = isValidTimeZone(tz) ? tz : 'UTC';
  try {
    const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      timeZoneName: 'longOffset',
    }).formatToParts(d);
    const offsetRaw = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';
    if (offsetRaw === 'GMT' || offsetRaw === 'UTC') return 'UTC+00:00';
    return offsetRaw.replace(/^GMT/i, 'UTC');
  } catch {
    return 'UTC+00:00';
  }
}

/**
 * Computes short zone abbreviation (e.g., WAT, EST, EDT, BST, GMT).
 */
export function formatTimeZoneShortName(tz, referenceDate = new Date()) {
  const validTz = isValidTimeZone(tz) ? tz : 'UTC';
  if (validTz === 'UTC' || validTz === 'Etc/UTC') return 'UTC';

  // Common WAT zones on runtimes that fall back to GMT+1
  const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      timeZoneName: 'short',
    }).formatToParts(d);
    const abbr = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    if (abbr && !/^GMT[+-]/i.test(abbr)) {
      return abbr;
    }
    if (validTz === 'Africa/Lagos') return 'WAT';
    return abbr;
  } catch {
    return '';
  }
}

/**
 * Formats an IANA zone badge like "Africa/Lagos (WAT, UTC+01:00)" or "UTC (UTC+00:00)".
 */
export function formatTimeZoneBadge(tz, referenceDate = new Date()) {
  const validTz = isValidTimeZone(tz) ? tz : 'UTC';
  const offset = formatTimeZoneOffset(validTz, referenceDate);
  const shortName = formatTimeZoneShortName(validTz, referenceDate);

  if (!shortName || shortName === 'UTC' && validTz === 'UTC') {
    return `${validTz} (${offset})`;
  }
  if (shortName.startsWith('GMT') || shortName.startsWith('UTC+')) {
    return `${validTz} (${offset})`;
  }
  return `${validTz} (${shortName}, ${offset})`;
}

/**
 * Builds searchable list of IANA time zones with curated trading zones prioritized first.
 */
export function getSearchableTimeZones(referenceDate = new Date()) {
  let supported = [];
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      supported = Intl.supportedValuesOf('timeZone');
    }
  } catch {
    supported = [];
  }

  const allZones = Array.from(new Set([...CURATED_TRADING_ZONES, ...supported]));
  return allZones.map((zone) => {
    const label = formatTimeZoneBadge(zone, referenceDate);
    const offset = formatTimeZoneOffset(zone, referenceDate);
    const shortName = formatTimeZoneShortName(zone, referenceDate);
    return {
      zone,
      label,
      offset,
      shortName,
      searchText: `${zone} ${label} ${offset} ${shortName}`.toLowerCase(),
    };
  });
}

/**
 * Formats an event timestamp in the target IANA timezone and 12h/24h preference.
 */
export function formatEventTimeInZone(isoString, timeZone = 'UTC', timeFormat = '12h') {
  if (!isoString) return '—';
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const hour12 = timeFormat !== '24h';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: hour12 ? 'numeric' : '2-digit',
      minute: '2-digit',
      hour12,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Returns YYYY-MM-DD calendar date key for an instant in the specified IANA timezone.
 */
export function getDateKeyInZone(dateInput, timeZone = 'UTC') {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Shifts a YYYY-MM-DD date key cleanly by deltaDays.
 */
export function addDaysToDateKey(dateKey, deltaDays) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Formats a date-group header in the specified IANA timezone (e.g., "Today — Friday, Nov 13, 2026").
 */
export function formatDateGroupHeaderInZone(isoString, timeZone = 'UTC', nowMs = Date.now()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);

  const eventKey = getDateKeyInZone(d, tz);
  const todayKey = getDateKeyInZone(nowMs, tz);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  if (eventKey === todayKey) return `Today — ${formatted}`;
  if (eventKey === tomorrowKey) return `Tomorrow — ${formatted}`;
  return formatted;
}

/**
 * Checks whether an event belongs to the selected date range in the chosen IANA time zone.
 */
export function isEventInSelectedRange(eventIso, range = 'this_week', timeZone = 'UTC', nowMs = Date.now()) {
  if (!eventIso) return false;
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const evMs = new Date(eventIso).getTime();
  if (Number.isNaN(evMs)) return false;

  if (range === 'today') {
    return getDateKeyInZone(evMs, tz) === getDateKeyInZone(nowMs, tz);
  }
  if (range === 'tomorrow') {
    const todayKey = getDateKeyInZone(nowMs, tz);
    return getDateKeyInZone(evMs, tz) === addDaysToDateKey(todayKey, 1);
  }
  if (range === 'upcoming') {
    return evMs >= nowMs;
  }
  return true;
}

/**
 * Deterministic client-side fallback category classifier matching server logic.
 */
export function classifyEventCategoryClient(title = '', impact = '') {
  const imp = String(impact || '').trim().toLowerCase();
  const t = String(title || '').trim();

  if (imp === 'holiday' || /\b(bank holiday|holiday|market closed|all day)\b/i.test(t)) {
    return 'HOLIDAYS';
  }
  if (/\b(cpi|ppi|pce|inflation|price index|rpi|hpi|house price|wage|average hourly earnings|average earnings|deflator|import prices|export prices)\b/i.test(t)) {
    return 'INFLATION';
  }
  if (/\b(nfp|non-farm|nonfarm|non farm|unemployment|employment|jobless|initial claims|continuing claims|adp|jolts|payrolls|labor|labour|claimant count|participation rate)\b/i.test(t)) {
    return 'EMPLOYMENT';
  }
  if (/\b(fomc|fed|ecb|boe|boj|rba|rbnz|boc|snb|pboc|central bank|interest rate|rate decision|rate statement|monetary policy|policy rate|cash rate|official bank rate|mpc|minutes|speaks|speech|testifies|testimony|press conference|powell|lagarde|bailey|ueda|macklem|bullock|jordan|schlegel|kugler|waller|williams|bostic|barkin|daly|kashkari|goolsbee|bowman)\b/i.test(t)) {
    return 'CENTRAL_BANKS';
  }
  if (/\b(building permits|housing starts|existing home|new home|pending home|construction|nahb|mortgage|home sales|rics)\b/i.test(t)) {
    return 'HOUSING';
  }
  if (/\b(trade balance|balance of trade|current account|exports|imports|tic long-term|foreign investment|goods trade)\b/i.test(t)) {
    return 'TRADE';
  }
  if (/\b(consumer confidence|consumer sentiment|michigan|uom|cb consumer|gfk|westpac|sentix|household confidence|business confidence)\b/i.test(t)) {
    return 'CONSUMER_SENTIMENT';
  }
  if (/\b(pmi|ism|manufacturing|services|business climate|ifo|zew|tankan|empire state|philly fed|philadelphia fed|chicago pmi|richmond|dallas|kansas|nfib|flash)\b/i.test(t)) {
    return 'PMI_BUSINESS';
  }
  return 'GROWTH_GDP';
}

/**
 * Extracts base and quote currencies from a watched trading pair.
 */
export function extractCurrenciesFromPairClient(pair) {
  if (!pair || typeof pair !== 'string') return [];
  const clean = pair.replace(/[\/\-_.\s]/g, '').trim().toUpperCase();
  if (!clean) return [];

  if (INDEX_COMMODITY_CURRENCY_MAP[clean]) {
    return [...INDEX_COMMODITY_CURRENCY_MAP[clean]];
  }
  if (clean.length === 6 && /^[A-Z]{6}$/.test(clean)) {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);
    if (base === 'XAU' || base === 'XAG') return ['USD', quote];
    return [base, quote];
  }
  for (const [key, currs] of Object.entries(INDEX_COMMODITY_CURRENCY_MAP)) {
    if (clean.includes(key)) return [...currs];
  }
  return [];
}

/**
 * Resolves unique currencies affected by watched pairs, optionally including correlated currencies.
 */
export function resolveWatchedCurrencies(watchedPairs = [], includeCorrelated = false) {
  const direct = new Set();
  for (const pair of watchedPairs) {
    for (const c of extractCurrenciesFromPairClient(pair)) {
      direct.add(c);
    }
  }
  if (!includeCorrelated) {
    return [...direct];
  }
  const expanded = new Set(direct);
  for (const c of direct) {
    const corrs = CORRELATED_CURRENCY_MAP[c] || [];
    for (const corr of corrs) {
      expanded.add(corr);
    }
  }
  return [...expanded];
}

/**
 * Computes event display state across all 5 states:
 * - SCHEDULED
 * - AWAITING_RELEASE
 * - DELAYED (Delayed / time tentative)
 * - RELEASED
 * - REVISED
 */
export function getEventReleaseDisplay(ev, nowMs = Date.now(), timeZone = 'UTC', timeFormat = '12h') {
  if (!ev || !ev.date) return null;
  const scheduledMs = new Date(ev.date).getTime();
  if (Number.isNaN(scheduledMs)) return null;

  const diffMs = scheduledMs - nowMs;
  const hasActual = Boolean(ev.actual && String(ev.actual).trim() !== '');
  const isHoliday = String(ev.impact || '').toLowerCase() === 'holiday';
  const hasNumericExpectation = Boolean(
    (ev.forecast && String(ev.forecast).trim() !== '') ||
    (ev.previous && String(ev.previous).trim() !== '')
  );

  if (isHoliday) {
    return {
      state: 'RELEASED',
      label: 'All Day',
      actualText: null,
      timingSublabel: null,
      isCompleted: diffMs < 0,
      isAwaiting: false,
      isDelayed: false,
      isRevised: false,
      className: 'text-sky-400 bg-sky-500/10 border-sky-500/25 font-medium',
    };
  }

  // Upcoming scheduled event -> Live countdown
  if (diffMs > 0) {
    let countdown = 'Scheduled';
    let className = 'text-muted bg-surface-muted/60 border-border/60 font-medium font-mono tabular-nums';

    if (diffMs < 60 * 1000) {
      const secs = Math.max(1, Math.ceil(diffMs / 1000));
      countdown = `in ${secs}s`;
      className = 'text-rose-400 bg-rose-500/15 border-rose-500/30 animate-pulse font-bold font-mono tabular-nums';
    } else if (diffMs < 10 * 60 * 1000) {
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      countdown = `in ${mins}m ${secs}s`;
      className = 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-bold font-mono tabular-nums';
    } else if (diffMs < 60 * 60 * 1000) {
      const mins = Math.ceil(diffMs / 60000);
      countdown = `in ${mins}m`;
      className = 'text-amber-400 bg-amber-500/10 border-amber-500/30 font-bold font-mono tabular-nums';
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      const totalMins = Math.floor(diffMs / 60000);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      countdown = `in ${h}h ${m}m`;
      className = 'text-emerald-400/90 bg-emerald-500/10 border-emerald-500/20 font-semibold font-mono tabular-nums';
    } else {
      const totalHours = Math.floor(diffMs / 3600000);
      const d = Math.floor(totalHours / 24);
      const h = totalHours % 24;
      countdown = `in ${d}d ${h}h`;
    }

    return {
      state: 'SCHEDULED',
      label: countdown,
      stateTitle: 'Scheduled',
      actualText: null,
      timingSublabel: null,
      isCompleted: false,
      isAwaiting: false,
      isDelayed: false,
      isRevised: false,
      className,
    };
  }

  // Event scheduled timestamp has arrived or passed (diffMs <= 0)
  const scheduledStr = formatEventTimeInZone(ev.date, timeZone, timeFormat);
  const receivedStr = ev.receivedAt ? formatEventTimeInZone(ev.receivedAt, timeZone, timeFormat) : null;
  const timingSublabel = receivedStr ? `Scheduled ${scheduledStr} · received ${receivedStr}` : null;

  if (hasActual && ev.isRevised) {
    return {
      state: 'REVISED',
      label: 'Revised',
      stateTitle: ev.previousActual ? `Revised from ${ev.previousActual}` : 'Revised by provider',
      actualText: ev.actual,
      timingSublabel,
      isCompleted: true,
      isAwaiting: false,
      isDelayed: false,
      isRevised: true,
      className: 'text-sky-400 bg-sky-500/15 border-sky-500/30 font-semibold',
    };
  }

  if (hasActual) {
    return {
      state: 'RELEASED',
      label: 'Released',
      stateTitle: timingSublabel || 'Released',
      actualText: ev.actual,
      timingSublabel,
      isCompleted: true,
      isAwaiting: false,
      isDelayed: false,
      isRevised: false,
      className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 font-semibold',
    };
  }

  const elapsedMs = Math.abs(diffMs);

  if (Boolean(ev.isTentative)) {
    return {
      state: 'DELAYED',
      label: 'Delayed / time tentative',
      stateTitle: 'Time tentative or delayed upstream',
      actualText: 'Delayed',
      timingSublabel: null,
      isCompleted: false,
      isAwaiting: false,
      isDelayed: true,
      isRevised: false,
      className: 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-semibold',
    };
  }

  if (!hasNumericExpectation) {
    if (elapsedMs <= 5 * 60 * 1000) {
      return {
        state: 'AWAITING_RELEASE',
        label: 'Awaiting release',
        stateTitle: 'Awaiting release',
        actualText: 'Awaiting release',
        timingSublabel: null,
        isCompleted: false,
        isAwaiting: true,
        isDelayed: false,
        isRevised: false,
        className: 'text-amber-400 bg-amber-500/15 border-amber-500/30 animate-pulse font-semibold',
      };
    }
    return {
      state: 'RELEASED',
      label: 'Released',
      stateTitle: 'Completed',
      actualText: null,
      timingSublabel: null,
      isCompleted: true,
      isAwaiting: false,
      isDelayed: false,
      isRevised: false,
      className: 'text-muted/70 bg-surface-muted/40 border-border/50 font-medium',
    };
  }

  if (elapsedMs <= 15 * 60 * 1000) {
    return {
      state: 'AWAITING_RELEASE',
      label: 'Awaiting release',
      stateTitle: 'Scheduled time reached; awaiting figure from provider',
      actualText: 'Awaiting release',
      timingSublabel: null,
      isCompleted: false,
      isAwaiting: true,
      isDelayed: false,
      isRevised: false,
      className: 'text-amber-400 bg-amber-500/15 border-amber-500/30 animate-pulse font-semibold',
    };
  }

  return {
    state: 'DELAYED',
    label: 'Delayed / time tentative',
    stateTitle: 'No figure published 15m+ after scheduled release',
    actualText: 'Delayed',
    timingSublabel: null,
    isCompleted: false,
    isAwaiting: false,
    isDelayed: true,
    isRevised: false,
    className: 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-semibold',
  };
}

/**
 * Evaluates Prop-Firm Risk Window using user-configured pre-news and post-news buffers.
 * Keeps the risk window active until BOTH:
 * 1. The post-news buffer has elapsed, AND
 * 2. The event is marked RELEASED, REVISED, or DELAYED.
 */
export function computePropFirmRiskStatus(events = [], nowMs = Date.now(), preBufferMins = 5, postBufferMins = 5) {
  const preMs = Math.max(1, Number(preBufferMins) || 5) * 60000;
  const postMs = Math.max(1, Number(postBufferMins) || 5) * 60000;
  const bufferLabel = preBufferMins === postBufferMins
    ? `±${preBufferMins}m buffer`
    : `-${preBufferMins}m / +${postBufferMins}m buffer`;

  const highEvents = events.filter((e) => e && e.impact === 'High' && e.date);

  const activeRestricted = highEvents.find((ev) => {
    const t = new Date(ev.date).getTime();
    if (Number.isNaN(t)) return false;

    const withinPreBuffer = nowMs >= t - preMs && nowMs <= t;
    if (withinPreBuffer) return true;

    const releaseInfo = getEventReleaseDisplay(ev, nowMs);
    const postElapsed = nowMs > t + postMs;
    const isResolved = releaseInfo?.state === 'RELEASED' || releaseInfo?.state === 'REVISED' || releaseInfo?.state === 'DELAYED';

    // Remain active past t if post-buffer hasn't elapsed OR if the release is still AWAITING_RELEASE
    if (nowMs >= t && (!postElapsed || (releaseInfo?.state === 'AWAITING_RELEASE' && nowMs - t <= Math.max(postMs, 15 * 60000)))) {
      return true;
    }

    return nowMs >= t && !isResolved && !postElapsed;
  });

  if (activeRestricted) {
    const releaseInfo = getEventReleaseDisplay(activeRestricted, nowMs);
    const awaitingHold = releaseInfo?.state === 'AWAITING_RELEASE' && nowMs > new Date(activeRestricted.date).getTime() + postMs;
    return {
      level: 'CRITICAL',
      title: 'Active Restricted News Window',
      badge: awaitingHold ? `Active (${bufferLabel} · awaiting release)` : `Active Buffer (${bufferLabel})`,
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold',
      description: awaitingHold
        ? `High-impact release (${activeRestricted.country} — ${activeRestricted.title}) is still awaiting its figure. Your risk window remains open until it is marked released or delayed.`
        : `High-impact release (${activeRestricted.country} — ${activeRestricted.title}) is within your configured ${bufferLabel} safeguard window.`,
      activeEvent: activeRestricted,
    };
  }

  const imminentRestricted = highEvents.find((e) => {
    const t = new Date(e.date).getTime();
    const diff = t - nowMs;
    return diff > preMs && diff <= 60 * 60 * 1000;
  });

  if (imminentRestricted) {
    const minsLeft = Math.max(1, Math.ceil((new Date(imminentRestricted.date).getTime() - nowMs) / 60000));
    return {
      level: 'WARNING',
      title: 'Safeguard Window Approaching',
      badge: `Window in ${minsLeft}m (${bufferLabel})`,
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold',
      description: `High-impact release (${imminentRestricted.country} — ${imminentRestricted.title}) is scheduled in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}. Configured safeguard: ${bufferLabel}.`,
      activeEvent: imminentRestricted,
    };
  }

  return {
    level: 'CLEAR',
    title: 'Clear Planning Window',
    badge: `No High-Impact Catalyst Within 60m (${bufferLabel})`,
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold',
    description: `No high-impact events are inside the next 60 minutes. Your configured pre/post buffer is ${bufferLabel}.`,
    activeEvent: null,
  };
}

/**
 * Sanitizes and validates calendar preferences object with safe fallbacks.
 */
export function sanitizeCalendarPreferences(input = {}, fallback = DEFAULT_CALENDAR_PREFERENCES) {
  const src = input && typeof input === 'object' ? input : {};
  const fb = fallback && typeof fallback === 'object' ? fallback : DEFAULT_CALENDAR_PREFERENCES;

  const useDeviceTimezone = typeof src.useDeviceTimezone === 'boolean' ? src.useDeviceTimezone : Boolean(fb.useDeviceTimezone);
  const timezone = isValidTimeZone(src.timezone) ? src.timezone : (isValidTimeZone(fb.timezone) ? fb.timezone : 'UTC');
  const timeFormat = src.timeFormat === '24h' || src.timeFormat === '12h' ? src.timeFormat : fb.timeFormat;
  const defaultView = ALLOWED_VIEWS.includes(src.defaultView) ? src.defaultView : fb.defaultView;
  const showCompleted = typeof src.showCompleted === 'boolean' ? src.showCompleted : Boolean(fb.showCompleted);
  const density = src.density === 'compact' || src.density === 'comfortable' ? src.density : fb.density;

  const currencies = Array.isArray(src.currencies)
    ? [...new Set(src.currencies.map((c) => String(c || '').trim().toUpperCase()).filter((c) => CALENDAR_CURRENCIES.includes(c)))]
    : [...(fb.currencies || [])];

  const impacts = Array.isArray(src.impacts)
    ? [...new Set(src.impacts.map((i) => CALENDAR_IMPACTS.find((x) => x.toLowerCase() === String(i || '').trim().toLowerCase())).filter(Boolean))]
    : [...(fb.impacts || [])];

  const categories = Array.isArray(src.categories)
    ? [...new Set(src.categories.map((c) => String(c || '').trim().toUpperCase()).filter((c) => ALLOWED_CATEGORY_IDS.includes(c)))]
    : [...(fb.categories || [])];

  const watchedPairsOnly = typeof src.watchedPairsOnly === 'boolean' ? src.watchedPairsOnly : Boolean(fb.watchedPairsOnly);
  const includeCorrelatedCurrencies = typeof src.includeCorrelatedCurrencies === 'boolean'
    ? src.includeCorrelatedCurrencies
    : Boolean(fb.includeCorrelatedCurrencies);
  const watchedPairs = Array.isArray(src.watchedPairs)
    ? [...new Set(src.watchedPairs.map((p) => String(p || '').replace(/[\/\-_.\s]/g, '').trim().toUpperCase()).filter(Boolean))]
    : [...(fb.watchedPairs || [])];

  const clampMin = (v, d) => {
    const n = Number.parseInt(v, 10);
    return !Number.isNaN(n) && n >= 1 && n <= 60 ? n : d;
  };

  return {
    useDeviceTimezone,
    timezone,
    timeFormat,
    defaultView,
    showCompleted,
    density,
    currencies,
    impacts,
    categories,
    watchedPairsOnly,
    includeCorrelatedCurrencies,
    watchedPairs,
    preNewsBufferMinutes: clampMin(src.preNewsBufferMinutes, fb.preNewsBufferMinutes),
    postNewsBufferMinutes: clampMin(src.postNewsBufferMinutes, fb.postNewsBufferMinutes),
  };
}

/**
 * Compares two calendar preference objects by their meaningful fields.
 */
export function preferencesDiffer(a, b) {
  const normA = sanitizeCalendarPreferences(a);
  const normB = sanitizeCalendarPreferences(b);
  const sortArr = (arr) => [...arr].sort().join(',');

  return (
    normA.useDeviceTimezone !== normB.useDeviceTimezone ||
    normA.timezone !== normB.timezone ||
    normA.timeFormat !== normB.timeFormat ||
    normA.defaultView !== normB.defaultView ||
    normA.showCompleted !== normB.showCompleted ||
    normA.density !== normB.density ||
    normA.watchedPairsOnly !== normB.watchedPairsOnly ||
    normA.includeCorrelatedCurrencies !== normB.includeCorrelatedCurrencies ||
    normA.preNewsBufferMinutes !== normB.preNewsBufferMinutes ||
    normA.postNewsBufferMinutes !== normB.postNewsBufferMinutes ||
    sortArr(normA.currencies) !== sortArr(normB.currencies) ||
    sortArr(normA.impacts) !== sortArr(normB.impacts) ||
    sortArr(normA.categories) !== sortArr(normB.categories)
  );
}

function getBrowserStorage(storageOverride) {
  if (storageOverride) return storageOverride;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

export function loadGuestCalendarPreferences(storageOverride) {
  const store = getBrowserStorage(storageOverride);
  if (!store) return { ...DEFAULT_CALENDAR_PREFERENCES };
  try {
    const raw = store.getItem(GUEST_CALENDAR_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CALENDAR_PREFERENCES };
    const parsed = JSON.parse(raw);
    return sanitizeCalendarPreferences(parsed, DEFAULT_CALENDAR_PREFERENCES);
  } catch {
    return { ...DEFAULT_CALENDAR_PREFERENCES };
  }
}

export function saveGuestCalendarPreferences(prefs, storageOverride) {
  const store = getBrowserStorage(storageOverride);
  const sanitized = sanitizeCalendarPreferences(prefs, DEFAULT_CALENDAR_PREFERENCES);
  if (store) {
    try {
      store.setItem(GUEST_CALENDAR_PREFS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }
  return sanitized;
}

export function clearGuestCalendarPreferences(storageOverride) {
  const store = getBrowserStorage(storageOverride);
  if (store) {
    try {
      store.removeItem(GUEST_CALENDAR_PREFS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function hasCustomGuestPreferences(storageOverride) {
  const store = getBrowserStorage(storageOverride);
  if (!store) return false;
  try {
    const raw = store.getItem(GUEST_CALENDAR_PREFS_STORAGE_KEY);
    if (!raw) return false;
    const loaded = sanitizeCalendarPreferences(JSON.parse(raw), DEFAULT_CALENDAR_PREFERENCES);
    return preferencesDiffer(loaded, DEFAULT_CALENDAR_PREFERENCES);
  } catch {
    return false;
  }
}

/**
 * Checks whether current active page filters match saved preferences.
 */
export function areFiltersEqualToSavedPreferences(activeFilters = {}, savedPrefs = DEFAULT_CALENDAR_PREFERENCES) {
  const sortStr = (arr = []) => [...arr].map((s) => String(s).toUpperCase()).sort().join(',');
  const normSaved = sanitizeCalendarPreferences(savedPrefs);

  return (
    (activeFilters.range || 'this_week') === normSaved.defaultView &&
    Boolean(activeFilters.showCompleted ?? true) === normSaved.showCompleted &&
    Boolean(activeFilters.watchedPairsOnly) === normSaved.watchedPairsOnly &&
    sortStr(activeFilters.currencies || []) === sortStr(normSaved.currencies) &&
    sortStr(activeFilters.impacts || []) === sortStr(normSaved.impacts) &&
    sortStr(activeFilters.categories || []) === sortStr(normSaved.categories) &&
    !String(activeFilters.search || '').trim()
  );
}

/**
 * Generates concise, human-readable active filter summary e.g.:
 * "Showing: Today · EUR · High + Medium impact"
 */
export function buildFilterSummaryText({
  range = 'this_week',
  currencies = [],
  impacts = [],
  categories = [],
  watchedPairsOnly = false,
  includeCorrelatedCurrencies = false,
  showCompleted = true,
  search = '',
} = {}) {
  const rangeLabel =
    range === 'today'
      ? 'Today'
      : range === 'tomorrow'
      ? 'Tomorrow'
      : range === 'upcoming'
      ? 'Upcoming'
      : 'This Week';

  const parts = [rangeLabel];

  if (watchedPairsOnly) {
    parts.push(includeCorrelatedCurrencies ? 'Watched pairs (+correlated)' : 'Watched pairs only');
  } else if (currencies.length > 0) {
    parts.push(currencies.join(', '));
  } else {
    parts.push('All currencies');
  }

  if (impacts.length > 0) {
    const impactStr = impacts.map((i) => (i === 'Holiday' ? 'Holidays' : i)).join(' + ');
    parts.push(`${impactStr} impact`);
  } else {
    parts.push('All impacts');
  }

  if (categories.length > 0) {
    const catNames = categories.map((id) => {
      const found = CALENDAR_CATEGORIES.find((c) => c.id === id);
      return found ? found.shortLabel : id;
    });
    parts.push(catNames.length <= 2 ? catNames.join(', ') : `${catNames.length} categories`);
  }

  if (!showCompleted) {
    parts.push('Hide completed');
  }

  if (search && search.trim()) {
    parts.push(`"${search.trim()}"`);
  }

  return `Showing: ${parts.join(' · ')}`;
}

/**
 * Computes adaptive background polling interval for the frontend calendar feed.
 * - High-impact event within [-30s, +5m] without actual: 4s (+ backoff on errors)
 * - Medium-impact event within [-30s, +5m] without actual: 15s (+ backoff on errors)
 * - Normal browsing: 120s
 */
export function getAdaptiveRefreshPlan(events = [], nowMs = Date.now(), errorCount = 0) {
  let hasHighWindow = false;
  let hasMediumWindow = false;

  for (const ev of events) {
    if (!ev || !ev.date || ev.impact === 'Holiday') continue;
    const hasActual = Boolean(ev.actual && String(ev.actual).trim() !== '');
    if (hasActual) continue;

    const scheduledMs = new Date(ev.date).getTime();
    if (Number.isNaN(scheduledMs)) continue;

    const diffFromScheduled = nowMs - scheduledMs;
    const inWindow = diffFromScheduled >= -30 * 1000 && diffFromScheduled <= 5 * 60 * 1000;
    if (!inWindow) continue;

    if (ev.impact === 'High') {
      hasHighWindow = true;
      break;
    }
    if (ev.impact === 'Medium') {
      hasMediumWindow = true;
    }
  }

  const backoffMult = Math.min(8, Math.pow(2, Math.max(0, errorCount)));

  if (hasHighWindow) {
    return {
      mode: 'HIGH_IMPACT_WINDOW',
      intervalMs: Math.min(60000, 4000 * backoffMult),
      reason: 'High-impact release window active',
    };
  }

  if (hasMediumWindow) {
    return {
      mode: 'MEDIUM_IMPACT_WINDOW',
      intervalMs: Math.min(120000, 15000 * backoffMult),
      reason: 'Medium-impact release window active',
    };
  }

  return {
    mode: 'NORMAL',
    intervalMs: Math.min(600000, 120000 * backoffMult),
    reason: 'Standard background refresh',
  };
}
