/**
 * Canonical Pricing Catalogue for JAHZJOURNALS
 * 
 * Separates:
 * - Plan Identity (canonical plan keys: FREE, STARTER, PRO, SYNC_PLUS, PRO_SYNC, ELITE, MENTOR)
 * - Plan Entitlements (quotas and feature flags)
 * - Regional Price (amount in minor units, region, eligible countries)
 * - Billing Interval (MONTHLY)
 * - Billing Currency (NGN, USD, EUR, GBP)
 * - Payment Provider (PAYSTACK, STRIPE)
 * - Provider Price/Product Identifiers
 * 
 * Monetary amounts use integer minor units (kobo for NGN, cents for USD/EUR/GBP)
 * to eliminate floating-point precision issues.
 */

// Feature flag controlling international USD checkout activation.
// Defaults strictly to false until global merchant accounts and recurring international rails are live.
function isInternationalCheckoutEnabled() {
  return process.env.ENABLE_INTERNATIONAL_CHECKOUT === 'true';
}

// Configurable fixed price for Nigerian Pro Sync (equivalent to USD $27 at approved reference rate)
// Reference Rate: ₦1,407.41 / USD -> $27 * ₦1,407.41 = ₦38,000.
// Fixed and stored as configurable integer minor units (kobo); NEVER dynamically recalculated from live FX.
const PRO_SYNC_NGN_PRICE = Number(process.env.PRO_SYNC_NGN_PRICE) || 38000;
const PRO_SYNC_NGN_KOBO = Number(process.env.PRO_SYNC_NGN_KOBO) || (PRO_SYNC_NGN_PRICE * 100);

const REGIONS = {
  NG: {
    code: 'NG',
    name: 'Nigeria & Regional Corridors',
    defaultCurrency: 'NGN',
    defaultProvider: 'PAYSTACK',
    eligibleCountries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW'],
    supportedCurrencies: ['NGN'],
  },
  GLOBAL: {
    code: 'GLOBAL',
    name: 'International & Global Markets',
    defaultCurrency: 'USD',
    defaultProvider: 'STRIPE',
    eligibleCountries: ['US', 'GB', 'CA', 'DE', 'FR', 'NL', 'AU', 'NZ', 'SG', 'AE', 'CH', 'IE', 'ES', 'IT', 'SE', 'NO', 'DK', 'FI', 'JP', 'ZA'],
    supportedCurrencies: ['USD', 'GBP', 'EUR'],
  },
};

