const crypto = require('crypto');
const { getInstrumentConfig } = require('./instrumentService');
const { classifyEventCategory } = require('./calendarService');

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

function getCorrelatedCurrencies(currencies = []) {
  const result = new Set();
  for (const c of currencies) {
    const clean = cleanCurrencyString(c);
    if (!clean) continue;
    result.add(clean);
    const correlated = CORRELATED_CURRENCY_MAP[clean] || [];
    for (const corr of correlated) {
      result.add(corr);
    }
  }
  return [...result];
}

const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'NZD',
  'CAD',
  'CHF',
  'NGN',
  'CNY',
  'ZAR',
];

const SUPPORTED_FOREX_PAIRS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'NZDUSD',
  'USDCAD',
  'USDCHF',
  'EURJPY',
  'GBPJPY',
  'EURGBP',
  'AUDJPY',
  'CADJPY',
  'CHFJPY',
  'EURAUD',
  'EURCAD',
  'GBPAUD',
  'GBPCAD',
  'AUDCAD',
  'NZDJPY',
  'XAUUSD',
  'US30',
  'NAS100',
  'SPX500',
  'GER40',
];

const TARGETING_MODES = {
  CURRENCIES_ONLY: 'CURRENCIES_ONLY',
  PAIRS_ONLY: 'PAIRS_ONLY',
  CURRENCIES_AND_PAIRS: 'CURRENCIES_AND_PAIRS',
};

const KNOWN_INDICES_COMMODITIES = {
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
 * Normalizes an instrument or pair string by removing delimiters and whitespace
 */
function cleanPairString(pair) {
  if (!pair || typeof pair !== 'string') return '';
  return pair.replace(/[\/\-_.\s]/g, '').trim().toUpperCase();
}

/**
 * Normalizes a currency code
 */
function cleanCurrencyString(curr) {
  if (!curr || typeof curr !== 'string') return '';
  return curr.trim().toUpperCase();
}

/**
 * Extracts individual currencies relevant to an instrument
 * @param {string} pair - e.g. "EURUSD", "EUR/USD", "GBPJPY", "XAUUSD", "US30"
 * @returns {string[]} Array of 3-letter currency codes e.g. ["EUR", "USD"]
 */
function parseCurrenciesFromPair(pair) {
  const clean = cleanPairString(pair);
  if (!clean) return [];

  // 1. Direct index/commodity match
  if (KNOWN_INDICES_COMMODITIES[clean]) {
    return [...KNOWN_INDICES_COMMODITIES[clean]];
  }

  // 2. Instrument service lookup
  const instrument = getInstrumentConfig(clean);
  if (instrument) {
    const list = [];
    if (instrument.baseCurrency && instrument.baseCurrency.length === 3) {
      if (instrument.baseCurrency === 'XAU' || instrument.baseCurrency === 'XAG') {
        list.push('USD');
      } else {
        list.push(instrument.baseCurrency);
      }
    }
    if (instrument.quoteCurrency && instrument.quoteCurrency.length === 3) {
      list.push(instrument.quoteCurrency);
    }
    if (list.length > 0) return [...new Set(list)];
  }

  // 3. Standard 6-character FX pair (e.g. EURUSD, GBPJPY, AUDCAD)
  if (clean.length === 6 && /^[A-Z]{6}$/.test(clean)) {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);
    if (base === 'XAU' || base === 'XAG') {
      return ['USD', quote].filter((c, i, a) => a.indexOf(c) === i);
    }
    return [base, quote];
  }

  // 4. Substring checks for popular indices/metals
  for (const [key, currs] of Object.entries(KNOWN_INDICES_COMMODITIES)) {
    if (clean.includes(key)) {
      return [...currs];
    }
  }

  return [];
}

/**
 * Normalizes impact string into standardized enum: HIGH, MEDIUM, LOW
 */
