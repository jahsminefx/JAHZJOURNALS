const { getInstrumentConfig } = require('./instrumentService');

// In-memory caches for economic schedule + live actuals feed
let cachedBaseEvents = [];
let lastBaseFetchedAt = 0;
let lastBaseAttemptAt = 0;
const BASE_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes for weekly schedule
const BASE_RETRY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes minimum between FF requests to avoid 429 rate-limit

let cachedTvEvents = [];
let lastTvFetchedAt = 0;
const TV_CACHE_TTL_MS = 60 * 1000; // 60 seconds for live actuals
const TV_FORCE_COOLDOWN_MS = 10 * 1000; // 10 seconds minimum on manual force-sync

let cachedMergedEvents = [];
let lastMergedAt = 0;

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

    // Prefer candidates that already have an actual value populated
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
 * Fetches live economic events (including real-time actuals) from TradingView Economic Calendar API
 */
async function fetchLiveTvEvents(forceRefresh = false) {
  const now = Date.now();
  const minInterval = forceRefresh ? TV_FORCE_COOLDOWN_MS : TV_CACHE_TTL_MS;
  if (cachedTvEvents.length > 0 && now - lastTvFetchedAt < minInterval) {
    return cachedTvEvents;
  }

  try {
    const d = new Date(now);
    const dayOfWeek = d.getUTCDay();
    const startOfWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek - 1, 0, 0, 0));
    const endOfWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (8 - dayOfWeek), 23, 59, 59));
    const countries = 'US,EU,GB,JP,AU,CA,CH,NZ,CN,DE,FR,IT,ES,ZA,NG';
    const url = `https://economic-calendar.tradingview.com/events?from=${encodeURIComponent(startOfWeek.toISOString())}&to=${encodeURIComponent(endOfWeek.toISOString())}&countries=${countries}`;

    const res = await fetch(url, {
      headers: {
        Origin: 'https://www.tradingview.com',
        Referer: 'https://www.tradingview.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.result) && json.result.length > 0) {
        cachedTvEvents = json.result;
        lastTvFetchedAt = now;
        return cachedTvEvents;
      }
    }
  } catch (err) {
    console.warn('[CalendarService] Live actuals feed fetch warning:', err.message);
  }

  return cachedTvEvents;
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
      list.push('USD'); // Gold/Silver are USD driven
    }
    if (list.length > 0) return [...new Set(list)];
  }

  // 6-character FX pair fallback (e.g. EURUSD, GBPJPY)
  if (clean.length === 6 && /^[A-Z]{6}$/.test(clean)) {
    return [clean.slice(0, 3), clean.slice(3, 6)];
  }

  // Indices / Commodities
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
 * Fetches events from ForexFactory schedule + enriches with real-time actuals from TradingView
 */
