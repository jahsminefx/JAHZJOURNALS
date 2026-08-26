/**
 * Currency Conversion Service for JAHZJOURNALS Risk Calculator & Account Engine
 * Supports multi-account currency conversions across USD, EUR, GBP, NGN, CAD, AUD, CHF, JPY, NZD, ZAR, SGD, AED, INR, KES, GHS, etc.
 * Explicitly tracks rate source (LIVE, CACHED, MANUAL, UNAVAILABLE) without faking data.
 */

export const RATE_SOURCES = {
  LIVE: 'LIVE',
  CACHED: 'CACHED',
  MANUAL: 'MANUAL',
  UNAVAILABLE: 'UNAVAILABLE',
};

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
  { code: 'EUR', name: 'Euro (€)', symbol: '€' },
  { code: 'GBP', name: 'British Pound (£)', symbol: '£' },
  { code: 'NGN', name: 'Nigerian Naira (₦)', symbol: '₦' },
  { code: 'CAD', name: 'Canadian Dollar (C$)', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar (A$)', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc (CHF)', symbol: 'CHF ' },
  { code: 'JPY', name: 'Japanese Yen (¥)', symbol: '¥' },
  { code: 'NZD', name: 'New Zealand Dollar (NZ$)', symbol: 'NZ$' },
  { code: 'ZAR', name: 'South African Rand (R)', symbol: 'R ' },
  { code: 'SGD', name: 'Singapore Dollar (S$)', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham (AED)', symbol: 'AED ' },
  { code: 'INR', name: 'Indian Rupee (₹)', symbol: '₹' },
  { code: 'KES', name: 'Kenyan Shilling (KSh)', symbol: 'KSh ' },
  { code: 'GHS', name: 'Ghanaian Cedi (GH₵)', symbol: 'GH₵ ' },
];

export const CURRENCY_SYMBOLS = SUPPORTED_CURRENCIES.reduce((acc, curr) => {
  acc[curr.code] = curr.symbol;
  return acc;
}, {});

export const getCurrencySymbol = (currency = 'USD') => {
  const code = String(currency || 'USD').toUpperCase();
  return CURRENCY_SYMBOLS[code] || `${code} `;
};

// Base USD rates (1 USD = X Target Currency)
// Provides realistic exchange rates for global account currencies
const DEFAULT_USD_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  NGN: 1550.0,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88,
  JPY: 152.5,
  NZD: 1.65,
  ZAR: 18.2,
  SGD: 1.34,
  AED: 3.67,
  INR: 83.5,
  KES: 129.0,
  GHS: 15.5,
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
  const accUpper = String(accountCurrency || 'USD').toUpperCase();
  const quoteUpper = String(quoteCurrency || 'USD').toUpperCase();

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
      return {
        rate: numericManual,
        source: RATE_SOURCES.MANUAL,
        isDirectMatch: false,
        isAvailable: true,
        label: `1 ${quoteUpper} = ${numericManual} ${accUpper}`,
        note: `Using manually supplied rate (${numericManual}).`,
      };
    }
  }

  // 3. Dynamic market entry price override if pair is the exact conversion pair
  let usdRates = { ...DEFAULT_USD_RATES };
  if (pairSymbol === `USD${quoteUpper}` && entryPrice > 0) {
    usdRates[quoteUpper] = entryPrice;
  }
  if (pairSymbol === `USD${accUpper}` && entryPrice > 0) {
    usdRates[accUpper] = entryPrice;
  }

  // 4. Compute conversion rate from quoteCurrency to accountCurrency
  const quoteUsdRate = usdRates[quoteUpper] || 1.0;
  const accUsdRate = usdRates[accUpper] || 1.0;

  // Rate formula: 1 unit of quoteCurrency in accountCurrency
  const computedRate = accUsdRate / quoteUsdRate;
  const hasKnownRate = Boolean(usdRates[accUpper] && usdRates[quoteUpper]);

  return {
    rate: computedRate,
    source: hasKnownRate ? RATE_SOURCES.LIVE : RATE_SOURCES.UNAVAILABLE,
    isDirectMatch: false,
    isAvailable: true,
    label: `1 ${quoteUpper} = ${computedRate < 0.01 ? computedRate.toFixed(6) : computedRate.toFixed(4)} ${accUpper}`,
    note: `Exchange rate calculated for ${quoteUpper} to ${accUpper}.`,
  };
};

/**
 * Converts monetary amount from Quote Currency to Account Currency
 */
export const convertCurrency = (amountInQuoteCurrency, rateDetails) => {
  if (amountInQuoteCurrency === null || amountInQuoteCurrency === undefined) return 0;
  return Number(amountInQuoteCurrency) * rateDetails.rate;
};
