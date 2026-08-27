const test = require('node:test');
const assert = require('node:assert/strict');
const currencyService = require('../src/services/fx/currencyService');

test('Centralized Currency Service V2', async (t) => {
  t.beforeEach(() => {
    currencyService.clearFxCache();
  });

  await t.test('returns 1.0 rate for same currency', async () => {
    const details = await currencyService.getExchangeRateDetails('NGN', 'NGN');
    assert.equal(details.rate, 1.0);
    assert.equal(details.source, 'SAME_CURRENCY');
    assert.equal(details.status, 'OK');
  });

  await t.test('fetches live USD to NGN rate', async () => {
    const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
    assert.equal(details.rate, 1550);
    assert.equal(details.source, 'LIVE');
    assert.equal(details.status, 'OK');
  });

  await t.test('triangulates EUR to NGN cross rate', async () => {
    const details = await currencyService.getExchangeRateDetails('EUR', 'NGN');
    assert.ok(details.rate > 1600);
    assert.equal(details.source, 'LIVE');
    assert.equal(details.status, 'OK');
  });

  await t.test('converts NGN amount to USD reporting currency', async () => {
    const res = await currencyService.convertToReportingCurrency(3000000, 'NGN');
    // 3,000,000 / 1550 = 1935.48387... -> 1935.48
    assert.equal(res.convertedAmount, 1935.48);
    assert.equal(res.rateDetails.status, 'OK');
  });

  await t.test('returns CACHED source when live fetch fails but cache exists', async () => {
    // Prime cache with expired entry directly
    currencyService._setFxCacheForTest('USD_RATES', {
      rates: { NGN: 1550 },
      fetchedAt: new Date(Date.now() - 600000),
      expiresAt: new Date(Date.now() - 300000),
      source: 'LIVE',
    });

    // Override live fetch to fail
    const originalFetch = currencyService.fxRateProvider.fetchLiveRates;
    currencyService.fxRateProvider.fetchLiveRates = async () => ({
      success: false,
      rates: null,
      source: 'UNAVAILABLE',
    });

    try {
      const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
      assert.equal(details.rate, 1550);
      assert.equal(details.source, 'CACHED');
      assert.equal(details.status, 'OK');
    } finally {
      currencyService.fxRateProvider.fetchLiveRates = originalFetch;
    }
  });

  await t.test('returns UNAVAILABLE when live fetch fails and cache is empty (NO static rate fallback)', async () => {
    const originalFetch = currencyService.fxRateProvider.fetchLiveRates;
    currencyService.fxRateProvider.fetchLiveRates = async () => ({
      success: false,
      rates: null,
      source: 'UNAVAILABLE',
    });

    try {
      const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
      assert.equal(details.rate, null);
      assert.equal(details.source, 'UNAVAILABLE');
      assert.equal(details.status, 'UNAVAILABLE');
    } finally {
      currencyService.fxRateProvider.fetchLiveRates = originalFetch;
    }
  });
});