function normalizeImpact(impact) {
  if (!impact || typeof impact !== 'string') return null;
  const upper = impact.trim().toUpperCase();
  if (upper === 'HIGH' || upper.startsWith('HIGH')) return 'HIGH';
  if (upper === 'MEDIUM' || upper.startsWith('MED') || upper === 'MODERATE') return 'MEDIUM';
  if (upper === 'LOW' || upper.startsWith('LOW')) return 'LOW';
  if (upper === 'HOLIDAY' || upper === 'NONE') return 'HOLIDAY';
  return null;
}

/**
 * Checks whether an economic event relates to a given currency pair
 */
function isEventMatchingPair(event, pair) {
  if (!event || !pair) return false;
  const eventCurrency = (event.country || event.currency || '').trim().toUpperCase();
  if (!eventCurrency) return false;

  const pairCurrencies = parseCurrenciesFromPair(pair);
  return pairCurrencies.includes(eventCurrency);
}

/**
 * Checks whether an economic event matches an individual currency
 */
function isEventMatchingCurrency(event, currency) {
  if (!event || !currency) return false;
  const eventCurrency = (event.country || event.currency || '').trim().toUpperCase();
  return eventCurrency === cleanCurrencyString(currency);
}

/**
 * Generates a stable deterministic ID for an economic event
 */
