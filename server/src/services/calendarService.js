const { getInstrumentConfig } = require('./instrumentService');
const {
  defaultScheduleProvider,
  defaultActualsProvider,
  defaultObservationStore,
} = require('./calendarProviders');

let cachedMergedEvents = [];
let lastMergedAt = 0;

const EVENT_CATEGORIES = [
  { id: 'INFLATION', label: 'Inflation' },
  { id: 'EMPLOYMENT', label: 'Employment' },
  { id: 'CENTRAL_BANKS', label: 'Central Banks & Speeches' },
  { id: 'GROWTH_GDP', label: 'Growth / GDP' },
  { id: 'PMI_BUSINESS', label: 'PMI / Business Activity' },
  { id: 'CONSUMER_SENTIMENT', label: 'Consumer Sentiment' },
  { id: 'TRADE', label: 'Trade' },
  { id: 'HOUSING', label: 'Housing' },
  { id: 'HOLIDAYS', label: 'Holidays' },
];

const FALLBACK_EVENTS = [
  {
    title: 'Non-Farm Employment Change (NFP)',
    country: 'USD',
    date: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    impact: 'High',
    actual: '',
    forecast: '175K',
    previous: '254K',
  },
  {
    title: 'Unemployment Rate',
    country: 'USD',
    date: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    impact: 'High',
    actual: '',
    forecast: '4.1%',
    previous: '4.1%',
  },
  {
    title: 'CPI m/m',
    country: 'USD',
    date: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
    impact: 'High',
    actual: '',
    forecast: '0.3%',
    previous: '0.2%',
  },
  {
    title: 'ECB Monetary Policy Statement',
    country: 'EUR',
    date: new Date(Date.now() + 3600 * 1000 * 28).toISOString(),
    impact: 'High',
    actual: '',
    forecast: '3.25%',
    previous: '3.50%',
  },
  {
    title: 'BoE Official Bank Rate',
    country: 'GBP',
    date: new Date(Date.now() + 3600 * 1000 * 48).toISOString(),
    impact: 'High',
    actual: '',
    forecast: '4.75%',
    previous: '5.00%',
  },
  {
    title: 'Cash Rate',
    country: 'AUD',
    date: new Date(Date.now() + 3600 * 1000 * 6).toISOString(),
    impact: 'High',
    actual: '',
    forecast: '4.35%',
    previous: '4.35%',
  },
];

const SCALE_MULT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

const SUBJECT_GROUPS = [
  ['construction'],
  ['manufacturing', 'factory'],
  ['industrial'],
  ['services'],
  ['retail'],
  ['wholesale'],
  ['core'],
  ['cpi', 'inflation rate', 'consumer price'],
  ['ppi', 'producer price', 'corp goods price'],
  ['gdp', 'gross domestic'],
  ['unemployment claims', 'initial jobless'],
  ['unemployment rate', 'jobless rate'],
  ['non-farm', 'non farm', 'nfp', 'payrolls'],
  ['adp'],
  ['crude oil', 'eia wkly crude'],
  ['existing home'],
  ['new home'],
  ['pending home'],
  ['building permits'],
  ['housing starts'],
  ['trade balance', 'balance of trade'],
  ['current account'],
  ['household spending'],
  ['bank lending'],
  ['m2', 'money supply'],
  ['sentix'],
  ['westpac', 'consumer sentiment', 'consumer confidence'],
  ['nab'],
  ['rics', 'house price'],
  ['nfib'],
  ['brc'],
  ['watchers'],
  ['visitor'],
];

/**
 * Validates an IANA time zone string using Intl.DateTimeFormat
 */
function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts YYYY, MM, DD calendar date parts in a given IANA time zone
 */
function getDatePartsInTimeZone(dateInput, timeZone = 'UTC') {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, key };
}

/**
 * Shifts a YYYY-MM-DD calendar date key by deltaDays cleanly
 */
function addDaysToDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Classifies an economic event into one of the 9 standard categories
 */
function classifyEventCategory(title = '', impact = '') {
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
  if (/\b(gdp|gross domestic|industrial production|capacity utilization|factory orders|durable goods|retail sales|leading index|economic optimism|personal spending|personal income|core durable)\b/i.test(t)) {
    return 'GROWTH_GDP';
  }

  // Fallback for general fiscal/economic releases
  return 'GROWTH_GDP';
}

/**
 * Computes canonical release state for transparency:
 * - SCHEDULED
 * - AWAITING_RELEASE
 * - DELAYED (Delayed / time tentative)
 * - RELEASED
 * - REVISED
 */
function computeEventReleaseState(event, nowMs = Date.now()) {
  if (!event || !event.date) {
    return {
      state: 'SCHEDULED',
      label: 'Scheduled',
      isAwaiting: false,
      isDelayed: false,
      isReleased: false,
      isRevised: false,
    };
  }

  const scheduledMs = new Date(event.date).getTime();
  const hasActual = Boolean(event.actual && String(event.actual).trim() !== '');
  const isHoliday = String(event.impact || '').toLowerCase() === 'holiday';
  const hasNumericExpectation = Boolean(
    (event.forecast && String(event.forecast).trim() !== '') ||
    (event.previous && String(event.previous).trim() !== '')
  );

  if (Boolean(event.isRevised) && hasActual) {
    return {
      state: 'REVISED',
      label: 'Revised',
      isAwaiting: false,
      isDelayed: false,
      isReleased: true,
      isRevised: true,
    };
  }

  if (hasActual) {
    return {
      state: 'RELEASED',
      label: 'Released',
      isAwaiting: false,
      isDelayed: false,
      isReleased: true,
      isRevised: false,
    };
  }

  if (Boolean(event.isTentative) && nowMs >= scheduledMs) {
    return {
      state: 'DELAYED',
      label: 'Delayed / time tentative',
      isAwaiting: false,
      isDelayed: true,
      isReleased: false,
      isRevised: false,
    };
  }

  if (nowMs < scheduledMs) {
    return {
      state: 'SCHEDULED',
      label: 'Scheduled',
      isAwaiting: false,
      isDelayed: false,
      isReleased: false,
      isRevised: false,
    };
  }

  if (isHoliday) {
    return {
      state: 'RELEASED',
      label: 'All Day',
      isAwaiting: false,
      isDelayed: false,
      isReleased: true,
      isRevised: false,
    };
  }

  const elapsedMs = nowMs - scheduledMs;

  // Speeches/statements without forecast/previous do not publish numeric actuals
  if (!hasNumericExpectation) {
    if (elapsedMs <= 5 * 60 * 1000) {
      return {
        state: 'AWAITING_RELEASE',
        label: 'Awaiting release',
        isAwaiting: true,
        isDelayed: false,
        isReleased: false,
        isRevised: false,
      };
    }
    return {
      state: 'RELEASED',
      label: 'Completed',
      isAwaiting: false,
      isDelayed: false,
      isReleased: true,
      isRevised: false,
    };
  }

  // Quantitative releases typically arrive 1-3 minutes (up to 15m) after scheduled timestamp
  if (elapsedMs <= 15 * 60 * 1000) {
    return {
      state: 'AWAITING_RELEASE',
      label: 'Awaiting release',
      isAwaiting: true,
      isDelayed: false,
      isReleased: false,
      isRevised: false,
    };
  }

  return {
    state: 'DELAYED',
    label: 'Delayed / time tentative',
    isAwaiting: false,
    isDelayed: true,
    isReleased: false,
    isRevised: false,
  };
}

/**
 * Computes adaptive poll plan on server/client:
 * - High-impact window [-30s, +5m]: 4000ms (with backoff on error)
 * - Medium-impact window [-30s, +5m]: 15000ms (with backoff on error)
 * - Normal browsing: 120000ms
 */
