/**
 * Calendar Data Provider Interface & Registry
 * Isolates upstream economic calendar feeds behind a standard interface with
 * in-flight request deduplication, rate-limit cooldowns, exponential backoff,
 * cancellation timeouts, and release observation tracking (receivedAt & revisions).
 */

const FF_SCHEDULE_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const TV_EVENTS_URL = 'https://economic-calendar.tradingview.com/events';

const DEFAULT_FF_TTL_MS = 20 * 60 * 1000; // 20 minutes
const DEFAULT_FF_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes minimum between FF requests (429 protection)

const DEFAULT_TV_TTL_MS = 60 * 1000; // 60 seconds normal cache
const DEFAULT_TV_COOLDOWN_MS = 4 * 1000; // 4 seconds minimum during active release window

function normalizeCanonicalKey(country, title, dateIso) {
  const curr = String(country || 'ALL').trim().toUpperCase();
  const cleanTitle = String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const minuteBucket = dateIso ? new Date(dateIso).toISOString().slice(0, 16) : '';
  return `${curr}|${cleanTitle}|${minuteBucket}`;
}

/**
 * Tracks when actual values arrive and whether an actual figure was revised after initial publication.
 */
class ReleaseObservationStore {
  constructor() {
    this.map = new Map();
  }

  /**
   * Records or updates observation state for a single event.
   * @param {Object} event - { country, title, date, actual }
   * @param {number} nowMs - Current timestamp
   * @param {Object} [options] - { isLiveUpdate?: boolean }
   * @returns {{ receivedAt: string|null, isRevised: boolean, previousActual: string|null }}
   */
  observe(event, nowMs = Date.now(), options = {}) {
    if (!event || !event.date) {
      return { receivedAt: null, isRevised: false, previousActual: null };
    }
    const key = normalizeCanonicalKey(event.country, event.title, event.date);
    const actualStr = event.actual ? String(event.actual).trim() : '';
    const existing = this.map.get(key);
    const scheduledMs = new Date(event.date).getTime();

    if (!existing) {
      let receivedAt = null;
      if (actualStr) {
        // Record receivedAt accurately if observed close to release time (<= 30m) or during live transition
        const withinLiveWindow = !Number.isNaN(scheduledMs) && nowMs >= scheduledMs - 60000 && nowMs - scheduledMs <= 30 * 60 * 1000;
        if (options.isLiveUpdate || withinLiveWindow) {
          receivedAt = new Date(nowMs).toISOString();
        }
      }
      const entry = {
        hadMissingActualInitially: !actualStr,
        firstObservedActual: actualStr || null,
        latestActual: actualStr || null,
        previousActual: null,
        receivedAt,
        isRevised: false,
        lastUpdatedAt: nowMs,
      };
      this.map.set(key, entry);
      return {
        receivedAt: entry.receivedAt,
        isRevised: false,
        previousActual: null,
      };
    }

    // Event was already seen
    if (actualStr && !existing.latestActual) {
      // Transitioned from missing -> published actual!
      existing.firstObservedActual = actualStr;
      existing.latestActual = actualStr;
      existing.receivedAt = new Date(nowMs).toISOString();
      existing.lastUpdatedAt = nowMs;
    } else if (actualStr && existing.latestActual && actualStr !== existing.latestActual) {
      // Actual figure changed after initial observation -> Revision detected
      existing.previousActual = existing.latestActual;
      existing.latestActual = actualStr;
      existing.isRevised = true;
      if (!existing.receivedAt) {
        existing.receivedAt = new Date(nowMs).toISOString();
      }
      existing.lastUpdatedAt = nowMs;
    }

    return {
      receivedAt: existing.receivedAt,
      isRevised: existing.isRevised,
      previousActual: existing.previousActual,
    };
  }

  get(country, title, dateIso) {
    return this.map.get(normalizeCanonicalKey(country, title, dateIso)) || null;
  }

  clear() {
    this.map.clear();
  }
}

/**
 * Reusable provider wrapper implementing:
 * - Rate-limit cooldown protection
 * - Cache TTL
 * - In-flight request deduplication
 * - Exponential backoff on errors / HTTP 429
 */
class ManagedFeedProvider {
  constructor({ name, ttlMs, minCooldownMs, maxBackoffMs = 10 * 60 * 1000, fetcher }) {
    this.name = name;
    this.ttlMs = ttlMs;
    this.minCooldownMs = minCooldownMs;
    this.maxBackoffMs = maxBackoffMs;
    this.fetcher = fetcher;

    this.cache = [];
    this.lastFetchedAt = 0;
    this.lastAttemptAt = 0;
    this.consecutiveErrors = 0;
    this.nextAllowedAttemptAt = 0;
    this.lastError = null;
    this.inflight = null;
  }

  getHealth(nowMs = Date.now()) {
    return {
      name: this.name,
      cachedCount: this.cache.length,
      lastFetchedAt: this.lastFetchedAt ? new Date(this.lastFetchedAt).toISOString() : null,
      consecutiveErrors: this.consecutiveErrors,
      inCooldown: nowMs < this.nextAllowedAttemptAt,
      nextAllowedAttemptAt: this.nextAllowedAttemptAt ? new Date(this.nextAllowedAttemptAt).toISOString() : null,
      lastError: this.lastError,
    };
  }