function generateDeterministicEventId(event) {
  if (event.id) return String(event.id);
  const title = (event.title || '').trim().toLowerCase();
  const country = (event.country || event.currency || '').trim().toUpperCase();
  const rawDate = event.date ? new Date(event.date).toISOString().slice(0, 16) : '';
  const payload = `${title}:${country}:${rawDate}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Matches an economic event against a user's alert preferences (V1.1: Supports Targeting Modes & Currencies)
 * @param {Object} event - Economic calendar event { title, country, impact, date, ... }
 * @param {Object} preference - User alert preference { isEnabled, targetingMode, currencies, pairs, impactLevels, ... }
 * @returns {Object} { matched: boolean, matchedCurrencies: string[], matchedPairs: string[], eventCurrency: string, eventImpact: string, reason?: string }
 */
function matchEventToUserPreferences(event, preference) {
  // 1. Global ON/OFF Switch enforcement
  if (!preference || preference.isEnabled === false) {
    return { matched: false, reason: 'GLOBAL_ALERTS_DISABLED' };
  }

  if (!event) {
    return { matched: false, reason: 'INVALID_EVENT' };
  }

  // 2. Impact check
  const eventImpact = normalizeImpact(event.impact);
  if (!eventImpact || eventImpact === 'HOLIDAY') {
    return { matched: false, reason: 'HOLIDAY_OR_UNKNOWN_IMPACT' };
  }

  const userImpacts = (preference.impactLevels || ['HIGH']).map(i => normalizeImpact(i)).filter(Boolean);
  if (!userImpacts.includes(eventImpact)) {
    return { matched: false, reason: 'IMPACT_NOT_SUBSCRIBED', eventImpact };
  }

  // Optional category filter check (backwards compatible when categories is omitted or empty)
  if (Array.isArray(preference.categories) && preference.categories.length > 0) {
    const eventCategory = event.category || classifyEventCategory(event.title, event.impact);
    const allowedCategories = preference.categories.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (allowedCategories.length > 0 && !allowedCategories.includes(eventCategory)) {
      return { matched: false, reason: 'CATEGORY_NOT_SUBSCRIBED', eventCategory, eventImpact };
    }
  }

  // 3. Currency check
  const eventCurrency = (event.country || event.currency || '').trim().toUpperCase();
  if (!eventCurrency) {
    return { matched: false, reason: 'MISSING_EVENT_CURRENCY' };
  }

  const targetingMode = preference.targetingMode || TARGETING_MODES.CURRENCIES_AND_PAIRS;

  const matchedCurrencies = [];
  const matchedPairs = [];

  // Evaluate Individual Currencies
  if (targetingMode === TARGETING_MODES.CURRENCIES_ONLY || targetingMode === TARGETING_MODES.CURRENCIES_AND_PAIRS) {
    const userCurrencies = (preference.currencies || []).map(cleanCurrencyString).filter(Boolean);
    if (userCurrencies.includes(eventCurrency)) {
      matchedCurrencies.push(eventCurrency);
    }
  }

  // Evaluate Currency Pairs
  if (targetingMode === TARGETING_MODES.PAIRS_ONLY || targetingMode === TARGETING_MODES.CURRENCIES_AND_PAIRS) {
    const userPairs = (preference.pairs || []).map(cleanPairString).filter(Boolean);
    for (const pair of userPairs) {
      const pairCurrencies = parseCurrenciesFromPair(pair);
      if (pairCurrencies.includes(eventCurrency)) {
        matchedPairs.push(pair);
      }
    }
  }

  // Deduplicated set results
  const uniqueMatchedCurrencies = [...new Set(matchedCurrencies)];
  const uniqueMatchedPairs = [...new Set(matchedPairs)];

  const hasMatched = uniqueMatchedCurrencies.length > 0 || uniqueMatchedPairs.length > 0;

  if (!hasMatched) {
    return {
      matched: false,
      reason: 'NO_MATCHING_TARGETS',
      eventCurrency,
      eventImpact,
    };
  }

  return {
    matched: true,
    matchedCurrencies: uniqueMatchedCurrencies,
    matchedPairs: uniqueMatchedPairs,
    // Backward compatibility helper
    matchingPairs: uniqueMatchedPairs,
    eventCurrency,
    eventImpact,
  };
}

/**
 * Builds professional, non-predictive notification title and message based on matched context
 */
function buildAlertNotificationContent({ event, matchResult, releaseTimeStr, timeRemainingStr }) {
  const impactLabel = matchResult.eventImpact === 'HIGH' ? 'High-impact' : matchResult.eventImpact === 'MEDIUM' ? 'Medium-impact' : 'Low-impact';
  const title = `${impactLabel} ${matchResult.eventCurrency} economic news approaching`;

  let relevanceExplanation = '';
  const hasCurrs = matchResult.matchedCurrencies && matchResult.matchedCurrencies.length > 0;
  const hasPairs = matchResult.matchedPairs && matchResult.matchedPairs.length > 0;

  if (hasCurrs && hasPairs) {
    relevanceExplanation = `This event is relevant to your ${matchResult.eventCurrency} monitoring preferences and ${matchResult.matchedPairs.join('/')} watchlist.`;
  } else if (hasCurrs) {
    relevanceExplanation = `This event is relevant to your ${matchResult.eventCurrency} monitoring preferences.`;
  } else if (hasPairs) {
    relevanceExplanation = `This event may affect your ${matchResult.matchedPairs.join(', ')} trading instruments.`;
  } else {
    relevanceExplanation = `This event is relevant to your economic monitoring preferences.`;
  }

  const message = `${event.title} is scheduled for ${releaseTimeStr} (in ~${timeRemainingStr}). ${relevanceExplanation}`;

  return { title, message };
}

/**
 * Builds idempotent deduplication key for alert delivery
 */
function buildDeduplicationKey({ userId, eventId, leadMinutes, channel }) {
  if (!userId || !eventId || leadMinutes === undefined || !channel) {
    throw new Error('All deduplication parameters (userId, eventId, leadMinutes, channel) are required');
  }
  return `${userId}:${eventId}:${leadMinutes}:${channel.toUpperCase()}`;
}

module.exports = {
  SUPPORTED_CURRENCIES,
  SUPPORTED_FOREX_PAIRS,
  TARGETING_MODES,
  cleanPairString,
  cleanCurrencyString,
  parseCurrenciesFromPair,
  normalizeImpact,
  isEventMatchingPair,
  isEventMatchingCurrency,
  generateDeterministicEventId,
  matchEventToUserPreferences,
  buildAlertNotificationContent,
  buildDeduplicationKey,
  getCorrelatedCurrencies,
};