async function fetchCalendarEvents(forceRefresh = false) {
  const now = Date.now();

  // Check if any cached event just crossed its release time in the last 10 minutes without an actual value
  const hasReleasingEventWithoutActual = cachedMergedEvents.some((ev) => {
    if (ev.actual || ev.impact === 'Holiday') return false;
    const diffMs = now - new Date(ev.date).getTime();
    return diffMs >= -15 * 1000 && diffMs <= 10 * 60 * 1000;
  });

  const needBaseRefresh =
    (cachedBaseEvents.length === 0 && now - lastBaseAttemptAt >= BASE_RETRY_COOLDOWN_MS) ||
    now - lastBaseFetchedAt >= BASE_CACHE_TTL_MS ||
    (forceRefresh && now - lastBaseAttemptAt >= BASE_RETRY_COOLDOWN_MS);

  const needTvRefresh =
    forceRefresh ||
    hasReleasingEventWithoutActual ||
    cachedTvEvents.length === 0 ||
    now - lastTvFetchedAt >= TV_CACHE_TTL_MS;

  if (!needBaseRefresh && !needTvRefresh && cachedMergedEvents.length > 0) {
    return cachedMergedEvents;
  }

  // 1. Refresh base weekly schedule if needed (respecting rate-limit cooldown)
  if (needBaseRefresh) {
    lastBaseAttemptAt = now;
    try {
      const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JAHZJOURNALS/1.0' },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          cachedBaseEvents = data.map((item, index) => ({
            id: `${item.country || 'GLOBAL'}-${item.title || 'event'}-${item.date || index}`.replace(/\s+/g, '-'),
            title: item.title || 'Economic Event',
            country: (item.country || 'ALL').toUpperCase(),
            date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
            impact: item.impact || 'Low', // 'High' | 'Medium' | 'Low' | 'Holiday'
            actual: item.actual || '',
            forecast: item.forecast || '',
            previous: item.previous || '',
          }));
          lastBaseFetchedAt = now;
        }
      }
    } catch (err) {
      console.warn('[CalendarService] Base schedule fetch warning, using cached/live fallback:', err.message);
    }
  }

  // 2. Refresh live actuals feed
  const tvEvents = await fetchLiveTvEvents(forceRefresh || hasReleasingEventWithoutActual);

  // 3. Merge base schedule with live actuals
  if (cachedBaseEvents.length > 0) {
    cachedMergedEvents = cachedBaseEvents.map((ev) => {
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

      return {
        ...ev,
        actual,
        forecast,
        previous,
        actualVsForecast: compareActualToForecast(actual, forecast, previous),
      };
    });
    lastMergedAt = now;
    return cachedMergedEvents;
  }

  // 4. If base FF schedule was rate-limited, use live TradingView events directly
  const tvFallback = buildEventsFromTvFallback(tvEvents);
  if (tvFallback.length > 0) {
    cachedMergedEvents = tvFallback;
    lastMergedAt = now;
    return cachedMergedEvents;
  }

  if (cachedMergedEvents.length > 0) {
    return cachedMergedEvents;
  }

  // 5. Offline fallback
  cachedMergedEvents = FALLBACK_EVENTS.map((item, index) => ({
    id: `fallback-${index}-${item.country}`,
    ...item,
    actualVsForecast: null,
  }));
  lastMergedAt = now;
  return cachedMergedEvents;
}

/**
 * Filters calendar events based on client query
 */
async function getEvents(query = {}) {
  const allEvents = await fetchCalendarEvents(query.force === 'true');
  let filtered = [...allEvents];

  // Filter by impact (e.g. 'High', 'Medium', 'Low', 'Holiday' or comma-separated)
  if (query.impact && query.impact !== 'ALL') {
    const impacts = query.impact.split(',').map((s) => s.trim().toLowerCase());
    filtered = filtered.filter((ev) => impacts.includes(String(ev.impact).toLowerCase()));
  }

  // Filter by country / currency (e.g. 'USD,EUR,GBP')
  if (query.currency && query.currency !== 'ALL') {
    const currencies = query.currency.split(',').map((s) => s.trim().toUpperCase());
    filtered = filtered.filter((ev) => currencies.includes(ev.country));
  }

  // Search keyword in title
  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = filtered.filter((ev) =>
      ev.title.toLowerCase().includes(q) || ev.country.toLowerCase().includes(q)
    );
  }

  // Range filter
  const now = new Date();
  if (query.range === 'today') {
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    filtered = filtered.filter((ev) => {
      const d = new Date(ev.date);
      return d >= startOfDay && d <= endOfDay;
    });
  } else if (query.range === 'tomorrow') {
    const startOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const endOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59, 999));
    filtered = filtered.filter((ev) => {
      const d = new Date(ev.date);
      return d >= startOfTomorrow && d <= endOfTomorrow;
    });
  } else if (query.range === 'upcoming') {
    filtered = filtered.filter((ev) => new Date(ev.date) >= now);
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
  const recentPast = now - 15 * 60 * 1000; // Include events that started in the last 15 minutes

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
        } else if (diffMs >= -3 * 60 * 1000) {
          countdown = 'Releasing now';
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
  return lastMergedAt || lastBaseFetchedAt || lastTvFetchedAt;
}

module.exports = {
  fetchCalendarEvents,
  getEvents,
  getUpcomingHighImpactEvents,
  correlateTradeWithNews,
  getCurrenciesForPair,
  getLastFetchedAt,
};
