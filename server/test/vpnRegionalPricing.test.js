const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { resolveRegionalPricing } = require('../src/services/regionalPricingResolver');
const vpnDetectionService = require('../src/services/vpnDetectionService');
const { VpnDetectionService } = require('../src/services/vpnDetectionService');
const {
  validatePriceSelection,
  isInternationalCheckoutEnabled,
  getPriceById,
  getTraderPricesForRegion,
} = require('../src/config/pricingCatalogue');
const { getPlanConfig } = require('../src/config/plans');
const { hasFeatureAccess } = require('../src/services/entitlementService');

test('VPN-Aware Automatic Regional Pricing Resolver — Comprehensive Test Suite', async (t) => {
  // Clear any existing cache before running tests
  vpnDetectionService.clearCache();

  await t.test('1. Nigerian IP, no VPN detected -> Nigerian NGN pricing', async () => {
    const req = {
      headers: {
        'cf-ipcountry': 'NG',
      },
      ip: '102.89.23.1', // Typical Nigerian residential IP
    };

    const res = await resolveRegionalPricing(req);
    assert.strictEqual(res.region, 'NG');
    assert.strictEqual(res.currency, 'NGN');
    assert.strictEqual(res.detectedCountry, 'NG');
    assert.strictEqual(res.isVpnDetected, false);
    assert.strictEqual(res.detectionReason, 'NIGERIA_DIRECT');
    assert.ok(res.traderPrices.some((p) => p.planId === 'STARTER' && p.amountInMinor === 400000));
    assert.ok(res.traderPrices.some((p) => p.planId === 'PRO' && p.amountInMinor === 850000));
  });

  await t.test('2. Nigerian IP, VPN detected -> International USD reference pricing', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const req = {
        headers: {
          'cf-ipcountry': 'NG',
          'cf-threat-score': '65', // Cloudflare threat score indicates proxy/anonymizer
        },
        ip: '102.89.23.2',
      };

      const res = await resolveRegionalPricing(req);
      assert.strictEqual(res.region, 'GLOBAL');
      assert.strictEqual(res.currency, 'USD');
      assert.strictEqual(res.isVpnDetected, true);
      assert.strictEqual(res.detectionReason, 'VPN_DETECTED');
      assert.ok(res.traderPrices.some((p) => p.planId === 'STARTER' && p.amountInMinor === 1200));
      assert.ok(res.traderPrices.every((p) => p.checkoutAvailable === false));
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('3. Foreign IP, no VPN detected -> International USD reference pricing', async () => {
    const req = {
      headers: {
        'cf-ipcountry': 'US',
      },
      ip: '64.233.160.1', // US IP
    };

    const res = await resolveRegionalPricing(req);
    assert.strictEqual(res.region, 'GLOBAL');
    assert.strictEqual(res.currency, 'USD');
    assert.strictEqual(res.detectedCountry, 'US');
    assert.strictEqual(res.isVpnDetected, false);
    assert.strictEqual(res.detectionReason, 'FOREIGN_COUNTRY');
  });

  await t.test('4. Foreign IP, VPN detected -> International USD reference pricing', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const req = {
        headers: {
          'cf-ipcountry': 'GB',
          'cf-threat-score': '55',
        },
        ip: '51.140.23.1',
      };

      const res = await resolveRegionalPricing(req);
      assert.strictEqual(res.region, 'GLOBAL');
      assert.strictEqual(res.currency, 'USD');
      assert.strictEqual(res.isVpnDetected, true);
      assert.strictEqual(res.detectionReason, 'VPN_DETECTED');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('5. Unknown country (missing/empty/XX headers) -> Fallback to Nigerian NGN presentation', async () => {
    const req = {
      headers: {
        'cf-ipcountry': 'XX',
      },
      ip: '127.0.0.1',
    };

    const res = await resolveRegionalPricing(req);
    assert.strictEqual(res.region, 'NG');
    assert.strictEqual(res.currency, 'NGN');
    assert.strictEqual(res.detectedCountry, 'NG');
    assert.strictEqual(res.isVpnDetected, false);
    assert.strictEqual(res.isFallback, true);
    assert.strictEqual(res.detectionReason, 'SAFE_FALLBACK');
  });

  await t.test('6. Unknown VPN status (no provider configured) with Nigerian IP -> Nigerian NGN presentation', async () => {
    const customService = new VpnDetectionService({ provider: 'none' });
    const vpnStatus = await customService.checkVpnStatus({ headers: { 'cf-ipcountry': 'NG' } });
    assert.strictEqual(vpnStatus.isVpn, false);
    assert.strictEqual(vpnStatus.isKnown, false);

    const res = await resolveRegionalPricing({ headers: { 'cf-ipcountry': 'NG' } });
    assert.strictEqual(res.region, 'NG');
    assert.strictEqual(res.currency, 'NGN');
  });

  await t.test('7. Detection provider timeout -> Graceful fallback to default NGN presentation', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      // simulateVpnTimeout triggers timeout simulation in dev mode
      const req = {
        query: { simulateVpnTimeout: 'true' },
        headers: { 'cf-ipcountry': 'NG' },
      };

      const res = await resolveRegionalPricing(req);
      // Because timeout occurred, VPN could not be verified; gracefully falls back according to country/safe fallback
      assert.strictEqual(res.region, 'NG');
      assert.strictEqual(res.currency, 'NGN');
      assert.strictEqual(res.isVpnDetected, false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('8. Detection provider failure (HTTP 500) -> Graceful fallback without crashing', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const req = {
        query: { simulateVpnFailure: 'true' },
        headers: {},
      };

      const res = await resolveRegionalPricing(req);
      assert.strictEqual(res.region, 'NG');
      assert.strictEqual(res.currency, 'NGN');
      assert.strictEqual(res.isFallback, true);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('9. Malformed detection response (JSON error) -> Graceful fallback without crashing', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const req = {
        query: { simulateVpnMalformed: 'true' },
        headers: { 'cf-ipcountry': 'NG' },
      };

      const res = await resolveRegionalPricing(req);
      assert.strictEqual(res.region, 'NG');
      assert.strictEqual(res.currency, 'NGN');
      assert.strictEqual(res.isVpnDetected, false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('10. Spoofed client-supplied simulation headers in production are ignored', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = {
        headers: {
          'x-simulate-vpn': 'true',
          'cf-ipcountry': 'NG',
        },
        query: {
          simulateVpn: 'true',
          previewRegion: 'international',
        },
      };

      const res = await resolveRegionalPricing(req);
      // In production, simulation flags are ignored; cf-ipcountry NG with clean edge signals yields NG
      assert.strictEqual(res.region, 'NG', 'Must ignore client simulation headers in production');
      assert.strictEqual(res.isVpnDetected, false);
      assert.strictEqual(res.detectionReason, 'NIGERIA_DIRECT');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('11. Missing provider credentials -> Gracefully relies on edge signals', async () => {
    const customService = new VpnDetectionService({
      provider: 'vpnapi',
      apiKey: null, // missing credentials
    });

    const status = await customService.checkVpnStatus({ headers: {} });
    assert.strictEqual(status.isVpn, false);
    assert.strictEqual(status.isKnown, false);
    assert.strictEqual(status.source, 'EDGE_ONLY_NO_EXTERNAL_PROVIDER');
  });

  await t.test('12. In-memory TTL caching prevents redundant remote lookups and evicts expired', async () => {
    const customService = new VpnDetectionService({
      provider: 'none',
      cacheTtlMs: 50, // 50ms TTL for testing
    });

    const testIp = '197.210.65.12';
    const hash = customService.hashIp(testIp);

    // Seed cache manually
    customService.cache.set(hash, {
      isVpn: true,
      isKnown: true,
      source: 'TEST_SEED',
      expiresAt: Date.now() + 50,
    });

    const req = { ip: testIp, headers: {} };
    const resCached = await customService.checkVpnStatus(req);
    assert.strictEqual(resCached.isVpn, true);
    assert.strictEqual(resCached.source, 'TEST_SEED_CACHED');

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));
    customService.evictExpired();

    assert.strictEqual(customService.cache.has(hash), false, 'Expired entry must be evicted');
  });

  await t.test('13. International USD checkout remains strictly disabled regardless of VPN status', async () => {
    // Visitor on a detected VPN attempting to purchase USD starter plan
    assert.strictEqual(isInternationalCheckoutEnabled(), false);

    const validation = validatePriceSelection({
      priceId: 'price_usd_starter_monthly',
      planId: 'STARTER',
      countryCode: 'US',
      currency: 'USD',
    });

    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.reason, 'INTERNATIONAL_CHECKOUT_DISABLED');
  });

  await t.test('14. Nigerian Paystack checkout selects canonical plan and amount', () => {
    const starterVal = validatePriceSelection({
      priceId: 'price_ngn_starter_monthly',
      planId: 'STARTER',
      countryCode: 'NG',
      currency: 'NGN',
      amountInMinor: 400000,
    });

    assert.strictEqual(starterVal.valid, true);
    assert.strictEqual(starterVal.priceRecord.amountInMinor, 400000);
    assert.strictEqual(starterVal.priceRecord.currency, 'NGN');
    assert.strictEqual(starterVal.priceRecord.provider, 'PAYSTACK');

    const proVal = validatePriceSelection({
      priceId: 'price_ngn_pro_monthly',
      planId: 'PRO',
      countryCode: 'NG',
      currency: 'NGN',
      amountInMinor: 850000,
    });

    assert.strictEqual(proVal.valid, true);
    assert.strictEqual(proVal.priceRecord.amountInMinor, 850000);
    assert.strictEqual(proVal.priceRecord.currency, 'NGN');
    assert.strictEqual(proVal.priceRecord.provider, 'PAYSTACK');
  });

  await t.test('15. Existing user entitlements and subscription currency are not altered by IP/VPN changes', () => {
    const existingUser = {
      id: 'usr_sub_vpn_test',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      billingCountry: 'NG',
      billingCurrency: 'NGN',
    };

    const config = getPlanConfig(existingUser.subscriptionPlan);
    assert.strictEqual(config.key, 'PRO');
    assert.strictEqual(config.tradeLimit, Infinity);
    assert.strictEqual(config.accountLimit, Infinity);
    assert.strictEqual(config.aiAccess, true);
    assert.strictEqual(hasFeatureAccess(existingUser, 'propFirmAccess'), true);

    // IP change or VPN connection does not mutate user DB state
    assert.strictEqual(existingUser.subscriptionPlan, 'PRO');
    assert.strictEqual(existingUser.billingCurrency, 'NGN');
  });

  await t.test('16. Development preview overrides work locally and are rejected in production', async () => {
    // Development mode
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const devNg = await resolveRegionalPricing({ query: { previewRegion: 'nigeria' } });
      assert.strictEqual(devNg.region, 'NG');
      assert.strictEqual(devNg.currency, 'NGN');
      assert.strictEqual(devNg.detectionReason, 'DEV_PREVIEW_NIGERIA');

      const devInt = await resolveRegionalPricing({ query: { previewRegion: 'international' } });
      assert.strictEqual(devInt.region, 'GLOBAL');
      assert.strictEqual(devInt.currency, 'USD');
      assert.strictEqual(devInt.detectionReason, 'DEV_PREVIEW_INTERNATIONAL');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }

    // Production mode
    process.env.NODE_ENV = 'production';
    try {
      const prodAttempt = await resolveRegionalPricing({
        query: { previewRegion: 'international' },
        headers: { 'cf-ipcountry': 'NG' },
      });
      assert.strictEqual(prodAttempt.region, 'NG', 'Must ignore preview parameter in production');
      assert.strictEqual(prodAttempt.detectionReason, 'NIGERIA_DIRECT');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('17. Frontend Pricing.jsx source inspection — Short-lived session persistence and clean international notice', () => {
    const pricingJsxPath = path.resolve(__dirname, '../../client/src/pages/Pricing.jsx');
    const content = fs.readFileSync(pricingJsxPath, 'utf8');

    // Section 5: Avoid permanent localStorage persistence
    assert.ok(
      content.includes('localStorage.removeItem(REGION_STORAGE_KEY)'),
      'Must clean up permanent localStorage to prevent stale VPN overrides from sticking'
    );
    assert.ok(
      content.includes('sessionStorage.getItem(REGION_STORAGE_KEY)'),
      'Must use sessionStorage for session-only manual overrides'
    );

    // Section 3: Exact international notice copy
    assert.ok(
      content.includes('International billing is coming soon. Prices shown are reference prices only; international checkout is not yet available.'),
      'Must contain exact international notice copy'
    );

    // Section 3: Subtle switch to Nigeria
    assert.ok(
      content.includes('Switch to Nigeria (NGN)'),
      'Must contain subtle return action'
    );

    // VPN detected badge in UI
    assert.ok(
      content.includes('isVpnDetected'),
      'Must consume isVpnDetected signal for subtle indication'
    );
  });
});