const REGIONAL_PRICES = {
  // -------------------------------------------------------------
  // REGION: NIGERIA / LOWER PURCHASING POWER (NGN / PAYSTACK)
  // -------------------------------------------------------------
  price_ngn_free: {
    id: 'price_ngn_free',
    planId: 'FREE',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: 0,
    amountFormatted: '₦0 / month',
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    isApproximate: false,
    tagline: 'Build the habit.',
    description: 'Designed for beginner traders starting out with basic trade logging and habit formation.',
  },
  price_ngn_starter_monthly: {
    id: 'price_ngn_starter_monthly',
    planId: 'STARTER',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: 400000, // ₦4,000.00
    amountFormatted: '₦4,000 / month',
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_STARTER_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    isApproximate: false,
    tagline: 'Build discipline.',
    description: 'Designed for active traders who want to track emotions, mistakes, and session execution.',
  },
  price_ngn_pro_monthly: {
    id: 'price_ngn_pro_monthly',
    planId: 'PRO',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: 850000, // ₦8,500.00
    amountFormatted: '₦8,500 / month',
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_PRO_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    isApproximate: false,
    highlighted: true,
    tagline: 'Find your edge.',
    description: 'The flagship individual trader plan with AI reviews, prop-firm tracking, and PDF reports.',
  },
  price_ngn_pro_sync_monthly: {
    id: 'price_ngn_pro_sync_monthly',
    planId: 'PRO_SYNC',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: PRO_SYNC_NGN_KOBO, // ₦38,000.00 (3,800,000 kobo)
    amountFormatted: `₦${PRO_SYNC_NGN_PRICE.toLocaleString()} / month`,
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_PRO_SYNC_PLAN || process.env.PAYSTACK_SYNC_PLUS_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    isApproximate: false,
    highlighted: true,
    tagline: 'Automate your journal.',
    description: 'Everything in Pro plus automated MetaTrader 4/5 Cloud Sync for your live and funded accounts.',
  },
  price_ngn_sync_plus_monthly: {
    id: 'price_ngn_sync_plus_monthly',
    planId: 'SYNC_PLUS',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: PRO_SYNC_NGN_KOBO, // ₦38,000.00
    amountFormatted: `₦${PRO_SYNC_NGN_PRICE.toLocaleString()} / month`,
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_SYNC_PLUS_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    isApproximate: false,
    tagline: 'Automate your journal.',
    description: 'Everything in Pro plus automated MetaTrader 4/5 Cloud Sync for your live and funded accounts.',
  },

  // -------------------------------------------------------------
  // REGION: INTERNATIONAL MARKETS (USD REFERENCE PRICING)
  // Checkout disabled by default until global merchant gateway is enabled
  // -------------------------------------------------------------
  price_usd_starter_monthly: {
    id: 'price_usd_starter_monthly',
    planId: 'STARTER',
    region: 'GLOBAL',
    currency: 'USD',
    amountInMinor: 1200, // $12.00
    amountFormatted: '$12 / month',
    billingInterval: 'MONTHLY',
    provider: 'STRIPE',
    providerPriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
    active: true,
    checkoutAvailable: false,
    isReferenceOnly: true,
    isApproximate: false,
    tagline: 'Entry-level disciplined journaling.',
    description: '100 trades/month, 3 accounts, emotion and rule-violation tracking, and session analytics.',
  },
  price_usd_pro_sync_monthly: {
    id: 'price_usd_pro_sync_monthly',
    planId: 'PRO_SYNC',
    region: 'GLOBAL',
    currency: 'USD',
    amountInMinor: 2700, // $27.00
    amountFormatted: '$27 / month',
    billingInterval: 'MONTHLY',
    provider: 'STRIPE',
    providerPriceId: process.env.STRIPE_PRO_SYNC_PRICE_ID || null,
    active: true,
    checkoutAvailable: false,
    isReferenceOnly: true,
    isApproximate: false,
    highlighted: true,
    tagline: 'Automated sync & prop firm edge.',
    description: 'Full Pro features plus automated MT4/MT5 Cloud Sync, Prop Firm cockpit, and AI trade reviews.',
  },
  price_usd_elite_monthly: {
    id: 'price_usd_elite_monthly',
    planId: 'ELITE',
    region: 'GLOBAL',
    currency: 'USD',
    amountInMinor: 3200, // $32.00
    amountFormatted: '$32 / month',
    billingInterval: 'MONTHLY',
    provider: 'STRIPE',
    providerPriceId: process.env.STRIPE_ELITE_PRICE_ID || null,
    active: true,
    checkoutAvailable: false,
    isReferenceOnly: true,
    isApproximate: false,
    tagline: 'Maximum power for serious traders.',
    description: 'The highest tier with priority cloud sync, expanded AI quota, unlimited screenshots, and dedicated support.',
  },

  // -------------------------------------------------------------
  // MENTOR & ACADEMY REGIONAL PRICES
  // -------------------------------------------------------------
  price_ngn_mentor_cohort_monthly: {
    id: 'price_ngn_mentor_cohort_monthly',
    planId: 'MENTOR',
    subTier: 'PRIVATE_COHORT',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: 1450000, // ₦14,500.00
    amountFormatted: '₦14,500 / month',
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_MENTOR_PRIVATE_COHORT_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    maxStudents: 80,
    maxCohorts: 2,
    tagline: 'Private Cohort (Up to 80 Students)',
  },
  price_ngn_mentor_growth_monthly: {
    id: 'price_ngn_mentor_growth_monthly',
    planId: 'MENTOR',
    subTier: 'GROWTH',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: 2500000, // ₦25,000.00
    amountFormatted: '₦25,000 / month',
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_MENTOR_GROWTH_PLAN || process.env.PAYSTACK_MENTOR_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    maxStudents: 200,
    maxCohorts: 5,
    tagline: 'Growth Community (Up to 200 Students)',
  },
  price_ngn_mentor_mega_monthly: {
    id: 'price_ngn_mentor_mega_monthly',
    planId: 'MENTOR',
    subTier: 'MEGA',
    region: 'NG',
    currency: 'NGN',
    amountInMinor: 8500000, // ₦85,000.00
    amountFormatted: '₦85,000 / month',
    billingInterval: 'MONTHLY',
    provider: 'PAYSTACK',
    providerPlanCode: process.env.PAYSTACK_MENTOR_MEGA_PLAN || null,
    active: true,
    checkoutAvailable: true,
    isReferenceOnly: false,
    maxStudents: 1000,
    maxCohorts: Infinity,
    tagline: 'Mega Academy (Up to 1,000 Students Flat Cap)',
  },

  // Proposed International Mentor Reference Prices
  price_usd_mentor_cohort_monthly: {
    id: 'price_usd_mentor_cohort_monthly',
    planId: 'MENTOR',
    subTier: 'PRIVATE_COHORT',
    region: 'GLOBAL',
    currency: 'USD',
    amountInMinor: 5900, // $59.00
    amountFormatted: '$59 / month',
    billingInterval: 'MONTHLY',
    provider: 'STRIPE',
    active: true,
    checkoutAvailable: false,
    isReferenceOnly: true,
    maxStudents: 80,
    maxCohorts: 2,
    tagline: 'Private Cohort (Up to 80 Students)',
  },
  price_usd_mentor_growth_monthly: {
    id: 'price_usd_mentor_growth_monthly',
    planId: 'MENTOR',
    subTier: 'GROWTH',
    region: 'GLOBAL',
    currency: 'USD',
    amountInMinor: 9900, // $99.00
    amountFormatted: '$99 / month',
    billingInterval: 'MONTHLY',
    provider: 'STRIPE',
    active: true,
    checkoutAvailable: false,
    isReferenceOnly: true,
    maxStudents: 200,
    maxCohorts: 5,
    tagline: 'Growth Community (Up to 200 Students)',
  },
  price_usd_mentor_mega_monthly: {
    id: 'price_usd_mentor_mega_monthly',
    planId: 'MENTOR',
    subTier: 'MEGA',
    region: 'GLOBAL',
    currency: 'USD',
    amountInMinor: 24900, // $249.00
    amountFormatted: '$249 / month',
    billingInterval: 'MONTHLY',
    provider: 'STRIPE',
    active: true,
    checkoutAvailable: false,
    isReferenceOnly: true,
    maxStudents: 1000,
    maxCohorts: Infinity,
    tagline: 'Mega Academy (Up to 1,000 Students Flat Cap)',
  },
};

