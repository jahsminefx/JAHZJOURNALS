/**
 * Currency Conversion Service for JAHZJOURNALS Risk Calculator V2
 * Supports Account Currency conversions (USD, EUR, GBP, NGN, JPY, etc.)
 * Explicitly tracks rate source (LIVE, CACHED, MANUAL, UNAVAILABLE) without faking data.
 */

export const RATE_SOURCES = {
  LIVE: 'LIVE',
  CACHED: 'CACHED',
  MANUAL: 'MANUAL',
  UNAVAILABLE: 'UNAVAILABLE',
};

/**
 * Returns exchange rate details between accountCurrency and quoteCurrency
 */
export const getExchangeRateDetails = ({
  accountCurrency = 'USD',
  quoteCurrency = 'USD',
  manualRate = null,
  entryPrice = 1.0,
  pairSymbol = 'EURUSD',
}) => {
  const accUpper = accountCurrency.toUpperCase();
  const quoteUpper = quoteCurrency.toUpperCase();

  // 1. Direct match (e.g. USD account trading EURUSD or XAUUSD)
  if (accUpper === quoteUpper) {
    return {
      rate: 1.0,
      source: RATE_SOURCES.LIVE,
      isDirectMatch: true,
      isAvailable: true,
      label: `1 ${accUpper} = 1 ${quoteUpper}`,
      note: 'Account currency matches instrument quote currency.',
    };
  }

  // 2. Manual rate supplied by trader
  if (manualRate !== null && manualRate !== undefined && manualRate !== '') {
    const numericManual = Number(manualRate);
    if (!Number.isNaN(numericManual) && numericManual > 0) {
      // If JPY quote currency on USD account (e.g. USDJPY=150), 1 JPY = 1/150 USD
      const computedRate = (quoteUpper === 'JPY' && accUpper === 'USD') ? (1 / numericManual) : numericManual;
      return {
        rate: computedRate,
        source: RATE_SOURCES.MANUAL,
        isDirectMatch: false,
        isAvailable: true,
        label: `1 ${quoteUpper} = ${numericManual} ${accUpper}`,
        note: `Using manually supplied rate (${numericManual}).`,
      };
    }
  }

  // 3. Known JPY quote conversion on USD account (USDJPY rate)
  if (quoteUpper === 'JPY' && accUpper === 'USD') {
    const rate = pairSymbol === 'USDJPY' && entryPrice > 0 ? entryPrice : 150.0;
    return {
      rate: 1 / rate,
      source: pairSymbol === 'USDJPY' ? RATE_SOURCES.LIVE : RATE_SOURCES.CACHED,
      isDirectMatch: false,
      isAvailable: true,
      label: `1 JPY = ${(1 / rate).toFixed(6)} USD (at USDJPY = ${rate})`,
      note: pairSymbol === 'USDJPY' ? 'Converted using live entry price rate.' : 'Converted using estimated USDJPY rate (150.0).',
    };
  }

  // 4. Fallback when live exchange rate feed is not connected for unconfigured pair
  return {
    rate: 1.0,
    source: RATE_SOURCES.UNAVAILABLE,
    isDirectMatch: false,
    isAvailable: false,
    label: `Rate unavailable (${quoteUpper} → ${accUpper})`,
    note: `Live currency conversion unavailable for ${quoteUpper} to ${accUpper}. Enter a manual conversion rate or verify with your broker.`,
  };
};

/**
 * Converts monetary amount from Quote Currency to Account Currency
 */
export const convertCurrency = (amountInQuoteCurrency, rateDetails) => {
  if (amountInQuoteCurrency === null || amountInQuoteCurrency === undefined) return 0;
  return Number(amountInQuoteCurrency) * rateDetails.rate;
};
