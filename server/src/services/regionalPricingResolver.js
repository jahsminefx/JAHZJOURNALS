const {
  detectCountry,
  resolveRegion,
  getTraderPricesForRegion,
  getMentorPricesForRegion,
  isInternationalCheckoutEnabled,
  REGIONS,
} = require('../config/pricingCatalogue');
const vpnDetectionService = require('./vpnDetectionService');

/**
 * Extracts raw trusted edge country header without fallback.
 * Returns null if no trusted header is present or if pseudo-location (XX/T1).
 */
function getRawEdgeCountry(req) {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    if (req?.query?.country) return String(req.query.country).trim().toUpperCase();
    if (req?.body?.country) return String(req.body.country).trim().toUpperCase();
  }

  const cfCountry = req?.headers?.['cf-ipcountry'];
  if (cfCountry && cfCountry.length === 2 && cfCountry.toUpperCase() !== 'XX' && cfCountry.toUpperCase() !== 'T1') {
    return cfCountry.toUpperCase();
  }

  const cfViewerCountry = req?.headers?.['cloudfront-viewer-country'];
  if (cfViewerCountry && cfViewerCountry.length === 2) {
    return cfViewerCountry.toUpperCase();
  }

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

  return null;
}

/**
 * Server-Side VPN-Aware Regional Pricing Resolver for JAHZJOURNALS
 * 
 * Conceptual Decision Logic:
 * 1. If a reliable VPN/proxy signal indicates that the visitor is using a VPN or proxy,
 *    select the international pricing presentation (GLOBAL).
 * 2. Otherwise, if the detected country is Nigeria (NG),
 *    select Nigerian NGN pricing (NG).
 * 3. Otherwise, if the detected country is outside Nigeria,
 *    select international USD reference pricing (GLOBAL).
 * 4. If detection fails or returns insufficient information,
 *    fall back to the Nigerian NGN presentation (NG).
 * 
 * Safety & Privacy Guarantees:
 * - Never exposes the visitor's IP address or raw provider responses to the client.
 * - Presentation hint only: never authorizes payments or enables USD checkout.
 * - Handled gracefully on provider timeout, network error, or rate limits.
 */
async function resolveRegionalPricing(req) {
  const isDev = process.env.NODE_ENV !== 'production';

  // 0. Development-Only Preview Mode
  // Handled strictly when NODE_ENV !== 'production'
  if (isDev) {
    const previewRegion = req?.query?.previewRegion;
    if (previewRegion) {
      const lower = String(previewRegion).trim().toLowerCase();
      if (lower === 'nigeria' || lower === 'ng') {
        return {
          region: 'NG',
          currency: 'NGN',
          detectedCountry: 'NG',
          isVpnDetected: false,
          isFallback: false,
          detectionReason: 'DEV_PREVIEW_NIGERIA',
          internationalCheckoutEnabled: isInternationalCheckoutEnabled(),
          regions: REGIONS,
          traderPrices: getTraderPricesForRegion('NG'),
          mentorPrices: getMentorPricesForRegion('NG'),
        };
      }
      if (lower === 'international' || lower === 'global' || lower === 'us') {
        return {
          region: 'GLOBAL',
          currency: 'USD',
          detectedCountry: 'US',
          isVpnDetected: false,
          isFallback: false,
          detectionReason: 'DEV_PREVIEW_INTERNATIONAL',
          internationalCheckoutEnabled: isInternationalCheckoutEnabled(),
          regions: REGIONS,
          traderPrices: getTraderPricesForRegion('GLOBAL'),
          mentorPrices: getMentorPricesForRegion('GLOBAL'),
        };
      }
    }
  }

  // 1. Evaluate VPN / Proxy Signal
  let vpnStatus = { isVpn: false, isKnown: false };
  try {
    vpnStatus = await vpnDetectionService.checkVpnStatus(req);
  } catch (err) {
    // Non-blocking fallback
    vpnStatus = { isVpn: false, isKnown: false, error: err.message };
  }

  // 2. Evaluate Country Geolocation from trusted edge headers
  const rawCountry = getRawEdgeCountry(req);
  const isVpnDetected = Boolean(vpnStatus?.isVpn);

  // 3. Conceptual Decision Matrix
  let resolvedRegion = 'NG';
  let currency = 'NGN';
  let isFallback = false;
  let detectionReason = 'SAFE_FALLBACK';
  let detectedCountry = rawCountry || 'NG';

  if (isVpnDetected) {
    // Condition 1: Reliable VPN or proxy signal detected -> International USD reference presentation
    resolvedRegion = 'GLOBAL';
    currency = 'USD';
    detectionReason = 'VPN_DETECTED';
    detectedCountry = rawCountry || 'VPN';
  } else if (rawCountry === 'NG') {
    // Condition 2: Nigeria without detected VPN -> Nigerian NGN presentation
    resolvedRegion = 'NG';
    currency = 'NGN';
    detectionReason = 'NIGERIA_DIRECT';
  } else if (rawCountry && rawCountry !== 'NG') {
    // Condition 3: Country detected outside Nigeria -> International USD reference presentation
    resolvedRegion = 'GLOBAL';
    currency = 'USD';
    detectionReason = 'FOREIGN_COUNTRY';
  } else {
    // Condition 4: Detection failed, unknown country, or insufficient info -> Fallback to Nigerian NGN presentation
    resolvedRegion = 'NG';
    currency = 'NGN';
    isFallback = true;
    detectionReason = 'SAFE_FALLBACK';
    detectedCountry = 'NG';
  }

  return {
    region: resolvedRegion,
    currency,
    detectedCountry,
    isVpnDetected,
    isFallback,
    detectionReason,
    internationalCheckoutEnabled: isInternationalCheckoutEnabled(),
    regions: REGIONS,
    traderPrices: getTraderPricesForRegion(resolvedRegion),
    mentorPrices: getMentorPricesForRegion(resolvedRegion),
  };
}

module.exports = {
  resolveRegionalPricing,
  getRawEdgeCountry,
};