function computeAdaptivePollPlan(events = [], nowMs = Date.now(), consecutiveErrors = 0) {
  let hasHighWindow = false;
  let hasMediumWindow = false;

  for (const ev of events) {
    if (!ev || !ev.date || ev.impact === 'Holiday') continue;
    const hasActual = Boolean(ev.actual && String(ev.actual).trim() !== '');
    if (hasActual) continue;

    const scheduledMs = new Date(ev.date).getTime();
    const diffFromScheduled = nowMs - scheduledMs;
    const inReleaseWindow = diffFromScheduled >= -30 * 1000 && diffFromScheduled <= 5 * 60 * 1000;

    if (!inReleaseWindow) continue;
    if (ev.impact === 'High') {
      hasHighWindow = true;
      break;
    }
    if (ev.impact === 'Medium') {
      hasMediumWindow = true;
    }
  }

  const backoffMult = Math.min(8, Math.pow(2, Math.max(0, consecutiveErrors)));

  if (hasHighWindow) {
    return {
      mode: 'HIGH_IMPACT_WINDOW',
      baseIntervalMs: 4000,
      intervalMs: Math.min(60000, 4000 * backoffMult),
    };
  }

  if (hasMediumWindow) {
    return {
      mode: 'MEDIUM_IMPACT_WINDOW',
      baseIntervalMs: 15000,
      intervalMs: Math.min(120000, 15000 * backoffMult),
    };
  }

  return {
    mode: 'NORMAL',
    baseIntervalMs: 120000,
    intervalMs: Math.min(600000, 120000 * backoffMult),
  };
}

/**
 * Parses a formatted string like "0.3%", "194K", "-19.2B" into numeric value + scale + unit metadata
 */
function parseValueWithScale(str) {
  if (str === null || str === undefined || str === '') return null;
  const s = String(str).trim();
  if (!s || s.includes('|')) return null;
  const isPct = s.endsWith('%');
  const scaleMatch = s.match(/([KMBT])$/i);
  const scale = scaleMatch ? scaleMatch[1].toUpperCase() : '';
  const numMatch = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[0]);
  const raw = scale && SCALE_MULT[scale] ? num * SCALE_MULT[scale] : num;
  return { num, scale, isPct, raw };
}

/**
 * Normalizes a TradingView numeric value to match the target scale (e.g. B -> T or raw -> K)
 */
function getTvScaledNum(val, tvEvent, targetScale) {
  if (val === null || val === undefined) return null;
  const tvScale = (tvEvent.scale || '').toUpperCase();
  const tvMult = SCALE_MULT[tvScale] || 1;
  const targetMult = SCALE_MULT[targetScale] || 1;
  if (tvMult === targetMult) return val;
  return (val * tvMult) / targetMult;
}

/**
 * Formats a TradingView numeric value (actual / forecast / previous) to match ForexFactory's display style
 */
function formatTvValue(val, tvEvent, refStr) {
  if (val === null || val === undefined || val === '') return '';
  const parsedRef = parseValueWithScale(refStr);
  if (parsedRef) {
    const scaled = getTvScaledNum(val, tvEvent, parsedRef.scale);
    const rounded = Math.abs(scaled) >= 100 ? +scaled.toFixed(1) : +scaled.toFixed(2);
    const prefix = (String(refStr).trim().match(/^[^\d-]+/) || [''])[0];
    const suffix = (String(refStr).trim().match(/[^\d.]+$/) || [''])[0];
    return `${prefix}${rounded}${suffix}`;
  }
  const unit = tvEvent.unit || '';
  const scale = tvEvent.scale || '';
  const rounded = Math.abs(val) >= 100 ? +Number(val).toFixed(1) : +Number(val).toFixed(2);
  if (unit === '%') return `${rounded}%`;
  if (['$', '£', '€', '¥'].includes(unit)) return `${unit}${rounded}${scale}`;
  return `${rounded}${scale}${unit ? ' ' + unit : ''}`.trim();
}