/**
 * Resolves region code ('NG' or 'GLOBAL') based on country ISO code or explicit selection.
 */
function resolveRegion(countryCode = 'NG') {
  if (!countryCode) return 'GLOBAL';
  const upper = String(countryCode).trim().toUpperCase();
  if (REGIONS.NG.eligibleCountries.includes(upper)) {
    return 'NG';
  }
  return 'GLOBAL';
}

/**
 * Retrieves a single price record by its stable priceId.
 */
function getPriceById(priceId) {
  if (!priceId) return null;
  return REGIONAL_PRICES[priceId] || null;
}

/**
 * Retrieves all active individual trader prices for a given region.
 */
function getTraderPricesForRegion(regionCode = 'NG') {
  const targetRegion = resolveRegion(regionCode);
  return Object.values(REGIONAL_PRICES).filter(
    (p) => p.active && p.region === targetRegion && p.planId !== 'MENTOR'
  );
}

/**
 * Retrieves all active mentor prices for a given region.
 */
function getMentorPricesForRegion(regionCode = 'NG') {
  const targetRegion = resolveRegion(regionCode);
  return Object.values(REGIONAL_PRICES).filter(
    (p) => p.active && p.region === targetRegion && p.planId === 'MENTOR'
  );
}

/**
 * Resolves default price for a plan in a given region.
 */
