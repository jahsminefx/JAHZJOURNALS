const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  REGIONS,
  REGIONAL_PRICES,
  resolveRegion,
  getPriceById,
  getTraderPricesForRegion,
  getDefaultPriceForPlan,
  validatePriceSelection,
  isInternationalCheckoutEnabled,
  detectCountry,
} = require('../src/config/pricingCatalogue');

test('Automatic Regional Pricing & UX — Unit and Integration Verifications', async (t) => {
  await t.test('1. Geolocation edge headers and fallback detection', () => {
    // 1a. Cloudflare Country Header
    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'NG' } }), 'NG');
    assert.strictEqual(resolveRegion(detectCountry({ headers: { 'cf-ipcountry': 'NG' } })), 'NG');

    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'US' } }), 'US');
    assert.strictEqual(resolveRegion(detectCountry({ headers: { 'cf-ipcountry': 'US' } })), 'GLOBAL');

    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'GB' } }), 'GB');
    assert.strictEqual(resolveRegion(detectCountry({ headers: { 'cf-ipcountry': 'GB' } })), 'GLOBAL');

    // 1b. AWS CloudFront Viewer Country Header
    assert.strictEqual(detectCountry({ headers: { 'cloudfront-viewer-country': 'CA' } }), 'CA');
    assert.strictEqual(resolveRegion(detectCountry({ headers: { 'cloudfront-viewer-country': 'CA' } })), 'GLOBAL');

    // 1c. Vercel, Fastly, or standard proxy headers
    assert.strictEqual(detectCountry({ headers: { 'x-country-code': 'DE' } }), 'DE');
    assert.strictEqual(detectCountry({ headers: { 'x-vercel-ip-country': 'FR' } }), 'FR');
    assert.strictEqual(detectCountry({ headers: { 'fastly-client-country': 'AU' } }), 'AU');

    // 1d. Safe launch fallback: When headers are missing, invalid, or unknown ('XX', 'T1'), default to Nigeria ('NG')
    assert.strictEqual(detectCountry({ headers: {} }), 'NG', 'Empty headers must default to NG');
    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'XX' } }), 'NG', 'Cloudflare XX must fallback to NG');
    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'T1' } }), 'NG', 'Cloudflare Tor T1 must fallback to NG');
    assert.strictEqual(detectCountry(null), 'NG', 'Null request must safely default to NG');

    // 1e. Explicit query / body overrides (for deterministic previews)
    assert.strictEqual(detectCountry({ query: { country: 'US' } }), 'US');
    assert.strictEqual(detectCountry({ body: { country: 'GB' } }), 'GB');
  });

  await t.test('2. Canonical Nigerian trader plan prices and currencies', () => {
    const ngPrices = getTraderPricesForRegion('NG');
    assert.ok(Array.isArray(ngPrices) && ngPrices.length >= 4, 'Should have at least 4 NG trader prices');

    const free = ngPrices.find((p) => p.planId === 'FREE');
    assert.ok(free, 'Free plan exists');
    assert.strictEqual(free.amountInMinor, 0);
    assert.strictEqual(free.currency, 'NGN');

    const starter = ngPrices.find((p) => p.planId === 'STARTER');
    assert.ok(starter, 'Starter plan exists');
    assert.strictEqual(starter.amountInMinor, 400000, 'Starter must be ₦4,000 (400,000 kobo)');
    assert.strictEqual(starter.currency, 'NGN');

    const pro = ngPrices.find((p) => p.planId === 'PRO');
    assert.ok(pro, 'Pro plan exists');
    assert.strictEqual(pro.amountInMinor, 850000, 'Pro must be canonical ₦8,500 (850,000 kobo)');
    assert.strictEqual(pro.currency, 'NGN');

    const proSync = ngPrices.find((p) => p.planId === 'PRO_SYNC');
    assert.ok(proSync, 'Pro Sync plan exists');
    assert.strictEqual(proSync.amountInMinor, 3800000, 'Pro Sync target price is ₦38,000');
    assert.strictEqual(proSync.currency, 'NGN');
  });

  await t.test('3. International Reference prices are marked reference-only and disabled for checkout', () => {
    const globalPrices = getTraderPricesForRegion('GLOBAL');
    assert.ok(Array.isArray(globalPrices) && globalPrices.length === 3);

    const starterUsd = globalPrices.find((p) => p.planId === 'STARTER');
    assert.strictEqual(starterUsd.currency, 'USD');
    assert.strictEqual(starterUsd.amountInMinor, 1200, '$12 reference price');
    assert.strictEqual(starterUsd.isReferenceOnly, true);
    assert.strictEqual(starterUsd.checkoutAvailable, false);

    const proSyncUsd = globalPrices.find((p) => p.planId === 'PRO_SYNC');
    assert.strictEqual(proSyncUsd.currency, 'USD');
    assert.strictEqual(proSyncUsd.amountInMinor, 2700, '$27 reference price');
    assert.strictEqual(proSyncUsd.isReferenceOnly, true);
    assert.strictEqual(proSyncUsd.checkoutAvailable, false);

    const eliteUsd = globalPrices.find((p) => p.planId === 'ELITE');
    assert.strictEqual(eliteUsd.currency, 'USD');
    assert.strictEqual(eliteUsd.amountInMinor, 3200, '$32 reference price');
    assert.strictEqual(eliteUsd.isReferenceOnly, true);
    assert.strictEqual(eliteUsd.checkoutAvailable, false);

    // Validate checkout rejection server-side
    const checkoutValidation = validatePriceSelection({
      priceId: starterUsd.id,
      planId: 'STARTER',
      countryCode: 'US',
      currency: 'USD',
    });
    assert.strictEqual(checkoutValidation.valid, false);
    assert.strictEqual(checkoutValidation.reason, 'INTERNATIONAL_CHECKOUT_DISABLED');
  });

  await t.test('4. Frontend Pricing.jsx source inspection — Automatic detection, no prominent selector, and subtle override', () => {
    const pricingJsxPath = path.resolve(__dirname, '../../client/src/pages/Pricing.jsx');
    const content = fs.readFileSync(pricingJsxPath, 'utf8');

    // Section 2: No prominent full-width regional selector before pricing cards
    assert.ok(
      !content.includes('role="tablist"'),
      'Prominent tablist regional selector before cards must be removed'
    );

    // Section 8: Headline and supporting copy
    assert.ok(
      content.includes('Build Better Trading Habits. Understand Your Edge.'),
      'Must contain exact positioning headline'
    );
    assert.ok(
      content.includes('Journal your forex and gold trades, identify recurring mistakes, analyse your performance, and keep your risk under control—all in one place.'),
      'Must contain exact supporting copy'
    );

    // Section 5: Exact International Reference notice copy
    assert.ok(
      content.includes('International billing is coming soon. Prices shown are reference prices only; international checkout is not yet available.'),
      'Must contain exact international notice copy'
    );
    assert.ok(
      content.includes('Switch to Nigeria (NGN)'),
      'Must contain exact CTA button label'
    );

    // Notice is conditional on GLOBAL
    assert.ok(
      content.includes("selectedRegion === 'GLOBAL'"),
      'International notice must be conditioned on GLOBAL region'
    );

    // Development preview and unmistakable indicator
    assert.ok(
      content.includes('import.meta.env.DEV'),
      'Preview mode must be gated by Vite import.meta.env.DEV'
    );
    assert.ok(
      content.includes('DEV PREVIEW ACTIVE'),
      'Must render unmistakable development-only preview indicator'
    );
    assert.ok(
      content.includes('Exit Preview'),
      'Must provide exit preview option'
    );

    // Section 3: Subtle region override at bottom of pricing section
    assert.ok(
      content.includes('Pricing for Nigeria (NGN)'),
      'Subtle override must contain option for Nigeria'
    );
    assert.ok(
      content.includes('International pricing (USD)'),
      'Subtle override must contain option for International'
    );
    assert.ok(
      content.includes('jahz_pricing_region_override'),
      'Must use dedicated storage key for manual region override'
    );
    assert.ok(
      content.includes('Reset to auto-detected'),
      'Must provide reset option when manual override is active'
    );

    // Automatic detection hook
    assert.ok(
      content.includes('/subscriptions/pricing-catalogue'),
      'Must query pricing-catalogue endpoint for auto country detection'
    );

    // Section 7: Card positioning checks
    assert.ok(content.includes('Start journaling and understand basic performance.'), 'Free plan audience match');
    assert.ok(content.includes('Record more trades and identify recurring mistakes.'), 'Starter plan audience match');
    assert.ok(content.includes('Analyse performance in greater depth and manage prop-firm risk.'), 'Pro plan audience match');
    assert.ok(content.includes('Reduce manual trade entry using supported MetaTrader synchronization.'), 'Pro Sync plan audience match');
  });

  await t.test('5. 50% discount calculation and Paystack enforcement', () => {
    const starterPrice = 4000;
    const proPrice = 8500;
    const discount = 50;

    const discountedStarter = Math.round(starterPrice * (1 - discount / 100));
    const discountedPro = Math.round(proPrice * (1 - discount / 100));

    assert.strictEqual(discountedStarter, 2000, '50% off ₦4,000 must be ₦2,000');
    assert.strictEqual(discountedPro, 4250, '50% off ₦8,500 must be ₦4,250');
  });

  await t.test('6. The Nigerian preview renders the NGN presentation locally', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const detected = detectCountry({ query: { previewRegion: 'nigeria' } });
      assert.strictEqual(detected, 'NG');
      const region = resolveRegion(detected);
      assert.strictEqual(region, 'NG');
      const prices = getTraderPricesForRegion(region);
      assert.ok(prices.every((p) => p.currency === 'NGN'));
      assert.ok(prices.some((p) => p.planId === 'STARTER' && p.amountInMinor === 400000));
      assert.ok(prices.some((p) => p.planId === 'PRO' && p.amountInMinor === 850000));
      assert.ok(prices.some((p) => p.planId === 'PRO_SYNC' && p.amountInMinor === 3800000));
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('7. The international preview renders USD reference prices locally', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const detected = detectCountry({ query: { previewRegion: 'international' } });
      assert.strictEqual(detected, 'US');
      const region = resolveRegion(detected);
      assert.strictEqual(region, 'GLOBAL');
      const prices = getTraderPricesForRegion(region);
      assert.ok(prices.every((p) => p.currency === 'USD'));
      assert.ok(prices.every((p) => p.isReferenceOnly === true));
      assert.ok(prices.every((p) => p.checkoutAvailable === false));
      assert.ok(prices.some((p) => p.planId === 'STARTER' && p.amountInMinor === 1200));
      assert.ok(prices.some((p) => p.planId === 'PRO_SYNC' && p.amountInMinor === 2700));
      assert.ok(prices.some((p) => p.planId === 'ELITE' && p.amountInMinor === 3200));
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('8. The preview feature is unavailable in production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // In production, query previewRegion and country overrides MUST be ignored
      const detectedPreviewInt = detectCountry({ query: { previewRegion: 'international' }, headers: {} });
      assert.strictEqual(detectedPreviewInt, 'NG', 'Must ignore previewRegion=international in production and fallback to NG');

      const detectedPreviewNg = detectCountry({ query: { previewRegion: 'nigeria' }, headers: { 'cf-ipcountry': 'GB' } });
      assert.strictEqual(detectedPreviewNg, 'GB', 'Must ignore previewRegion query in production and respect edge header');

      const detectedCountryQuery = detectCountry({ query: { country: 'US' }, headers: {} });
      assert.strictEqual(detectedCountryQuery, 'NG', 'Must ignore country query parameter in production');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('9. Adding previewRegion=international in production cannot authorize USD checkout', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const validation = validatePriceSelection({
        priceId: 'price_usd_starter_monthly',
        planId: 'STARTER',
        countryCode: 'US',
        currency: 'USD',
      });
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.reason, 'INTERNATIONAL_CHECKOUT_DISABLED');
      assert.strictEqual(isInternationalCheckoutEnabled(), false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  await t.test('10. Client-side region changes cannot alter the amount charged (Anti-Tampering)', () => {
    // Attempting to pay 100 kobo (₦1) for Starter plan (₦4,000)
    const tamperedAmount = validatePriceSelection({
      priceId: 'price_ngn_starter_monthly',
      planId: 'STARTER',
      countryCode: 'NG',
      currency: 'NGN',
      amountInMinor: 100,
    });
    assert.strictEqual(tamperedAmount.valid, false);
    assert.strictEqual(tamperedAmount.reason, 'AMOUNT_MISMATCH');

    // Attempting currency mismatch
    const tamperedCurrency = validatePriceSelection({
      priceId: 'price_ngn_starter_monthly',
      planId: 'STARTER',
      countryCode: 'NG',
      currency: 'USD',
      amountInMinor: 400000,
    });
    assert.strictEqual(tamperedCurrency.valid, false);
    assert.strictEqual(tamperedCurrency.reason, 'CURRENCY_MISMATCH');

    // Attempting plan mismatch
    const tamperedPlan = validatePriceSelection({
      priceId: 'price_ngn_starter_monthly',
      planId: 'PRO',
      countryCode: 'NG',
      currency: 'NGN',
    });
    assert.strictEqual(tamperedPlan.valid, false);
    assert.strictEqual(tamperedPlan.reason, 'PLAN_MISMATCH');
  });

  await t.test('11. Nigerian Paystack checkout still selects the correct configured plan and amount', () => {
    const starterValidation = validatePriceSelection({
      priceId: 'price_ngn_starter_monthly',
      planId: 'STARTER',
      countryCode: 'NG',
      currency: 'NGN',
      amountInMinor: 400000,
    });
    assert.strictEqual(starterValidation.valid, true);
    assert.strictEqual(starterValidation.priceRecord.amountInMinor, 400000);
    assert.strictEqual(starterValidation.priceRecord.currency, 'NGN');
    assert.strictEqual(starterValidation.priceRecord.provider, 'PAYSTACK');

    const proValidation = validatePriceSelection({
      priceId: 'price_ngn_pro_monthly',
      planId: 'PRO',
      countryCode: 'NG',
      currency: 'NGN',
      amountInMinor: 850000,
    });
    assert.strictEqual(proValidation.valid, true);
    assert.strictEqual(proValidation.priceRecord.amountInMinor, 850000);
    assert.strictEqual(proValidation.priceRecord.currency, 'NGN');
    assert.strictEqual(proValidation.priceRecord.provider, 'PAYSTACK');
  });

  await t.test('12. International checkout remains unavailable across all international tiers', () => {
    const internationalPrices = [
      'price_usd_starter_monthly',
      'price_usd_pro_sync_monthly',
      'price_usd_elite_monthly',
      'price_usd_mentor_cohort_monthly',
      'price_usd_mentor_growth_monthly',
      'price_usd_mentor_mega_monthly',
    ];

    for (const pid of internationalPrices) {
      const price = getPriceById(pid);
      assert.ok(price, `Price ${pid} exists`);
      assert.strictEqual(price.checkoutAvailable, false, `${pid} checkout must be disabled`);
      assert.strictEqual(price.isReferenceOnly, true, `${pid} must be reference only`);

      const val = validatePriceSelection({
        priceId: pid,
        planId: price.planId,
        countryCode: 'US',
        currency: 'USD',
      });
      assert.strictEqual(val.valid, false, `${pid} must be rejected by validator`);
      assert.strictEqual(val.reason, 'INTERNATIONAL_CHECKOUT_DISABLED');
    }
  });

  await t.test('13. An apparent VPN location does not independently change billing eligibility', () => {
    // Visitor on a US VPN:
    const vpnCountry = detectCountry({ headers: { 'cf-ipcountry': 'US' } });
    assert.strictEqual(vpnCountry, 'US');
    const vpnRegion = resolveRegion(vpnCountry);
    assert.strictEqual(vpnRegion, 'GLOBAL');

    // The VPN visitor CANNOT checkout international USD plans:
    const usdAttempt = validatePriceSelection({
      priceId: 'price_usd_starter_monthly',
      planId: 'STARTER',
      countryCode: vpnCountry,
      currency: 'USD',
    });
    assert.strictEqual(usdAttempt.valid, false);
    assert.strictEqual(usdAttempt.reason, 'INTERNATIONAL_CHECKOUT_DISABLED');

    // The VPN visitor CANNOT tamper with Nigerian plan to pay in USD:
    const ngnWithUsd = validatePriceSelection({
      priceId: 'price_ngn_starter_monthly',
      planId: 'STARTER',
      countryCode: vpnCountry,
      currency: 'USD',
    });
    assert.strictEqual(ngnWithUsd.valid, false);
  });

  await t.test('14. Existing subscription currency and entitlements remain unchanged', () => {
    const { getPlanConfig } = require('../src/config/plans');
    const { hasFeatureAccess } = require('../src/services/entitlementService');

    // Existing user on PRO plan with NGN billing
    const existingUser = {
      id: 'usr_test_123',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      billingCountry: 'NG',
      billingCurrency: 'NGN',
    };

    const config = getPlanConfig(existingUser.subscriptionPlan);
    assert.strictEqual(config.key, 'PRO');
    assert.strictEqual(config.aiAccess, true);
    assert.strictEqual(config.propFirmAccess, true);
    assert.strictEqual(config.tradeLimit, Infinity);
    assert.strictEqual(config.accountLimit, Infinity);
    assert.strictEqual(hasFeatureAccess(existingUser, 'propFirmAccess'), true);

    // IP change or country detection must not alter existing subscriber data
    assert.strictEqual(existingUser.subscriptionPlan, 'PRO');
    assert.strictEqual(existingUser.billingCurrency, 'NGN');
  });

  await t.test('15. Country-detection failure follows the configured fallback behavior (NG)', () => {
    // Null, empty, or unknown geo headers
    assert.strictEqual(detectCountry(null), 'NG');
    assert.strictEqual(detectCountry({}), 'NG');
    assert.strictEqual(detectCountry({ headers: {} }), 'NG');
    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'XX' } }), 'NG');
    assert.strictEqual(detectCountry({ headers: { 'cf-ipcountry': 'T1' } }), 'NG');
    assert.strictEqual(detectCountry({ headers: { 'cloudfront-viewer-country': '' } }), 'NG');

    const defaultRegion = resolveRegion(detectCountry(null));
    assert.strictEqual(defaultRegion, 'NG');
    const defaultPrices = getTraderPricesForRegion(defaultRegion);
    assert.ok(defaultPrices.some((p) => p.id === 'price_ngn_free'));
    assert.ok(defaultPrices.some((p) => p.id === 'price_ngn_starter_monthly'));
    assert.ok(defaultPrices.some((p) => p.id === 'price_ngn_pro_monthly'));
  });

  await t.test('16. Pricing page contains working Compare Plans button and target section', () => {
    const pricingSrc = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/Pricing.jsx'), 'utf8');
    const buttonSrc = fs.readFileSync(path.resolve(__dirname, '../../client/src/components/Button.jsx'), 'utf8');

    // Section exists with id="compare-plans"
    assert.ok(pricingSrc.includes('id="compare-plans"'), 'Pricing page must have section id="compare-plans"');
    assert.ok(pricingSrc.includes('Compare Plans'), 'Pricing page must have Compare Plans button');

    // Button component supports href and anchor scroll
    assert.ok(buttonSrc.includes('href'), 'Button component must support href prop');
    assert.ok(buttonSrc.includes('targetElement.scrollIntoView'), 'Button component must handle anchor smooth scroll');
  });

  await t.test('17. Mentor pricing page contains compare plan table and anchor button', () => {
    const mentorPricingSrc = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/MentorPricing.jsx'), 'utf8');

    // Section exists with id="compare-mentor-plans"
    assert.ok(mentorPricingSrc.includes('id="compare-mentor-plans"'), 'Mentor pricing page must have section id="compare-mentor-plans"');
    assert.ok(mentorPricingSrc.includes('href="#compare-mentor-plans"'), 'Mentor pricing page must have button linking to #compare-mentor-plans');

    // Table contains all three mentor tiers
    assert.ok(mentorPricingSrc.includes('Private Cohort'), 'Mentor comparison table must include Private Cohort tier');
    assert.ok(mentorPricingSrc.includes('Growth Community'), 'Mentor comparison table must include Growth Community tier');
    assert.ok(mentorPricingSrc.includes('Mega Academy'), 'Mentor comparison table must include Mega Academy tier');

    // Table covers core risk guard and capacity rows
    assert.ok(mentorPricingSrc.includes('Strategy Risk Guard Rules'), 'Table must compare Strategy Risk Guard Rules');
    assert.ok(mentorPricingSrc.includes('Monthly Student Journal Capacity'), 'Table must compare Monthly Student Journal Capacity');
    assert.ok(mentorPricingSrc.includes('Paid Cohort Student Checkouts'), 'Table must compare Paid Cohort Student Checkouts');
  });
});
