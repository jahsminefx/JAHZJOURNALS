const { getInstrumentConfig } = require('./instrumentService');

// In-memory cache for economic events
let cachedEvents = [];
let lastFetchedAt = 0;
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

const FALLBACK_EVENTS = [
  {
    title: 'Non-Farm Employment Change (NFP)',
    country: 'USD',
    date: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    impact: 'High',
    forecast: '175K',
    previous: '254K',
  },
  {
    title: 'Unemployment Rate',
    country: 'USD',
    date: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
    impact: 'High',
    forecast: '4.1%',
    previous: '4.1%',
  },
  {
    title: 'CPI m/m',
    country: 'USD',
    date: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
    impact: 'High',
    forecast: '0.3%',
    previous: '0.2%',
  },
  {
    title: 'ECB Monetary Policy Statement',
    country: 'EUR',
    date: new Date(Date.now() + 3600 * 1000 * 28).toISOString(),
    impact: 'High',
    forecast: '3.25%',
    previous: '3.50%',
  },
  {
    title: 'BoE Official Bank Rate',
    country: 'GBP',
    date: new Date(Date.now() + 3600 * 1000 * 48).toISOString(),
    impact: 'High',
    forecast: '4.75%',
    previous: '5.00%',
  },
  {
    title: 'Cash Rate',
    country: 'AUD',
    date: new Date(Date.now() + 3600 * 1000 * 6).toISOString(),
    impact: 'High',
    forecast: '4.35%',
    previous: '4.35%',
  },
];

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
 * Fetches events from ForexFactory feed or cache
 */
async function fetchCalendarEvents(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedEvents.length > 0 && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedEvents;
  }

  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'JAHZJOURNALS-News-Engine/1.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch economic calendar: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      cachedEvents = data.map((item, index) => ({
        id: `${item.country || 'GLOBAL'}-${item.title || 'event'}-${item.date || index}`.replace(/\s+/g, '-'),
        title: item.title || 'Economic Event',
        country: (item.country || 'ALL').toUpperCase(),
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        impact: item.impact || 'Low', // 'High' | 'Medium' | 'Low' | 'Holiday'
        forecast: item.forecast || '',
        previous: item.previous || '',
      }));
      lastFetchedAt = now;
      return cachedEvents;
    }
  } catch (err) {
    console.warn('[CalendarService] Remote calendar fetch failed, falling back to cached or default data:', err.message);
  }

  if (cachedEvents.length > 0) {
    return cachedEvents;
  }

  // Use fallback events if first fetch fails or in offline/testing mode
  cachedEvents = FALLBACK_EVENTS.map((item, index) => ({
    id: `fallback-${index}-${item.country}`,
    ...item,
  }));
  lastFetchedAt = now;
  return cachedEvents;
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
      const diffMins = Math.round(diffMs / (60 * 1000));
      let countdown = '';
      if (diffMins < 0 && diffMins >= -15) {
        countdown = 'Released just now';
      } else if (diffMins === 0) {
        countdown = 'Releasing now';
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
  return lastFetchedAt;
}

module.exports = {
  fetchCalendarEvents,
  getEvents,
  getUpcomingHighImpactEvents,
  correlateTradeWithNews,
  getCurrenciesForPair,
  getLastFetchedAt,
};
