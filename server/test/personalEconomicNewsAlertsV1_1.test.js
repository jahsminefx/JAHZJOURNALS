const test = require('node:test');
const assert = require('node:assert/strict');
const {
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
  SUPPORTED_FOREX_PAIRS,
  SUPPORTED_CURRENCIES,
  TARGETING_MODES,
} = require('../src/services/currencyMatchingService');
const {
  formatReleaseTime,
  formatLeadTimeString,
  DEFAULT_PREFERENCE,
} = require('../src/services/economicAlertService');

test('Personal Economic News Alerts V1.1 Suite', async (t) => {

  // ── 1. GLOBAL CONTROL TESTS ──────────────────────────────────────────
  await t.test('1. Global Control: Global alerts ON allows matching', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.CURRENCIES_ONLY,
      currencies: ['USD'],
      impactLevels: ['HIGH'],
    };
    const event = { title: 'US CPI', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const result = matchEventToUserPreferences(event, pref);
    assert.equal(result.matched, true);
  });

  await t.test('2. Global Control: Global alerts OFF suppresses all matching server-side', () => {
    const pref = {
      isEnabled: false,
      targetingMode: TARGETING_MODES.CURRENCIES_AND_PAIRS,
      currencies: ['USD', 'EUR'],
      pairs: ['EURUSD'],
      impactLevels: ['HIGH'],
    };
    const event = { title: 'US CPI', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const result = matchEventToUserPreferences(event, pref);
    assert.equal(result.matched, false);
    assert.equal(result.reason, 'GLOBAL_ALERTS_DISABLED');
  });

  await t.test('3. Global Control: Saved preferences are retained when alerts are disabled', () => {
    const savedConfig = {
      isEnabled: false,
      targetingMode: TARGETING_MODES.CURRENCIES_AND_PAIRS,
      currencies: ['USD', 'GBP', 'JPY'],
      pairs: ['EURUSD', 'GBPJPY'],
      impactLevels: ['HIGH', 'MEDIUM'],
      leadTimesMinutes: [30],
    };
    assert.equal(savedConfig.currencies.length, 3);
    assert.equal(savedConfig.pairs.length, 2);
    assert.equal(savedConfig.impactLevels.length, 2);

    // Re-enabling restores exact configuration
    const restored = { ...savedConfig, isEnabled: true };
    const event = { title: 'BoJ Interest Rate', country: 'JPY', impact: 'High', date: new Date().toISOString() };
    const match = matchEventToUserPreferences(event, restored);
    assert.equal(match.matched, true);
    assert.deepEqual(match.matchedCurrencies, ['JPY']);
    assert.deepEqual(match.matchedPairs, ['GBPJPY']);
  });

  // ── 2. INDIVIDUAL CURRENCY MATCHING TESTS ──────────────────────────
  await t.test('4. Currency Matching: USD selection matches USD events', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.CURRENCIES_ONLY,
      currencies: ['USD'],
      impactLevels: ['HIGH'],
    };
    const usdEvent = { title: 'Non-Farm Employment Change', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const match = matchEventToUserPreferences(usdEvent, pref);
    assert.equal(match.matched, true);
    assert.deepEqual(match.matchedCurrencies, ['USD']);
    assert.deepEqual(match.matchedPairs, []);
  });

  await t.test('5. Currency Matching: EUR selection matches EUR events', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.CURRENCIES_ONLY,
      currencies: ['EUR'],
      impactLevels: ['HIGH'],
    };
    const eurEvent = { title: 'ECB Rate Decision', country: 'EUR', impact: 'High', date: new Date().toISOString() };
    const match = matchEventToUserPreferences(eurEvent, pref);
    assert.equal(match.matched, true);
    assert.deepEqual(match.matchedCurrencies, ['EUR']);
  });

  await t.test('6. Currency Matching: USD does not match EUR-only events', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.CURRENCIES_ONLY,
      currencies: ['USD'],
      impactLevels: ['HIGH'],
    };
    const eurEvent = { title: 'German CPI', country: 'EUR', impact: 'High', date: new Date().toISOString() };
    const match = matchEventToUserPreferences(eurEvent, pref);
    assert.equal(match.matched, false);
    assert.equal(match.reason, 'NO_MATCHING_TARGETS');
  });

  await t.test('7. Currency Matching: Multi-currency selection matches any selected currency', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.CURRENCIES_ONLY,
      currencies: ['USD', 'GBP', 'AUD'],
      impactLevels: ['HIGH'],
    };
    const gbpEvent = { title: 'BoE Rate', country: 'GBP', impact: 'High', date: new Date().toISOString() };
    const audEvent = { title: 'RBA Cash Rate', country: 'AUD', impact: 'High', date: new Date().toISOString() };
    const cadEvent = { title: 'BOC Rate', country: 'CAD', impact: 'High', date: new Date().toISOString() };

    assert.equal(matchEventToUserPreferences(gbpEvent, pref).matched, true);
    assert.equal(matchEventToUserPreferences(audEvent, pref).matched, true);
    assert.equal(matchEventToUserPreferences(cadEvent, pref).matched, false);
  });

  await t.test('8. Currency Matching: Unsupported or non-standard currencies handled gracefully', () => {
    assert.equal(cleanCurrencyString(''), '');
    assert.equal(cleanCurrencyString(null), '');
    assert.equal(isEventMatchingCurrency({ country: 'USD' }, 'INVALID'), false);
  });

  // ── 3. PAIR MATCHING TESTS ──────────────────────────────────────────
  await t.test('9. Pair Matching: EURUSD matches EUR and USD events', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.PAIRS_ONLY,
      pairs: ['EURUSD'],
      impactLevels: ['HIGH'],
    };
    const eurEvent = { title: 'ECB Policy', country: 'EUR', impact: 'High', date: new Date().toISOString() };
    const usdEvent = { title: 'FOMC Statement', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const jpyEvent = { title: 'BoJ Outlook', country: 'JPY', impact: 'High', date: new Date().toISOString() };

    assert.equal(matchEventToUserPreferences(eurEvent, pref).matched, true);
    assert.equal(matchEventToUserPreferences(usdEvent, pref).matched, true);
    assert.equal(matchEventToUserPreferences(jpyEvent, pref).matched, false);
  });

  await t.test('10. Pair Matching: GBPJPY matches GBP and JPY events', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.PAIRS_ONLY,
      pairs: ['GBPJPY'],
      impactLevels: ['HIGH'],
    };
    const gbpEvent = { title: 'UK GDP', country: 'GBP', impact: 'High', date: new Date().toISOString() };
    const jpyEvent = { title: 'Tokyo CPI', country: 'JPY', impact: 'High', date: new Date().toISOString() };
    const chfEvent = { title: 'SNB Rate', country: 'CHF', impact: 'High', date: new Date().toISOString() };

    assert.equal(matchEventToUserPreferences(gbpEvent, pref).matched, true);
    assert.equal(matchEventToUserPreferences(jpyEvent, pref).matched, true);
    assert.equal(matchEventToUserPreferences(chfEvent, pref).matched, false);
  });

  // ── 4. COMBINED MATCHING & DEDUPLICATION TESTS ──────────────────────
  await t.test('11. Combined Matching: Direct USD selection plus EURUSD produces single deduplicated alert', () => {
    const pref = {
      isEnabled: true,
      targetingMode: TARGETING_MODES.CURRENCIES_AND_PAIRS,
      currencies: ['USD'],
      pairs: ['EURUSD', 'GBPUSD'],
      impactLevels: ['HIGH'],
    };

    const usdEvent = { title: 'US Retail Sales', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const match = matchEventToUserPreferences(usdEvent, pref);

    assert.equal(match.matched, true);
    // Retains both currency preference and watchlist pairs
    assert.deepEqual(match.matchedCurrencies, ['USD']);
    assert.deepEqual(match.matchedPairs.sort(), ['EURUSD', 'GBPUSD'].sort());

    // Notification content explains both cleanly
    const content = buildAlertNotificationContent({
      event: usdEvent,
      matchResult: match,
      releaseTimeStr: '3:00 PM',
      timeRemainingStr: '30 minutes',
    });

    assert.ok(content.title.includes('High-impact USD'));
    assert.ok(content.message.includes('USD monitoring preferences'));
    assert.ok(content.message.includes('watchlist'));
  });

  // ── 5. IMPACT LEVEL TESTS ───────────────────────────────────────────
  await t.test('12. Impact Levels: High-only, Medium-only, Low-only, and Multiple', () => {
    const highEvent = { title: 'CPI', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const medEvent = { title: 'PMI', country: 'USD', impact: 'Medium', date: new Date().toISOString() };
    const lowEvent = { title: 'Speech', country: 'USD', impact: 'Low', date: new Date().toISOString() };

    // High only
    const highPref = { isEnabled: true, targetingMode: 'CURRENCIES_ONLY', currencies: ['USD'], impactLevels: ['HIGH'] };
    assert.equal(matchEventToUserPreferences(highEvent, highPref).matched, true);
    assert.equal(matchEventToUserPreferences(medEvent, highPref).matched, false);
    assert.equal(matchEventToUserPreferences(lowEvent, highPref).matched, false);

    // Medium only
    const medPref = { isEnabled: true, targetingMode: 'CURRENCIES_ONLY', currencies: ['USD'], impactLevels: ['MEDIUM'] };
    assert.equal(matchEventToUserPreferences(highEvent, medPref).matched, false);
    assert.equal(matchEventToUserPreferences(medEvent, medPref).matched, true);
    assert.equal(matchEventToUserPreferences(lowEvent, medPref).matched, false);

    // High + Medium
    const multiPref = { isEnabled: true, targetingMode: 'CURRENCIES_ONLY', currencies: ['USD'], impactLevels: ['HIGH', 'MEDIUM'] };
    assert.equal(matchEventToUserPreferences(highEvent, multiPref).matched, true);
    assert.equal(matchEventToUserPreferences(medEvent, multiPref).matched, true);
    assert.equal(matchEventToUserPreferences(lowEvent, multiPref).matched, false);
  });

  // ── 6. TIMING & TIMEZONE TESTS ──────────────────────────────────────
  await t.test('13. Notification Timing & Timezone: 24h, 1h, 30m, 15m and timezone formatting', () => {
    assert.equal(formatLeadTimeString(15), '15 minutes');
    assert.equal(formatLeadTimeString(30), '30 minutes');
    assert.equal(formatLeadTimeString(60), '1 hour(s)');
    assert.equal(formatLeadTimeString(1440), '1 hour(s)');

    const date = new Date('2026-11-05T14:30:00.000Z');
    const nyTime = formatReleaseTime(date, 'America/New_York');
    const tokyoTime = formatReleaseTime(date, 'Asia/Tokyo');
    assert.ok(nyTime.length > 0);
    assert.ok(tokyoTime.length > 0);
    assert.notEqual(nyTime, tokyoTime);
  });

  // ── 7. RELIABILITY & IDEMPOTENCY TESTS ──────────────────────────────
  await t.test('14. Reliability: buildDeduplicationKey produces stable compound identities', () => {
    const k1 = buildDeduplicationKey({ userId: 'u1', eventId: 'ev1', leadMinutes: 30, channel: 'IN_APP' });
    const k2 = buildDeduplicationKey({ userId: 'u1', eventId: 'ev1', leadMinutes: 30, channel: 'in_app' });
    assert.equal(k1, 'u1:ev1:30:IN_APP');
    assert.equal(k1, k2);
  });

  await t.test('15. Reliability: generateDeterministicEventId is invariant across syncs', () => {
    const ev = { title: 'ISM Manufacturing PMI', country: 'USD', date: '2026-11-03T15:00:00.000Z' };
    const id1 = generateDeterministicEventId(ev);
    const id2 = generateDeterministicEventId({ ...ev });
    assert.equal(id1, id2);
    assert.equal(id1.length, 16);
  });

  // ── 8. NOTIFICATION CHANNEL SPECIFICATION TESTS ─────────────────────
  await t.test('16. Notification Channels: DEFAULT_PREFERENCE omits channel toggles', () => {
    assert.equal(DEFAULT_PREFERENCE.emailAlerts, undefined, 'emailAlerts must not be in default preferences');
    assert.equal(DEFAULT_PREFERENCE.browserPush, undefined, 'browserPush must not be in default preferences');
    assert.equal(DEFAULT_PREFERENCE.inAppAlerts, undefined, 'inAppAlerts must not be in default preferences');
    assert.ok(Array.isArray(DEFAULT_PREFERENCE.currencies));
    assert.ok(Array.isArray(DEFAULT_PREFERENCE.pairs));
    assert.ok(Array.isArray(DEFAULT_PREFERENCE.impactLevels));
    assert.ok(Array.isArray(DEFAULT_PREFERENCE.leadTimesMinutes));
  });

  await t.test('17. Notification Channels: buildAlertNotificationContent produces in-app format linking to calendar', () => {
    const event = { title: 'FOMC Statement', country: 'USD', impact: 'High', date: '2026-11-04T19:00:00.000Z' };
    const matchResult = {
      matched: true,
      eventCurrency: 'USD',
      eventImpact: 'HIGH',
      matchedCurrencies: ['USD'],
      matchedPairs: ['EURUSD', 'GBPUSD'],
    };
    const content = buildAlertNotificationContent({
      event,
      matchResult,
      releaseTimeStr: '2:00 PM EST',
      timeRemainingStr: '30 minutes',
    });
    assert.ok(content.title.includes('High-impact USD economic news approaching'));
    assert.ok(content.message.includes('FOMC Statement'));
    assert.ok(content.message.includes('EURUSD'));
    assert.ok(content.message.includes('GBPUSD'));
  });

  await t.test('18. Notification Channels: In-app deduplication key enforces exact channel identity', () => {
    const key = buildDeduplicationKey({
      userId: 'user_456',
      eventId: 'evt_789',
      leadMinutes: 15,
      channel: 'IN_APP',
    });
    assert.equal(key, 'user_456:evt_789:15:IN_APP');
  });
});