function getDefaultPriceForPlan(planKey, regionCode = 'NG', mentorTier = 'PRIVATE_COHORT') {
  const targetRegion = resolveRegion(regionCode);
  const normalizedPlan = String(planKey).toUpperCase();

  if (normalizedPlan === 'FREE') {
    return REGIONAL_PRICES.price_ngn_free;
  }

  if (targetRegion === 'NG') {
    if (normalizedPlan === 'STARTER') return REGIONAL_PRICES.price_ngn_starter_monthly;
    if (normalizedPlan === 'PRO') return REGIONAL_PRICES.price_ngn_pro_monthly;
    if (normalizedPlan === 'SYNC_PLUS' || normalizedPlan === 'PRO_SYNC') return REGIONAL_PRICES.price_ngn_sync_plus_monthly;
    if (normalizedPlan === 'MENTOR') {
      if (mentorTier === 'GROWTH') return REGIONAL_PRICES.price_ngn_mentor_growth_monthly;
      if (mentorTier === 'MEGA') return REGIONAL_PRICES.price_ngn_mentor_mega_monthly;
      return REGIONAL_PRICES.price_ngn_mentor_cohort_monthly;
    }
  } else {
    // GLOBAL
    if (normalizedPlan === 'STARTER') return REGIONAL_PRICES.price_usd_starter_monthly;
    if (normalizedPlan === 'PRO_SYNC' || normalizedPlan === 'SYNC_PLUS' || normalizedPlan === 'PRO') {
      return REGIONAL_PRICES.price_usd_pro_sync_monthly;
    }
    if (normalizedPlan === 'ELITE') return REGIONAL_PRICES.price_usd_elite_monthly;
    if (normalizedPlan === 'MENTOR') {
      if (mentorTier === 'GROWTH') return REGIONAL_PRICES.price_usd_mentor_growth_monthly;
      if (mentorTier === 'MEGA') return REGIONAL_PRICES.price_usd_mentor_mega_monthly;
      return REGIONAL_PRICES.price_usd_mentor_cohort_monthly;
    }
  }

  return null;
}

/**
 * Anti-Tampering Validation
 * Revalidates price, region eligibility, currency, and amount server-side.
 */
function validatePriceSelection({ priceId, planId, countryCode, currency, amountInMinor }) {
  const priceRecord = getPriceById(priceId);
  if (!priceRecord) {
    return {
      valid: false,
      reason: 'INVALID_PRICE_ID',
      message: `Price ID "${priceId}" does not exist in the pricing catalogue.`,
    };
  }

  if (!priceRecord.active) {
    return {
      valid: false,
      reason: 'INACTIVE_PRICE',
      message: `Price ID "${priceId}" is no longer active.`,
    };
  }

  if (planId && String(planId).toUpperCase() !== priceRecord.planId) {
    return {
      valid: false,
      reason: 'PLAN_MISMATCH',
      message: `Price ID "${priceId}" belongs to plan "${priceRecord.planId}", not "${planId}".`,
    };
  }

  // International checkout availability check
  if ((priceRecord.region === 'GLOBAL' || priceRecord.currency !== 'NGN' || priceRecord.provider === 'STRIPE') && !isInternationalCheckoutEnabled()) {
    return {
      valid: false,
      reason: 'INTERNATIONAL_CHECKOUT_DISABLED',
      message: 'International USD checkout is currently disabled. Active subscriptions are processed in Nigerian Naira (NGN) via Paystack.',
    };
  }

  // Country eligibility check
  const resolvedRegion = resolveRegion(countryCode);
  if (priceRecord.region !== resolvedRegion) {
    return {
      valid: false,
      reason: 'REGION_NOT_ELIGIBLE',
      message: `This price is configured for the ${priceRecord.region} region, but your selected country (${countryCode}) resolves to ${resolvedRegion}.`,
    };
  }

  // Currency check
  if (currency && String(currency).toUpperCase() !== priceRecord.currency) {
    return {
      valid: false,
      reason: 'CURRENCY_MISMATCH',
      message: `Expected charge currency ${priceRecord.currency}, but received ${currency}.`,
    };
  }

  // Amount in minor check (if supplied by caller)
  if (amountInMinor !== undefined && amountInMinor !== null) {
    if (Number(amountInMinor) !== priceRecord.amountInMinor) {
      return {
        valid: false,
        reason: 'AMOUNT_MISMATCH',
        message: `Expected amount ${priceRecord.amountInMinor} in minor units, but received ${amountInMinor}.`,
      };
    }
  }

  return {
    valid: true,
    priceRecord,
    region: resolvedRegion,
  };
}

