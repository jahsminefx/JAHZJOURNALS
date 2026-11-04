const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanPairString,
  parseCurrenciesFromPair,
  normalizeImpact,
  isEventMatchingPair,
  generateDeterministicEventId,
  matchEventToUserPreferences,
  buildDeduplicationKey,
  SUPPORTED_FOREX_PAIRS,
} = require('../src/services/currencyMatchingService');
const {
  formatReleaseTime,
  formatLeadTimeString,
} = require('../src/services/economicAlertService');

test('Personal Economic News Alerts Suite', async (t) => {
  // 1. Currency Pair Parsing Tests
  await t.test('1. Currency Pair Parsing: resolves standard 6-character forex pairs', () => {
    assert.deepEqual(parseCurrenciesFromPair('EURUSD'), ['EUR', 'USD']);
    assert.deepEqual(parseCurrenciesFromPair('GBPUSD'), ['GBP', 'USD']);
    assert.deepEqual(parseCurrenciesFromPair('USDJPY'), ['USD', 'JPY']);
    assert.deepEqual(parseCurrenciesFromPair('GBPJPY'), ['GBP', 'JPY']);
    assert.deepEqual(parseCurrenciesFromPair('AUDCAD'), ['AUD', 'CAD']);
    assert.deepEqual(parseCurrenciesFromPair('NZDUSD'), ['NZD', 'USD']);
  });

  await t.test('2. Currency Pair Parsing: normalizes delimiters and case formatting', () => {
    assert.deepEqual(parseCurrenciesFromPair('eur/usd'), ['EUR', 'USD']);
    assert.deepEqual(parseCurrenciesFromPair('GBP-JPY'), ['GBP', 'JPY']);
    assert.deepEqual(parseCurrenciesFromPair(' aud_cad '), ['AUD', 'CAD']);
  });

  await t.test('3. Currency Pair Parsing: handles metals, commodities, and indices gracefully', () => {
    assert.deepEqual(parseCurrenciesFromPair('XAUUSD'), ['USD']);
    assert.deepEqual(parseCurrenciesFromPair('GOLD'), ['USD']);
    assert.deepEqual(parseCurrenciesFromPair('US30'), ['USD']);
    assert.deepEqual(parseCurrenciesFromPair('NAS100'), ['USD']);
    assert.deepEqual(parseCurrenciesFromPair('GER40'), ['EUR']);
    assert.deepEqual(parseCurrenciesFromPair('UK100'), ['GBP']);
    assert.deepEqual(parseCurrenciesFromPair('JPN225'), ['JPY']);
  });

  await t.test('4. Currency Pair Parsing: handles invalid and non-standard instruments without crashing', () => {
    assert.deepEqual(parseCurrenciesFromPair(''), []);
    assert.deepEqual(parseCurrenciesFromPair(null), []);
    assert.deepEqual(parseCurrenciesFromPair(undefined), []);
    assert.deepEqual(parseCurrenciesFromPair('RANDOM_XYZ_123'), []);
  });

  // 2. Intelligent Event-to-Pair Matching Tests
  await t.test('5. isEventMatchingPair: EURUSD matches EUR and USD events', () => {
    const eurEvent = { title: 'ECB Rate Decision', country: 'EUR', impact: 'High' };
    const usdEvent = { title: 'Non-Farm Payrolls', country: 'USD', impact: 'High' };
    const jpyEvent = { title: 'BoJ Rate Decision', country: 'JPY', impact: 'High' };

    assert.equal(isEventMatchingPair(eurEvent, 'EURUSD'), true, 'EURUSD must match EUR events');
    assert.equal(isEventMatchingPair(usdEvent, 'EURUSD'), true, 'EURUSD must match USD events');
    assert.equal(isEventMatchingPair(jpyEvent, 'EURUSD'), false, 'EURUSD must not match JPY events');
  });

  await t.test('6. isEventMatchingPair: GBPJPY matches GBP and JPY events', () => {
    const gbpEvent = { title: 'BoE Official Bank Rate', country: 'GBP', impact: 'High' };
    const jpyEvent = { title: 'Tokyo CPI y/y', country: 'JPY', impact: 'High' };
    const audEvent = { title: 'RBA Rate Statement', country: 'AUD', impact: 'High' };

    assert.equal(isEventMatchingPair(gbpEvent, 'GBPJPY'), true, 'GBPJPY must match GBP events');
    assert.equal(isEventMatchingPair(jpyEvent, 'GBPJPY'), true, 'GBPJPY must match JPY events');
    assert.equal(isEventMatchingPair(audEvent, 'GBPJPY'), false, 'GBPJPY must exclude AUD events');
  });

  // 3. Impact Level Filtering
  await t.test('7. Impact Level Normalization: handles various casing and variants', () => {
    assert.equal(normalizeImpact('High'), 'HIGH');
    assert.equal(normalizeImpact('HIGH'), 'HIGH');
    assert.equal(normalizeImpact('Medium'), 'MEDIUM');
    assert.equal(normalizeImpact('Moderate'), 'MEDIUM');
    assert.equal(normalizeImpact('Low'), 'LOW');
    assert.equal(normalizeImpact('Holiday'), 'HOLIDAY');
    assert.equal(normalizeImpact('UNKNOWN'), null);
  });

  await t.test('8. matchEventToUserPreferences: filters by impact levels independently', () => {
    const highEvent = { title: 'CPI m/m', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const medEvent = { title: 'Building Permits', country: 'USD', impact: 'Medium', date: new Date().toISOString() };
    const lowEvent = { title: 'Treasury Currency Report', country: 'USD', impact: 'Low', date: new Date().toISOString() };

    // Preference: HIGH only
    const highOnlyPref = {
      isEnabled: true,
      pairs: ['EURUSD'],
      impactLevels: ['HIGH'],
    };
    assert.equal(matchEventToUserPreferences(highEvent, highOnlyPref).matched, true);
    assert.equal(matchEventToUserPreferences(medEvent, highOnlyPref).matched, false);
    assert.equal(matchEventToUserPreferences(lowEvent, highOnlyPref).matched, false);

    // Preference: HIGH + MEDIUM
    const highMedPref = {
      isEnabled: true,
      pairs: ['EURUSD'],
      impactLevels: ['HIGH', 'MEDIUM'],
    };
    assert.equal(matchEventToUserPreferences(highEvent, highMedPref).matched, true);
    assert.equal(matchEventToUserPreferences(medEvent, highMedPref).matched, true);
    assert.equal(matchEventToUserPreferences(lowEvent, highMedPref).matched, false);

    // Preference: LOW only
    const lowOnlyPref = {
      isEnabled: true,
      pairs: ['EURUSD'],
      impactLevels: ['LOW'],
    };
    assert.equal(matchEventToUserPreferences(highEvent, lowOnlyPref).matched, false);
    assert.equal(matchEventToUserPreferences(lowEvent, lowOnlyPref).matched, true);
  });

  // 4. Multiple Selected Pairs Matching
  await t.test('9. matchEventToUserPreferences: identifies matching pairs from multi-selection', () => {
    const pref = {
      isEnabled: true,
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'AUDCAD'],
      impactLevels: ['HIGH'],
    };

    // USD event -> matches EURUSD, GBPUSD
    const usdEvent = { title: 'Federal Funds Rate', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const usdMatch = matchEventToUserPreferences(usdEvent, pref);
    assert.equal(usdMatch.matched, true);
    assert.deepEqual(usdMatch.matchingPairs.sort(), ['EURUSD', 'GBPUSD'].sort());

    // JPY event -> matches GBPJPY
    const jpyEvent = { title: 'BoJ Press Conference', country: 'JPY', impact: 'High', date: new Date().toISOString() };
    const jpyMatch = matchEventToUserPreferences(jpyEvent, pref);
    assert.equal(jpyMatch.matched, true);
    assert.deepEqual(jpyMatch.matchingPairs, ['GBPJPY']);

    // CHF event -> not in selected pairs
    const chfEvent = { title: 'SNB Interest Rate', country: 'CHF', impact: 'High', date: new Date().toISOString() };
    const chfMatch = matchEventToUserPreferences(chfEvent, pref);
    assert.equal(chfMatch.matched, false);
    assert.ok(chfMatch.reason === 'NO_MATCHING_PAIRS' || chfMatch.reason === 'NO_MATCHING_TARGETS');
  });

  // 5. Disabled Preferences Handling
  await t.test('10. matchEventToUserPreferences: stops all notifications when disabled', () => {
    const disabledPref = {
      isEnabled: false,
      pairs: ['EURUSD'],
      impactLevels: ['HIGH'],
    };
    const event = { title: 'NFP', country: 'USD', impact: 'High', date: new Date().toISOString() };
    const result = matchEventToUserPreferences(event, disabledPref);
    assert.equal(result.matched, false);
    assert.ok(result.reason === 'PREFERENCES_DISABLED' || result.reason === 'GLOBAL_ALERTS_DISABLED');
  });

  // 6. Deduplication Key & Deterministic ID
  await t.test('11. buildDeduplicationKey: produces deterministic and stable compound keys', () => {
    const key1 = buildDeduplicationKey({
      userId: 'user-123',
      eventId: 'evt-456',
      leadMinutes: 15,
      channel: 'IN_APP',
    });
    const key2 = buildDeduplicationKey({
      userId: 'user-123',
      eventId: 'evt-456',
      leadMinutes: 15,
      channel: 'in_app',
    });
    assert.equal(key1, 'user-123:evt-456:15:IN_APP');
    assert.equal(key1, key2, 'Case differences in channel must normalize to same key');
  });

  await t.test('12. buildDeduplicationKey: rejects incomplete parameter sets', () => {
    assert.throws(() => {
      buildDeduplicationKey({ userId: 'u1', eventId: 'e1' });
    });
  });

  await t.test('13. generateDeterministicEventId: generates consistent hash across syncs', () => {
    const eventA = {
      title: 'US Core CPI m/m',
      country: 'USD',
      date: '2026-11-05T13:30:00.000Z',
    };
    const eventB = {
      title: 'US Core CPI m/m',
      country: 'USD',
      date: '2026-11-05T13:30:00.000Z',
    };
    assert.equal(generateDeterministicEventId(eventA), generateDeterministicEventId(eventB));
  });

  // 7. Timezone & Lead Time Formatting
  await t.test('14. formatReleaseTime: formats time according to trader timezone', () => {
    const testDate = new Date('2026-11-05T13:30:00.000Z');
    const nyTime = formatReleaseTime(testDate, 'America/New_York');
    const londonTime = formatReleaseTime(testDate, 'Europe/London');

    assert.ok(nyTime.includes('AM') || nyTime.includes('PM'));
    assert.ok(londonTime.includes('AM') || londonTime.includes('PM'));
    assert.notEqual(nyTime, londonTime, 'New York and London times should differ');
  });

  await t.test('15. formatLeadTimeString: formats minute and hourly thresholds cleanly', () => {
    assert.equal(formatLeadTimeString(15), '15 minutes');
    assert.equal(formatLeadTimeString(30), '30 minutes');
    assert.equal(formatLeadTimeString(60), '1 hour(s)');
    assert.equal(formatLeadTimeString(1440), '1 hour(s)'); // 24 hours
  });
});
