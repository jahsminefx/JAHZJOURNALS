const fxRateProvider = require('./fxRateProvider');

const CACHE_TTL_MS = (Number(process.env.FX_RATE_CACHE_TTL_SECONDS) || 300) * 1000;
const REPORTING_CURRENCY = 'USD';
const SUPPORTED_CURRENCIES = fxRateProvider.SUPPORTED_CURRENCIES;

// In-memory FX Cache store
const fxCache = new Map();
let pendingFetchPromise = null;

/**
 * Calculates human-readable time ago string
 */
function getTimeAgo(date) {
  if (!date) return 'unknown';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Normalizes ISO currency code string
 */
function normalizeCurrency(currency) {
  if (!currency) return 'USD';
  const code = String(currency).trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : 'USD';
}

/**
 * Retrieves latest FX rate table using LIVE -> CACHED -> UNAVAILABLE hierarchy
 * Features request deduplication for concurrent API requests.
 */
async function getRateTable() {
  const cacheKey = 'USD_RATES';
  const cached = fxCache.get(cacheKey);
  const now = Date.now();

  // Return fresh cached rate immediately if unexpired
  if (cached && cached.expiresAt && now < new Date(cached.expiresAt).getTime()) {
    return cached;
  }

  // Deduplicate in-flight fetch requests
  if (pendingFetchPromise) {
    return pendingFetchPromise;
  }

  pendingFetchPromise = (async () => {
    try {
      const liveResult = await fxRateProvider.fetchLiveRates('USD');
      if (liveResult && liveResult.success && liveResult.rates) {
        const fetchedAt = liveResult.fetchedAt || new Date();
        const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);
        const cacheEntry = {
          rates: liveResult.rates,
          fetchedAt,
          expiresAt,
          source: 'LIVE',
        };
        fxCache.set(cacheKey, cacheEntry);
        return cacheEntry;
      }
    } catch (err) {
      console.warn('[FX Service] Live FX rate fetch failed:', err.message);
    } finally {
      pendingFetchPromise = null;
    }

    // Fallback to cached rate even if expired
    if (cached && cached.rates) {
      return {
        ...cached,
        source: 'CACHED',
      };
    }

    // Return UNAVAILABLE if live & cached fail
    return {
      rates: null,
      fetchedAt: null,
      expiresAt: null,
      source: 'UNAVAILABLE',
    };
  })();

  return pendingFetchPromise;
}

/**
 * Calculates direct or triangulated exchange rate from fromCurrency to toCurrency
 * Returns { fromCurrency, toCurrency, rate, rawRate, source, fetchedAt, expiresAt, timeAgo, isStale, status }
 */
async function getExchangeRateDetails(fromCurrencyInput, toCurrencyInput) {
  const fromCurrency = normalizeCurrency(fromCurrencyInput);
  const toCurrency = normalizeCurrency(toCurrencyInput);

  if (fromCurrency === toCurrency) {
    const now = new Date();
    return {
      fromCurrency,
      toCurrency,
      rate: 1.0,
      rawRate: 1.0,
      source: 'SAME_CURRENCY',
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      timeAgo: '0s ago',
      isStale: false,
      status: 'OK',
    };
  }

  const table = await getRateTable();

  if (!table || !table.rates || table.source === 'UNAVAILABLE') {
    return {
      fromCurrency,
      toCurrency,
      rate: null,
      rawRate: null,
      source: 'UNAVAILABLE',
      fetchedAt: null,
      expiresAt: null,
      timeAgo: 'unavailable',
      isStale: true,
      status: 'UNAVAILABLE',
    };
  }

  const rates = table.rates;
  let rawRate = null;

  if (fromCurrency === 'USD' && rates[toCurrency]) {
    rawRate = rates[toCurrency];
  } else if (toCurrency === 'USD' && rates[fromCurrency]) {
    rawRate = 1.0 / rates[fromCurrency];
  } else if (rates[fromCurrency] && rates[toCurrency]) {
    // Triangulate: (USD -> toCurrency) / (USD -> fromCurrency)
    rawRate = rates[toCurrency] / rates[fromCurrency];
  }

  if (!rawRate || !Number.isFinite(rawRate) || rawRate <= 0) {
    return {
      fromCurrency,
      toCurrency,
      rate: null,
      rawRate: null,
      source: 'UNAVAILABLE',
      fetchedAt: table.fetchedAt,
      expiresAt: table.expiresAt,
      timeAgo: getTimeAgo(table.fetchedAt),
      isStale: true,
      status: 'UNAVAILABLE',
    };
  }

  const isStale = table.expiresAt ? Date.now() > new Date(table.expiresAt).getTime() : false;

  return {
    fromCurrency,
    toCurrency,
    rate: Number(rawRate.toFixed(6)),
    rawRate,
    source: table.source,
    fetchedAt: table.fetchedAt,
    expiresAt: table.expiresAt,
    timeAgo: getTimeAgo(table.fetchedAt),
    isStale,
    status: 'OK',
  };
}

/**
 * Returns numeric exchange rate between fromCurrency and toCurrency or null if unavailable
 */
async function getExchangeRate(fromCurrency, toCurrency) {
  const details = await getExchangeRateDetails(fromCurrency, toCurrency);
  return details.rate;
}

/**
 * Converts a monetary amount from fromCurrency to toCurrency
 * Returns { convertedAmount, rate, rateDetails }
 */
async function convertAmount(amount, fromCurrency, toCurrency) {
  const numAmount = Number(amount || 0);
  const details = await getExchangeRateDetails(fromCurrency, toCurrency);

  if (details.status === 'UNAVAILABLE' || details.rawRate === null) {
    return {
      convertedAmount: null,
      rate: null,
      rateDetails: details,
    };
  }

  const convertedAmount = Number((numAmount * details.rawRate).toFixed(2));
  return {
    convertedAmount,
    rate: details.rate,
    rateDetails: details,
  };
}

/**
 * Converts monetary amount to USD reporting currency
 */
async function convertToReportingCurrency(amount, fromCurrency) {
  return convertAmount(amount, fromCurrency, REPORTING_CURRENCY);
}

/**
 * Clears in-memory FX cache (for testing or manual force refresh)
 */
function clearFxCache() {
  fxCache.clear();
}

/**
 * Sets in-memory FX cache entry directly (for test setup)
 */
function _setFxCacheForTest(key, entry) {
  fxCache.set(key, entry);
}

/**
 * Returns list of supported currency ISO codes
 */
function getSupportedCurrencies() {
  return [...SUPPORTED_CURRENCIES];
}

module.exports = {
  SUPPORTED_CURRENCIES,
  REPORTING_CURRENCY,
  fxRateProvider,
  getExchangeRateDetails,
  getExchangeRate,
  convertAmount,
  convertToReportingCurrency,
  clearFxCache,
  _setFxCacheForTest,
  getSupportedCurrencies,
};