/**
 * Compares actual vs forecast or previous and returns 'ABOVE' | 'BELOW' | 'INLINE' | null
 */
function compareActualToForecast(actualStr, forecastStr, previousStr) {
  const act = parseValueWithScale(actualStr);
  if (!act) return null;
  const ref = parseValueWithScale(forecastStr) || parseValueWithScale(previousStr);
  if (!ref) return null;
  if (act.isPct !== ref.isPct) return null;
  const diff = act.raw - ref.raw;
  if (Math.abs(diff) < 1e-9) return 'INLINE';
  return diff > 0 ? 'ABOVE' : 'BELOW';
}

function expandKeywords(title) {
  let t = String(title || '').toLowerCase();
  t = t.replace(/\bm\/m\b/g, 'mom mm');
  t = t.replace(/\by\/y\b/g, 'yoy yy');
  t = t.replace(/\bq\/q\b/g, 'qoq qq');
  t = t.replace(/\b3m\/3m\b/g, '3m/3m 3-month');
  t = t.replace(/\bunemployment claims\b/g, 'initial jobless claims clm');
  t = t.replace(/\bcrude oil inventories\b/g, 'eia crude oil stocks');
  t = t.replace(/\bprelim\b/g, 'preliminary prel');
  t = t.replace(/\bflash\b/g, 'flash prel');
  t = t.replace(/\bppi\b/g, 'ppi producer price corp goods');
  t = t.replace(/\bcpi\b/g, 'cpi inflation rate consumer price');
  t = t.replace(/\btrade balance\b/g, 'balance of trade trade balance');
  t = t.replace(/\b10-y\b/g, '10-year 10y');
  t = t.replace(/\b30-y\b/g, '30-year 30y');
  return t.replace(/[^a-z0-9/ -]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
}

/**
 * Matches a single ForexFactory event to its corresponding live TradingView event
 */
function findMatchingTvEvent(ffEvent, tvEvents) {
  if (!ffEvent || !Array.isArray(tvEvents) || tvEvents.length === 0) return null;
  if (ffEvent.impact === 'Holiday') return null;

  const fTime = new Date(ffEvent.date).getTime();
  const fPrev = parseValueWithScale(ffEvent.previous);
  const fFore = parseValueWithScale(ffEvent.forecast);
  const fUnit = fFore || fPrev;
  const fLower = String(ffEvent.title || '').toLowerCase();
  const isBondAuction = /bond auction/i.test(fLower);

  const candidates = tvEvents.filter((t) => {
    const sameCurr = t.currency === ffEvent.country;
    const timeDiff = Math.abs(new Date(t.date).getTime() - fTime);
    return sameCurr && timeDiff <= 60 * 60000;
  });

  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = -1;

  for (const c of candidates) {
    if (!isBondAuction && fUnit) {
      const cIsPct = c.unit === '%';
      if (fUnit.isPct !== cIsPct) continue;
    }

    const cText = `${c.title || ''} ${c.indicator || ''}`.toLowerCase();

    // Subject group guard
    let subjectConflict = false;
    for (const group of SUBJECT_GROUPS) {
      const fHas = group.some((g) => fLower.includes(g));
      const cHas = group.some((g) => cText.includes(g));
      if (fHas && !cHas) {
        subjectConflict = true;
        break;
      }
    }
    if (subjectConflict) continue;

    // Core vs non-Core guard
    const fIsCore = /\bcore\b/i.test(fLower);
    const cIsCore = /\b(core|ex\s*food)\b/i.test(cText);
    if (fIsCore !== cIsCore) continue;

    // Periodicity guard (YoY vs MoM vs QoQ)
    const fIsYoY = /\by\/y\b/i.test(fLower);
    const fIsMoM = /\bm\/m\b/i.test(fLower);
    const fIsQoQ = /\bq\/q\b/i.test(fLower);
    const cIsYoY = /\b(yoy|yy)\b/i.test(cText);
    const cIsMoM = /\b(mom|mm)\b/i.test(cText);
    const cIsQoQ = /\b(qoq|qq)\b/i.test(cText);
    if (
      (fIsYoY && (cIsMoM || cIsQoQ)) ||
      (fIsMoM && (cIsYoY || cIsQoQ)) ||
      (fIsQoQ && (cIsYoY || cIsMoM))
    ) {
      continue;
    }

    let score = 0;
    if (new Date(c.date).getTime() === fTime) score += 6;

    if (fFore && c.forecast !== null && c.forecast !== undefined) {
      const cForeScaled = getTvScaledNum(c.forecast, c, fFore.scale);
      if (Math.abs(fFore.num - cForeScaled) <= Math.max(0.15, Math.abs(fFore.num) * 0.1)) {
        score += 16;
      }
    }
    if (fPrev && c.previous !== null && c.previous !== undefined) {
      const cPrevScaled = getTvScaledNum(c.previous, c, fPrev.scale);
      if (Math.abs(fPrev.num - cPrevScaled) <= Math.max(0.15, Math.abs(fPrev.num) * 0.1)) {
        score += 16;
      }
    }

    const fWords = expandKeywords(ffEvent.title);
    let wordMatches = 0;
    for (const w of fWords) {
      if (cText.includes(w)) {
        score += 4;
        wordMatches++;
      }
    }
    if (wordMatches === 0) continue;

    if (c.actual !== null && c.actual !== undefined) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best && bestScore >= 9 ? best : null;
}

/**
 * Converts TradingView events directly into JAHZJOURNALS calendar format if primary FF schedule is rate-limited
 */
function buildEventsFromTvFallback(tvEvents) {
  if (!Array.isArray(tvEvents) || tvEvents.length === 0) return [];

  const noisyPattern = /(Allotted at High|Bid-to-Cover|Total Accepted|High Rate|Low Rate|Median Rate|Investment Rate|\bNSA\b|CPI-W|Seasonally Adjusted|Redbook|Export Inspections|Pork|Beef|Cotton|Soybean|Wheat|Corn|WASDE|Baker Hughes|CFTC|Machinery Manufacturing)/i;
  const highImpactTitlePattern = /\b(Core Inflation|Inflation Rate|CPI|Core PPI|PPI|Non Farm Payrolls|Non-Farm|Unemployment Rate|Initial Jobless Claims|Interest Rate Decision|Fed Interest Rate|ECB|BoE|BoJ|RBA|RBNZ|BoC|SNB|FOMC|GDP|Retail Sales|ISM Manufacturing|ISM Services)\b/i;

  return tvEvents
    .filter((e) => {
      if (e.importance === 1) return true;
      if (noisyPattern.test(e.title || '') || noisyPattern.test(e.indicator || '')) return false;
      return e.importance >= 0 || (e.forecast !== null && e.forecast !== undefined);
    })
    .map((e, index) => {
      const country = (e.currency || e.country || 'USD').toUpperCase();
      const title = e.title || e.indicator || 'Economic Event';
      let impact = 'Low';
      if (e.importance === 1 || highImpactTitlePattern.test(title)) {
        impact = 'High';
      } else if (e.importance === 0) {
        impact = 'Medium';
      }

      const actual = formatTvValue(e.actual, e, null);
      const forecast = formatTvValue(e.forecast, e, null);
      const previous = formatTvValue(e.previous, e, null);

      return {
        id: `${country}-${title}-${e.date || index}`.replace(/\s+/g, '-'),
        title,
        country,
        date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
        impact,
        actual,
        forecast,
        previous,
        actualVsForecast: compareActualToForecast(actual, forecast, previous),
      };
    });
}

/**
 * Extracts currencies impacted by a given trading symbol
 */
function getCurrenciesForPair(pair) {
  if (!pair) return [];
  const clean = String(pair).trim().toUpperCase();
  const cfg = getInstrumentConfig(clean);

  if (cfg) {
    const list = [];
    if (cfg.baseCurrency && cfg.baseCurrency.length === 3 && cfg.baseCurrency !== 'XAU' && cfg.baseCurrency !== 'XAG') {
      list.push(cfg.baseCurrency);
    }
    if (cfg.quoteCurrency && cfg.quoteCurrency.length === 3) {
      list.push(cfg.quoteCurrency);
    }
    if (cfg.baseCurrency === 'XAU' || cfg.baseCurrency === 'XAG') {
      list.push('USD');
    }
    if (list.length > 0) return [...new Set(list)];
  }

  if (clean.length === 6 && /^[A-Z]{6}$/.test(clean)) {
    return [clean.slice(0, 3), clean.slice(3, 6)];
  }

  if (['US30', 'NAS100', 'SPX500', 'DJ30', 'NDX', 'GOLD', 'DXY', 'OIL', 'WTI'].some((s) => clean.includes(s))) {
    return ['USD'];
  }
  if (['GER40', 'GER30', 'DAX', 'EUSTX50'].some((s) => clean.includes(s))) {
    return ['EUR'];
  }
  if (['UK100', 'FTSE'].some((s) => clean.includes(s))) {
    return ['GBP'];
  }
  if (['JPN225', 'NIKKEI'].some((s) => clean.includes(s))) {
    return ['JPY'];
  }

  return [];
}

/**
 * Enriches normalized event objects with category, observation timestamps, revision status, and release state
 */
function enrichEventMetadata(ev, nowMs = Date.now(), isLiveUpdate = false) {
  const category = classifyEventCategory(ev.title, ev.impact);
  const observation = defaultObservationStore.observe(ev, nowMs, { isLiveUpdate });
  const enriched = {
    ...ev,
    category,
    receivedAt: ev.receivedAt || observation.receivedAt || null,
    isRevised: Boolean(ev.isRevised || observation.isRevised),
    previousActual: ev.previousActual || observation.previousActual || null,
  };
  enriched.releaseState = computeEventReleaseState(enriched, nowMs);
  return enriched;
}

/**
 * Fetches events via provider interface + enriches with live actuals, categories, and release state
 */
async function fetchCalendarEvents(forceRefresh = false, options = {}) {
  const now = Date.now();
  const scheduleProvider = options.scheduleProvider || defaultScheduleProvider;
  const actualsProvider = options.actualsProvider || defaultActualsProvider;

  // Detect active release window (-30s to +5m without actual) to automatically bypass normal 60s TV TTL
  const hasReleasingEventWithoutActual = cachedMergedEvents.some((ev) => {
    if (ev.actual || ev.impact === 'Holiday') return false;
    const diffMs = now - new Date(ev.date).getTime();
    return diffMs >= -30 * 1000 && diffMs <= 5 * 60 * 1000;
  });

  const [scheduleRes, actualsRes] = await Promise.all([
    scheduleProvider.fetch({ force: forceRefresh, nowMs: now }),
    actualsProvider.fetch({
      force: forceRefresh,
      bypassNormalTtl: hasReleasingEventWithoutActual,
      nowMs: now,
    }),
  ]);

  const baseEvents = scheduleRes?.data || [];
  const tvEvents = actualsRes?.data || [];
  const hadPriorCache = cachedMergedEvents.length > 0;

  if (baseEvents.length > 0) {
    cachedMergedEvents = baseEvents.map((ev) => {
      const matchedTv = findMatchingTvEvent(ev, tvEvents);
      const refStr = ev.forecast || ev.previous;
      const actual =
        ev.actual ||
        (matchedTv && matchedTv.actual !== null && matchedTv.actual !== undefined
          ? formatTvValue(matchedTv.actual, matchedTv, refStr)
          : '');
      const forecast =
        ev.forecast ||
        (matchedTv && matchedTv.forecast !== null && matchedTv.forecast !== undefined
          ? formatTvValue(matchedTv.forecast, matchedTv, ev.previous)
          : '');
      const previous =
        ev.previous ||
        (matchedTv && matchedTv.previous !== null && matchedTv.previous !== undefined
          ? formatTvValue(matchedTv.previous, matchedTv, ev.forecast)
          : '');

      return enrichEventMetadata(
        {
          ...ev,
          actual,
          forecast,
          previous,
          actualVsForecast: compareActualToForecast(actual, forecast, previous),
        },
        now,
        hadPriorCache
      );
    });
    lastMergedAt = now;
    return cachedMergedEvents;
  }

  const tvFallback = buildEventsFromTvFallback(tvEvents);
  if (tvFallback.length > 0) {
    cachedMergedEvents = tvFallback.map((ev) => enrichEventMetadata(ev, now, hadPriorCache));
    lastMergedAt = now;
    return cachedMergedEvents;
  }

  if (cachedMergedEvents.length > 0) {
    // Recompute release states dynamically against current nowMs
    return cachedMergedEvents.map((ev) => ({
      ...ev,
      releaseState: computeEventReleaseState(ev, now),
    }));
  }

  cachedMergedEvents = FALLBACK_EVENTS.map((item, index) =>
    enrichEventMetadata(
      {
        id: `fallback-${index}-${item.country}`,
        ...item,
        actualVsForecast: null,
      },
      now,
      false
    )
  );
  lastMergedAt = now;
  return cachedMergedEvents;
}

/**
 * Filters calendar events based on client query (with IANA timezone support and category filtering)
 */
async function getEvents(query = {}) {
  const allEvents = await fetchCalendarEvents(query.force === 'true');
  const nowMs = Date.now();
  const timeZone = isValidTimeZone(query.timezone) ? query.timezone : 'UTC';

  // Ensure releaseState is evaluated against current timestamp
  let filtered = allEvents.map((ev) => ({
    ...ev,
    category: ev.category || classifyEventCategory(ev.title, ev.impact),
    releaseState: computeEventReleaseState(ev, nowMs),
  }));

  // Filter by impact (e.g. 'High', 'Medium', 'Low', 'Holiday' or comma-separated)
  if (query.impact && query.impact !== 'ALL') {
    const impacts = String(query.impact).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (impacts.length > 0) {
      filtered = filtered.filter((ev) => impacts.includes(String(ev.impact).toLowerCase()));
    }
  }

  // Filter by country / currency (e.g. 'USD,EUR,GBP')
  if (query.currency && query.currency !== 'ALL') {
    const currencies = String(query.currency).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (currencies.length > 0) {
      filtered = filtered.filter((ev) => currencies.includes(ev.country));
    }
  }

  // Filter by category (e.g. 'INFLATION,EMPLOYMENT')
  if (query.category && query.category !== 'ALL') {
    const cats = String(query.category).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (cats.length > 0) {
      filtered = filtered.filter((ev) => cats.includes(ev.category));
    }
  }

  // Filter out completed releases if showCompleted === 'false'
  if (query.showCompleted === 'false') {
    filtered = filtered.filter((ev) => !ev.releaseState?.isReleased);
  }

  // Search keyword in title or country
  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = filtered.filter((ev) =>
      ev.title.toLowerCase().includes(q) || ev.country.toLowerCase().includes(q)
    );
  }

  // Timezone-aware Range filter
  if (query.range === 'today') {
    const todayKey = getDatePartsInTimeZone(nowMs, timeZone).key;
    filtered = filtered.filter((ev) => getDatePartsInTimeZone(ev.date, timeZone).key === todayKey);
  } else if (query.range === 'tomorrow') {
    const todayKey = getDatePartsInTimeZone(nowMs, timeZone).key;
    const tomorrowKey = addDaysToDateKey(todayKey, 1);
    filtered = filtered.filter((ev) => getDatePartsInTimeZone(ev.date, timeZone).key === tomorrowKey);
  } else if (query.range === 'upcoming') {
    filtered = filtered.filter((ev) => new Date(ev.date).getTime() >= nowMs || ev.releaseState?.isAwaiting);
  }

  // Sort chronologically
  filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return filtered;
}

/**
 * Returns upcoming High / Medium impact events in the next X minutes
 */
async function getUpcomingHighImpactEvents(windowMinutes = 240) {
  const allEvents = await fetchCalendarEvents();
  const now = Date.now();
  const windowEnd = now + windowMinutes * 60 * 1000;
  const recentPast = now - 15 * 60 * 1000;

  const upcoming = allEvents
    .filter((ev) => {
      const time = new Date(ev.date).getTime();
      const isHighOrMed = ev.impact === 'High' || ev.impact === 'Medium';
      return isHighOrMed && time >= recentPast && time <= windowEnd;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((ev) => {
      const diffMs = new Date(ev.date).getTime() - now;
      const diffMins = Math.floor(diffMs / (60 * 1000));
      let countdown = '';
      if (diffMs <= 0) {
        if (ev.actual) {
          countdown = `Actual: ${ev.actual}`;
        } else if (diffMs >= -15 * 60 * 1000) {
          countdown = 'Awaiting release';
        } else {
          countdown = 'Released';
        }
      } else if (diffMins < 1) {
        const secs = Math.max(1, Math.ceil(diffMs / 1000));
        countdown = `in ${secs}s`;
      } else if (diffMins < 60) {
        countdown = `in ${diffMins}m`;
      } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        countdown = `in ${hours}h ${mins}m`;
      }

      return {
        ...ev,
        countdown,
        diffMinutes: diffMins,
      };
    });

  return upcoming;
}

/**
 * Checks if a trade time/pair correlates with a High-Impact news release
 */
async function correlateTradeWithNews(tradeTime, pair, windowMinutes = 15) {
  if (!tradeTime || !pair) {
    return { isNewsTrade: false, event: null };
  }

  const currencies = getCurrenciesForPair(pair);
  if (currencies.length === 0) {
    return { isNewsTrade: false, event: null };
  }

  const allEvents = await fetchCalendarEvents();
  const targetTime = new Date(tradeTime).getTime();
  const windowMs = windowMinutes * 60 * 1000;

  const matched = allEvents.find((ev) => {
    if (ev.impact !== 'High') return false;
    if (!currencies.includes(ev.country)) return false;
    const evTime = new Date(ev.date).getTime();
    return Math.abs(evTime - targetTime) <= windowMs;
  });

  if (matched) {
    const diffMins = Math.round(Math.abs(new Date(matched.date).getTime() - targetTime) / 60000);
    return {
      isNewsTrade: true,
      event: matched,
      warning: `High-impact ${matched.country} release (${matched.title}) occurred within ${diffMins}m of execution.`,
    };
  }

  return { isNewsTrade: false, event: null };
}

function getLastFetchedAt() {
  return lastMergedAt || Date.now();
}

function getProviderHealth() {
  return {
    schedule: defaultScheduleProvider.getHealth(),
    actuals: defaultActualsProvider.getHealth(),
  };
}

module.exports = {
  EVENT_CATEGORIES,
  classifyEventCategory,
  computeEventReleaseState,
  computeAdaptivePollPlan,
  isValidTimeZone,
  getDatePartsInTimeZone,
  addDaysToDateKey,
  fetchCalendarEvents,
  getEvents,
  getUpcomingHighImpactEvents,
  correlateTradeWithNews,
  getCurrenciesForPair,
  getLastFetchedAt,
  getProviderHealth,
};