  async fetch({ force = false, bypassNormalTtl = false, nowMs = Date.now(), fetchImpl = globalThis.fetch } = {}) {
    // Deduplicate concurrent identical requests before checking cooldowns
    if (this.inflight) {
      const result = await this.inflight;
      return { ...result, deduped: true };
    }

    const effectiveInterval = force || bypassNormalTtl ? this.minCooldownMs : this.ttlMs;

    // Respect cache TTL and minimum cooldown
    if (this.cache.length > 0 && nowMs - this.lastFetchedAt < effectiveInterval) {
      return { data: this.cache, fromCache: true, deduped: false };
    }

    // Respect backoff or retry cooldown after failures/attempts
    const earliestRetry = Math.max(this.nextAllowedAttemptAt, this.lastAttemptAt + this.minCooldownMs);
    if (nowMs < earliestRetry) {
      return { data: this.cache, fromCache: true, rateLimited: true, deduped: false };
    }

    this.lastAttemptAt = nowMs;

    this.inflight = (async () => {
      try {
        const items = await this.fetcher({ nowMs, fetchImpl });
        if (Array.isArray(items) && items.length > 0) {
          this.cache = items;
          this.lastFetchedAt = nowMs;
        }
        this.consecutiveErrors = 0;
        this.nextAllowedAttemptAt = 0;
        this.lastError = null;
        return { data: this.cache, fromCache: false, error: null };
      } catch (err) {
        this.consecutiveErrors += 1;
        this.lastError = err?.message || 'Unknown provider error';
        const is429 = err?.status === 429 || /429|rate limit/i.test(this.lastError);
        const baseWait = is429 ? Math.max(this.minCooldownMs, 60000) : Math.max(this.minCooldownMs, 5000);
        const backoff = Math.min(this.maxBackoffMs, baseWait * Math.pow(2, Math.min(5, this.consecutiveErrors - 1)));
        this.nextAllowedAttemptAt = nowMs + backoff;
        return { data: this.cache, fromCache: true, error: this.lastError };
      } finally {
        this.inflight = null;
      }
    })();

    return await this.inflight;
  }

  reset() {
    this.cache = [];
    this.lastFetchedAt = 0;
    this.lastAttemptAt = 0;
    this.consecutiveErrors = 0;
    this.nextAllowedAttemptAt = 0;
    this.lastError = null;
    this.inflight = null;
  }
}

function createForexFactoryProvider() {
  return new ManagedFeedProvider({
    name: 'forexfactory-schedule',
    ttlMs: DEFAULT_FF_TTL_MS,
    minCooldownMs: DEFAULT_FF_COOLDOWN_MS,
    maxBackoffMs: 30 * 60 * 1000,
    fetcher: async ({ fetchImpl }) => {
      const res = await fetchImpl(FF_SCHEDULE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JAHZJOURNALS/1.0' },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined,
      });

      if (res.status === 429) {
        const err = new Error('ForexFactory upstream rate limit (429)');
        err.status = 429;
        throw err;
      }

      if (!res.ok) {
        const err = new Error(`ForexFactory HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      const text = await res.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data.map((item, index) => ({
        id: `${item.country || 'GLOBAL'}-${item.title || 'event'}-${item.date || index}`.replace(/\s+/g, '-'),
        title: item.title || 'Economic Event',
        country: (item.country || 'ALL').toUpperCase(),
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        impact: item.impact || 'Low',
        actual: item.actual || '',
        forecast: item.forecast || '',
        previous: item.previous || '',
        isTentative: /tentative/i.test(String(item.time || item.title || '')),
        provider: 'forexfactory',
      }));
    },
  });
}

function createTradingViewProvider() {
  return new ManagedFeedProvider({
    name: 'tradingview-actuals',
    ttlMs: DEFAULT_TV_TTL_MS,
    minCooldownMs: DEFAULT_TV_COOLDOWN_MS,
    maxBackoffMs: 5 * 60 * 1000,
    fetcher: async ({ nowMs, fetchImpl }) => {
      const d = new Date(nowMs);
      const dayOfWeek = d.getUTCDay();
      const startOfWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek - 1, 0, 0, 0));
      const endOfWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (8 - dayOfWeek), 23, 59, 59));
      const countries = 'US,EU,GB,JP,AU,CA,CH,NZ,CN,DE,FR,IT,ES,ZA,NG';
      const url = `${TV_EVENTS_URL}?from=${encodeURIComponent(startOfWeek.toISOString())}&to=${encodeURIComponent(endOfWeek.toISOString())}&countries=${countries}`;

      const res = await fetchImpl(url, {
        headers: {
          Origin: 'https://www.tradingview.com',
          Referer: 'https://www.tradingview.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined,
      });

      if (res.status === 429) {
        const err = new Error('TradingView upstream rate limit (429)');
        err.status = 429;
        throw err;
      }

      if (!res.ok) {
        const err = new Error(`TradingView HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      const json = await res.json();
      return Array.isArray(json.result) ? json.result : [];
    },
  });
}

const defaultScheduleProvider = createForexFactoryProvider();
const defaultActualsProvider = createTradingViewProvider();
const defaultObservationStore = new ReleaseObservationStore();

module.exports = {
  ManagedFeedProvider,
  ReleaseObservationStore,
  createForexFactoryProvider,
  createTradingViewProvider,
  defaultScheduleProvider,
  defaultActualsProvider,
  defaultObservationStore,
  normalizeCanonicalKey,
};
