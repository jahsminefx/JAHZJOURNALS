/**
 * JAHZJOURNALS — Global Pricing, Regional Billing & Multi-Gateway Integration Test Suite
 *
 * Verifies:
 * 1. Pricing Catalogue integrity and regional resolution (NG vs GLOBAL)
 * 2. Active Nigerian prices (Free ₦0, Starter ₦4k, Pro ₦8.5k, Pro Sync ₦38k)
 * 3. International reference prices ($12, $27, $32) marked reference-only with checkout disabled
 * 4. Feature flag gating rejecting unauthorized USD checkout attempts
 * 5. Anti-tampering price, currency, amount, and region validation
 * 6. Payment gateway factory & Paystack adapter operations
 * 7. Stripe webhook HMAC-SHA256 timestamped signature verification
 * 8. Entitlement matrix and MT5 sync tier access control
 * 9. WebhookEvent database idempotency handling
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const pricingCatalogue = require('../src/config/pricingCatalogue');
const paymentGatewayFactory = require('../src/services/billing/paymentGatewayFactory');
const stripeAdapter = require('../src/services/billing/stripeAdapter');
const paystackAdapter = require('../src/services/billing/paystackAdapter');
const { PLANS } = require('../src/config/plans');
const { PLAN_RANK } = require('../src/controllers/subscriptionController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

test('1. Pricing Catalogue — Regional Resolution', () => {
  assert.equal(pricingCatalogue.resolveRegion('NG'), 'NG');
  assert.equal(pricingCatalogue.resolveRegion('ng'), 'NG');
  assert.equal(pricingCatalogue.resolveRegion('GH'), 'NG'); // African corridor
  assert.equal(pricingCatalogue.resolveRegion('KE'), 'NG');
  assert.equal(pricingCatalogue.resolveRegion('US'), 'GLOBAL');
  assert.equal(pricingCatalogue.resolveRegion('GB'), 'GLOBAL');
  assert.equal(pricingCatalogue.resolveRegion('DE'), 'GLOBAL');
  assert.equal(pricingCatalogue.resolveRegion(''), 'GLOBAL');
  assert.equal(pricingCatalogue.resolveRegion(null), 'GLOBAL');
});

test('2. Pricing Catalogue — Active Nigerian Prices & Approved Pro Sync NGN Fixed Price', () => {
  const ngnFree = pricingCatalogue.getPriceById('price_ngn_free');
  assert.ok(ngnFree);
  assert.equal(ngnFree.amountInMinor, 0);
  assert.equal(ngnFree.checkoutAvailable, true);

  const ngnStarter = pricingCatalogue.getPriceById('price_ngn_starter_monthly');
  assert.ok(ngnStarter);
  assert.equal(ngnStarter.currency, 'NGN');
  assert.equal(ngnStarter.amountInMinor, 400000); // ₦4,000.00
  assert.equal(ngnStarter.provider, 'PAYSTACK');
  assert.equal(ngnStarter.checkoutAvailable, true);

  const ngnPro = pricingCatalogue.getPriceById('price_ngn_pro_monthly');
  assert.ok(ngnPro);
  assert.equal(ngnPro.currency, 'NGN');
  assert.equal(ngnPro.amountInMinor, 850000); // ₦8,500.00
  assert.equal(ngnPro.checkoutAvailable, true);

  // Pro Sync in Nigeria: Approved equivalent of USD $27 at fixed baseline ₦1,407.41 -> ₦38,000 (3,800,000 kobo)
  const ngnProSync = pricingCatalogue.getPriceById('price_ngn_pro_sync_monthly');
  assert.ok(ngnProSync);
  assert.equal(ngnProSync.planId, 'PRO_SYNC');
  assert.equal(ngnProSync.currency, 'NGN');
  assert.equal(ngnProSync.amountInMinor, 3800000); // ₦38,000.00
  assert.equal(ngnProSync.checkoutAvailable, true);
  assert.equal(ngnProSync.isReferenceOnly, false);
});

test('3. Pricing Catalogue — International Reference Prices (Checkout Disabled)', () => {
  const usdStarter = pricingCatalogue.getPriceById('price_usd_starter_monthly');
  assert.ok(usdStarter);
  assert.equal(usdStarter.currency, 'USD');
  assert.equal(usdStarter.amountInMinor, 1200); // $12.00
  assert.equal(usdStarter.checkoutAvailable, false);
  assert.equal(usdStarter.isReferenceOnly, true);

  const usdProSync = pricingCatalogue.getPriceById('price_usd_pro_sync_monthly');
  assert.ok(usdProSync);
  assert.equal(usdProSync.planId, 'PRO_SYNC');
  assert.equal(usdProSync.currency, 'USD');
  assert.equal(usdProSync.amountInMinor, 2700); // $27.00
  assert.equal(usdProSync.checkoutAvailable, false);
  assert.equal(usdProSync.isReferenceOnly, true);

  const usdElite = pricingCatalogue.getPriceById('price_usd_elite_monthly');
  assert.ok(usdElite);
  assert.equal(usdElite.planId, 'ELITE');
  assert.equal(usdElite.currency, 'USD');
  assert.equal(usdElite.amountInMinor, 3200); // $32.00
  assert.equal(usdElite.checkoutAvailable, false);
  assert.equal(usdElite.isReferenceOnly, true);
});

test('4. Feature Flag & International Checkout Rejection', async () => {
  // 1. By default, international checkout is disabled
  delete process.env.ENABLE_INTERNATIONAL_CHECKOUT;
  assert.equal(pricingCatalogue.isInternationalCheckoutEnabled(), false);

  // Attempt to select USD price while disabled -> rejected
  const rejectedSelection = pricingCatalogue.validatePriceSelection({
    priceId: 'price_usd_pro_sync_monthly',
    planId: 'PRO_SYNC',
    countryCode: 'US',
    currency: 'USD',
  });
  assert.equal(rejectedSelection.valid, false);
  assert.equal(rejectedSelection.reason, 'INTERNATIONAL_CHECKOUT_DISABLED');

  // Attempt to call stripeAdapter while disabled -> throws error
  await assert.rejects(
    async () => {
      await stripeAdapter.createCheckoutSession({
        user: { id: 'usr_1', email: 'test@example.com' },
        priceRecord: pricingCatalogue.getPriceById('price_usd_pro_sync_monthly'),
        planKey: 'PRO_SYNC',
        clientUrl: 'http://localhost:5173',
      });
    },
    /International USD checkout is currently disabled/
  );

  // 2. When feature flag is temporarily set to 'true', validation allows it
  process.env.ENABLE_INTERNATIONAL_CHECKOUT = 'true';
  assert.equal(pricingCatalogue.isInternationalCheckoutEnabled(), true);

  const allowedSelection = pricingCatalogue.validatePriceSelection({
    priceId: 'price_usd_pro_sync_monthly',
    planId: 'PRO_SYNC',
    countryCode: 'US',
    currency: 'USD',
    amountInMinor: 2700,
  });
  assert.equal(allowedSelection.valid, true);

  // Restore flag to disabled
  delete process.env.ENABLE_INTERNATIONAL_CHECKOUT;
});

test('5. Anti-Tampering Price & Region Validation', () => {
  // Valid Nigerian Pro Sync selection
  const validNgn = pricingCatalogue.validatePriceSelection({
    priceId: 'price_ngn_pro_sync_monthly',
    planId: 'PRO_SYNC',
    countryCode: 'NG',
    currency: 'NGN',
    amountInMinor: 3800000,
  });
  assert.equal(validNgn.valid, true);

  // Invalid price ID
  const invalidId = pricingCatalogue.validatePriceSelection({
    priceId: 'price_fake_123',
    countryCode: 'NG',
  });
  assert.equal(invalidId.valid, false);
  assert.equal(invalidId.reason, 'INVALID_PRICE_ID');

  // Plan mismatch (trying to get PRO_SYNC with STARTER priceId)
  const planMismatch = pricingCatalogue.validatePriceSelection({
    priceId: 'price_ngn_starter_monthly',
    planId: 'PRO_SYNC',
    countryCode: 'NG',
  });
  assert.equal(planMismatch.valid, false);
  assert.equal(planMismatch.reason, 'PLAN_MISMATCH');

  // Region mismatch (US user attempting to buy local NGN price directly)
  const regionMismatch = pricingCatalogue.validatePriceSelection({
    priceId: 'price_ngn_pro_monthly',
    planId: 'PRO',
    countryCode: 'US',
  });
  assert.equal(regionMismatch.valid, false);
  assert.equal(regionMismatch.reason, 'REGION_NOT_ELIGIBLE');

  // Currency mismatch
  const currMismatch = pricingCatalogue.validatePriceSelection({
    priceId: 'price_ngn_pro_monthly',
    planId: 'PRO',
    countryCode: 'NG',
    currency: 'USD',
  });
  assert.equal(currMismatch.valid, false);
  assert.equal(currMismatch.reason, 'CURRENCY_MISMATCH');

  // Minor amount mismatch (attempted client price tampering: ₦1,000 instead of ₦8,500)
  const amtMismatch = pricingCatalogue.validatePriceSelection({
    priceId: 'price_ngn_pro_monthly',
    planId: 'PRO',
    countryCode: 'NG',
    currency: 'NGN',
    amountInMinor: 100000,
  });
  assert.equal(amtMismatch.valid, false);
  assert.equal(amtMismatch.reason, 'AMOUNT_MISMATCH');
});

test('6. Payment Gateway Factory Resolution', () => {
  const ngPrice = pricingCatalogue.getPriceById('price_ngn_starter_monthly');
  const usdPrice = pricingCatalogue.getPriceById('price_usd_pro_sync_monthly');

  const ngAdapter = paymentGatewayFactory.getAdapterForPrice(ngPrice);
  assert.equal(ngAdapter.name, 'PAYSTACK');

  const usdAdapter = paymentGatewayFactory.getAdapterForPrice(usdPrice);
  assert.equal(usdAdapter.name, 'STRIPE');

  assert.equal(paymentGatewayFactory.getAdapter('PAYSTACK').name, 'PAYSTACK');
  assert.equal(paymentGatewayFactory.getAdapter('STRIPE').name, 'STRIPE');

  assert.throws(() => {
    paymentGatewayFactory.getAdapter('CRYPTO_UNKNOWN');
  }, /Unsupported payment provider/);
});

test('7. Stripe Webhook HMAC-SHA256 Signature Verification', () => {
  const secret = 'whsec_test_secret_key_12345';
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  const rawPayload = JSON.stringify({
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_abc' } },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawPayload}`;
  const validHmac = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const validHeader = `t=${timestamp},v1=${validHmac}`;

  // Valid signature
  assert.equal(stripeAdapter.verifyWebhookSignature(rawPayload, validHeader), true);

  // Tampered payload
  const tamperedPayload = rawPayload.replace('evt_test_123', 'evt_test_999');
  assert.equal(stripeAdapter.verifyWebhookSignature(tamperedPayload, validHeader), false);

  // Expired timestamp (older than 300s)
  const expiredTimestamp = timestamp - 400;
  const expiredPayload = `${expiredTimestamp}.${rawPayload}`;
  const expiredHmac = crypto.createHmac('sha256', secret).update(expiredPayload).digest('hex');
  const expiredHeader = `t=${expiredTimestamp},v1=${expiredHmac}`;
  assert.equal(stripeAdapter.verifyWebhookSignature(rawPayload, expiredHeader), false);

  // Missing secret or header
  assert.equal(stripeAdapter.verifyWebhookSignature(rawPayload, ''), false);
});

test('8. Plan Entitlements & MT5 Sync Gating', () => {
  // Free & Starter & Pro must NOT have live MT5 sync
  assert.equal(PLANS.FREE.mt5Sync, false);
  assert.equal(PLANS.STARTER.mt5Sync, false);
  assert.equal(PLANS.PRO.mt5Sync, false);

  // Sync tiers must have live MT5 sync
  assert.equal(PLANS.SYNC_PLUS.mt5Sync, true);
  assert.equal(PLANS.PRO_SYNC.mt5Sync, true);
  assert.equal(PLANS.ELITE.mt5Sync, true);
  assert.equal(PLANS.MENTOR.mt5Sync, true);

  // Elite has unlimited screenshots
  assert.equal(PLANS.ELITE.screenshotLimit, Infinity);

  // Plan Hierarchy
  assert.ok(PLAN_RANK.FREE < PLAN_RANK.STARTER);
  assert.ok(PLAN_RANK.STARTER < PLAN_RANK.PRO);
  assert.ok(PLAN_RANK.PRO < PLAN_RANK.SYNC_PLUS);
  assert.ok(PLAN_RANK.SYNC_PLUS <= PLAN_RANK.PRO_SYNC);
  assert.ok(PLAN_RANK.PRO_SYNC < PLAN_RANK.ELITE);
  assert.ok(PLAN_RANK.ELITE < PLAN_RANK.MENTOR);
});

test('9. WebhookEvent Database Idempotency Handling', async () => {
  const testEventId = `evt_test_idempotency_${Date.now()}`;

  // First ingestion creates record
  const created = await prisma.webhookEvent.create({
    data: {
      provider: 'STRIPE',
      eventId: testEventId,
      eventType: 'checkout.session.completed',
      status: 'PROCESSED',
      payload: { test: true },
    },
  });

  assert.ok(created.id);
  assert.equal(created.eventId, testEventId);

  // Duplicate check simulates incoming replayed webhook
  const existing = await prisma.webhookEvent.findUnique({
    where: {
      eventId: testEventId,
    },
  });

  assert.ok(existing);
  assert.equal(existing.status, 'PROCESSED');

  // Clean up
  await prisma.webhookEvent.delete({ where: { id: created.id } });
  await prisma.$disconnect();
});