/**
 * Initial country detection from HTTP headers with development preview support.
 * Checks standard CDN, edge, and reverse proxy headers without external API dependencies.
 * Safely defaults to 'NG' (Nigeria) for this launch when headers are absent or detection fails.
 * 
 * Development preview overrides (?previewRegion=nigeria / ?previewRegion=international)
 * are strictly restricted to non-production environments (process.env.NODE_ENV !== 'production').
 */
function detectCountry(req) {
  const isDev = process.env.NODE_ENV !== 'production';

  // 1. Development/test mode preview query/body overrides
  if (isDev) {
    const previewRegion = req?.query?.previewRegion;
    if (previewRegion) {
      const lower = String(previewRegion).trim().toLowerCase();
      if (lower === 'nigeria' || lower === 'ng') return 'NG';
      if (lower === 'international' || lower === 'global' || lower === 'us') return 'US';
    }
    if (req?.query?.country) return String(req.query.country).trim().toUpperCase();
    if (req?.body?.country) return String(req.body.country).trim().toUpperCase();
  }

  // 2. Cloudflare Country Header (e.g. 'NG', 'US', 'GB')
  const cfCountry = req?.headers?.['cf-ipcountry'];
  if (cfCountry && cfCountry.length === 2 && cfCountry.toUpperCase() !== 'XX' && cfCountry.toUpperCase() !== 'T1') {
    return cfCountry.toUpperCase();
  }

  // 3. AWS CloudFront Viewer Country Header
  const cfViewerCountry = req?.headers?.['cloudfront-viewer-country'];
  if (cfViewerCountry && cfViewerCountry.length === 2) {
    return cfViewerCountry.toUpperCase();
  }

  // 4. Vercel, Fastly, Google Cloud App Engine, or standard proxy headers
  const proxyCountry =
    req?.headers?.['x-country-code'] ||
    req?.headers?.['x-geo-country'] ||
    req?.headers?.['x-vercel-ip-country'] ||
    req?.headers?.['fastly-client-country'] ||
    req?.headers?.['x-appengine-country'] ||
    req?.headers?.['x-real-ip-country'];
  if (proxyCountry && proxyCountry.length === 2) {
    return proxyCountry.toUpperCase();
  }

  // 5. Default safe launch market baseline: Nigeria
  return 'NG';
}

module.exports = {
  isInternationalCheckoutEnabled,
  PRO_SYNC_NGN_PRICE,
  PRO_SYNC_NGN_KOBO,
  REGIONS,
  REGIONAL_PRICES,
  resolveRegion,
  getPriceById,
  getTraderPricesForRegion,
  getMentorPricesForRegion,
  getDefaultPriceForPlan,
  validatePriceSelection,
  detectCountry,
};
