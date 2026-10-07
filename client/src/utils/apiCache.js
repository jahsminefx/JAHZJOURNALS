import api from './api';

/**
 * High-Performance In-Memory Client Cache & Stale-While-Revalidate Engine
 * Ensures 0ms page transitions between Dashboard, Trades, Analytics, and Accounts
 * without flashing skeletons or losing state during screenshot captures.
 */

const cacheStore = new Map();

const DEFAULT_STALE_TIME = 60 * 1000; // 60 seconds (fresh)
const DEFAULT_MAX_AGE = 10 * 60 * 1000; // 10 minutes (retained in memory)

/**
 * Generate a deterministic string key for an endpoint and its query parameters
 */
export const createCacheKey = (endpoint, params = {}) => {
  if (!params || Object.keys(params).length === 0) {
    return endpoint;
  }
  const cleanParams = { ...params };
  delete cleanParams._refresh;
  delete cleanParams._t;

  const sortedKeys = Object.keys(cleanParams).sort();
  const queryString = sortedKeys
    .filter((k) => cleanParams[k] !== undefined && cleanParams[k] !== null && cleanParams[k] !== '')
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(cleanParams[k])}`)
    .join('&');

  return queryString ? `${endpoint}?${queryString}` : endpoint;
};

/**
 * Get cached response if present
 */
export const getCachedData = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return {
    data: entry.data,
    isStale: now > entry.staleAt,
    timestamp: entry.timestamp,
  };
};

/**
 * Set cached response
 */
export const setCachedData = (key, data, { staleTime = DEFAULT_STALE_TIME, maxAge = DEFAULT_MAX_AGE } = {}) => {
  const now = Date.now();
  cacheStore.set(key, {
    data,
    timestamp: now,
    staleAt: now + staleTime,
    expiresAt: now + maxAge,
  });
};

/**
 * Invalidate cache keys matching string or regex
 */
export const invalidateCache = (pattern) => {
  if (!pattern) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (typeof pattern === 'string') {
      if (key.includes(pattern)) cacheStore.delete(key);
    } else if (pattern instanceof RegExp) {
      if (pattern.test(key)) cacheStore.delete(key);
    }
  }
};

/**
 * Fetch with Stale-While-Revalidate pattern
 * Returns cached data immediately if available, then updates in background if stale.
 */
export const fetchWithCache = async (endpoint, config = {}, options = {}) => {
  const {
    staleTime = DEFAULT_STALE_TIME,
    forceRefresh = false,
    onBackgroundUpdate = null,
  } = options;

  const key = createCacheKey(endpoint, config.params);
  const cached = getCachedData(key);

  // If forceRefresh is requested or no cached data, perform immediate network fetch
  if (forceRefresh || !cached) {
    const response = await api.get(endpoint, config);
    setCachedData(key, response.data, { staleTime });
    return { data: response.data, fromCache: false, isStale: false };
  }

  // If we have cached data and it's stale, trigger background revalidation
  if (cached.isStale && typeof onBackgroundUpdate === 'function') {
    // Background fetch without blocking the UI
    api.get(endpoint, config)
      .then((res) => {
        setCachedData(key, res.data, { staleTime });
        onBackgroundUpdate(res.data);
      })
      .catch((err) => {
        // Silent failure in background - existing cached UI remains intact
        console.debug('[Cache SWR Background Update Error]:', err?.message);
      });
  }

  return {
    data: cached.data,
    fromCache: true,
    isStale: cached.isStale,
  };
};

// Listen to data-changed events from mutations to auto-invalidate stale caches
if (typeof window !== 'undefined') {
  window.addEventListener('jahzjournal:data-changed', (event) => {
    // Clear trade, account, and analytics caches on data changes
    invalidateCache('/analytics');
    invalidateCache('/trades');
    invalidateCache('/accounts');
    invalidateCache('/emotions');
    invalidateCache('/rules');
  });
}

export default {
  createCacheKey,
  getCachedData,
  setCachedData,
  invalidateCache,
  fetchWithCache,
};
