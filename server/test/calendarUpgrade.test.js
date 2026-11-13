const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const calendarService = require('../src/services/calendarService');
const {
  ManagedFeedProvider,
  ReleaseObservationStore,
} = require('../src/services/calendarProviders');
const {
  DEFAULT_CALENDAR_PREFERENCES,
  validateAndSanitizeCalendarPreferences,
} = require('../src/services/economicAlertService');
const {
  matchEventToUserPreferences,
  getCorrelatedCurrencies,
} = require('../src/services/currencyMatchingService');

let clientUtils;

async function loadClientUtils() {
  if (!clientUtils) {
    const absPath = path.resolve(__dirname, '../../client/src/utils/calendarUtils.js');
    clientUtils = await import(pathToFileURL(absPath).href);
  }
  return clientUtils;
}

test('Economic Calendar Upgrade Comprehensive Suite', async (t) => {
  const utils = await loadClientUtils();

  await t.test('1. Time-zone conversion handles DST boundaries, Africa/Lagos, UTC, and invalid fallbacks', () => {
    // Winter (Jan 15 2026 13:30 UTC) vs Summer (Jul 15 2026 13:30 UTC)
    const winterIso = '2026-01-15T13:30:00.000Z';
    const summerIso = '2026-07-15T13:30:00.000Z';

    // America/New_York: 13:30 UTC -> 08:30 AM (EST, -05:00) in winter, 09:30 AM (EDT, -04:00) in summer
    assert.equal(utils.formatEventTimeInZone(winterIso, 'America/New_York', '24h'), '08:30');
    assert.equal(utils.formatEventTimeInZone(summerIso, 'America/New_York', '24h'), '09:30');
    assert.equal(utils.formatEventTimeInZone(winterIso, 'America/New_York', '12h'), '8:30 AM');

    // Europe/London: 13:30 UTC -> 13:30 (GMT) in winter, 14:30 (BST) in summer
    assert.equal(utils.formatEventTimeInZone(winterIso, 'Europe/London', '24h'), '13:30');
    assert.equal(utils.formatEventTimeInZone(summerIso, 'Europe/London', '24h'), '14:30');

    // Africa/Lagos: always UTC+01:00 -> 14:30 / 2:30 PM
    assert.equal(utils.formatEventTimeInZone(winterIso, 'Africa/Lagos', '24h'), '14:30');
    assert.equal(utils.formatEventTimeInZone(summerIso, 'Africa/Lagos', '12h'), '2:30 PM');

    const lagosBadge = utils.formatTimeZoneBadge('Africa/Lagos', new Date(winterIso));
    assert.match(lagosBadge, /Africa\/Lagos/);
    assert.match(lagosBadge, /UTC\+01:00/);

    // Invalid timezone safety
    assert.equal(calendarService.isValidTimeZone('Mars/Olympus_Mons'), false);
    assert.equal(calendarService.isValidTimeZone('Africa/Lagos'), true);
    assert.equal(utils.formatEventTimeInZone(winterIso, 'Mars/Olympus_Mons', '24h'), '13:30');
  });

  await t.test('2. Date grouping and Today/Tomorrow boundaries shift accurately across time zones', () => {
    // Now = 2026-11-13T18:00:00Z
    // Event = 2026-11-13T23:30:00Z
    // In UTC: 2026-11-13 (Today)
    // In Africa/Lagos (UTC+1): 2026-11-14 00:30 (Tomorrow!)
    const nowMs = new Date('2026-11-13T18:00:00.000Z').getTime();
    const lateEventIso = '2026-11-13T23:30:00.000Z';

    assert.equal(utils.isEventInSelectedRange(lateEventIso, 'today', 'UTC', nowMs), true);
    assert.equal(utils.isEventInSelectedRange(lateEventIso, 'tomorrow', 'UTC', nowMs), false);

    assert.equal(utils.isEventInSelectedRange(lateEventIso, 'today', 'Africa/Lagos', nowMs), false);
    assert.equal(utils.isEventInSelectedRange(lateEventIso, 'tomorrow', 'Africa/Lagos', nowMs), true);

    const utcHeader = utils.formatDateGroupHeaderInZone(lateEventIso, 'UTC', nowMs);
    const lagosHeader = utils.formatDateGroupHeaderInZone(lateEventIso, 'Africa/Lagos', nowMs);
    assert.ok(utcHeader.startsWith('Today — '), `Expected Today header in UTC, got: ${utcHeader}`);
    assert.ok(lagosHeader.startsWith('Tomorrow — '), `Expected Tomorrow header in Lagos, got: ${lagosHeader}`);
  });

  await t.test('3. Guest localStorage persistence, validation fallbacks, and filter summary clarity', () => {
    // Mock Storage
    const store = new Map();
    const mockStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };

    assert.equal(utils.hasCustomGuestPreferences(mockStorage), false);

    // Save custom guest preferences
    utils.saveGuestCalendarPreferences(
      {
        useDeviceTimezone: false,
        timezone: 'Africa/Lagos',
        timeFormat: '24h',
        defaultView: 'today',
        currencies: ['EUR', 'USD'],
        impacts: ['High', 'Medium'],
        density: 'compact',
        preNewsBufferMinutes: 10,
        postNewsBufferMinutes: 10,
      },
      mockStorage
    );

    assert.equal(utils.hasCustomGuestPreferences(mockStorage), true);
    const loaded = utils.loadGuestCalendarPreferences(mockStorage);
    assert.equal(loaded.timezone, 'Africa/Lagos');
    assert.equal(loaded.timeFormat, '24h');
    assert.equal(loaded.defaultView, 'today');
    assert.equal(loaded.density, 'compact');
    assert.equal(loaded.preNewsBufferMinutes, 10);

    // Corrupt JSON fallback
    mockStorage.setItem(utils.GUEST_CALENDAR_PREFS_STORAGE_KEY, '{corrupt-json');
    const recovered = utils.loadGuestCalendarPreferences(mockStorage);
    assert.equal(recovered.timezone, 'UTC');
    assert.equal(recovered.timeFormat, '12h');

    // Server validator sanitizes invalid fields cleanly
    const serverSanitized = validateAndSanitizeCalendarPreferences({
      useDeviceTimezone: false,
      timezone: 'Invalid/Timezone',
      timeFormat: '99h',
      defaultView: 'decade',
      density: 'huge',
      preNewsBufferMinutes: 999,
      postNewsBufferMinutes: -5,
      impacts: ['HIGH', 'bogus'],
      categories: ['INFLATION', 'FAKE_CAT'],
    });
    assert.equal(serverSanitized.timezone, 'UTC');
    assert.equal(serverSanitized.timeFormat, DEFAULT_CALENDAR_PREFERENCES.timeFormat);
    assert.equal(serverSanitized.defaultView, 'this_week');
    assert.equal(serverSanitized.density, 'comfortable');
    assert.equal(serverSanitized.preNewsBufferMinutes, 5);
    assert.equal(serverSanitized.postNewsBufferMinutes, 5);
    assert.deepEqual(serverSanitized.impacts, ['High']);
    assert.deepEqual(serverSanitized.categories, ['INFLATION']);

    // Filter summary & equality checks
    const summary = utils.buildFilterSummaryText({
      range: 'today',
      currencies: ['EUR'],
      impacts: ['High', 'Medium'],
    });
    assert.equal(summary, 'Showing: Today · EUR · High + Medium impact');
    assert.equal(utils.areFiltersEqualToSavedPreferences({ range: 'today', currencies: ['EUR', 'USD'], impacts: ['High', 'Medium'], categories: [] }, loaded), true);
    assert.equal(utils.areFiltersEqualToSavedPreferences({ range: 'this_week', currencies: ['EUR', 'USD'], impacts: ['High', 'Medium'], categories: [] }, loaded), false);
  });

  await t.test('4. Category classification, watched pairs + correlated currencies, and alert matching', () => {
    const samples = [
      ['CPI m/m', 'High', 'INFLATION'],
      ['Non-Farm Employment Change', 'High', 'EMPLOYMENT'],
      ['FOMC Statement', 'High', 'CENTRAL_BANKS'],
      ['Advance GDP q/q', 'High', 'GROWTH_GDP'],
      ['Flash Manufacturing PMI', 'Medium', 'PMI_BUSINESS'],
      ['CB Consumer Confidence', 'High', 'CONSUMER_SENTIMENT'],
      ['Trade Balance', 'Medium', 'TRADE'],
      ['Building Permits', 'Low', 'HOUSING'],
      ['Bank Holiday', 'Holiday', 'HOLIDAYS'],
    ];

    for (const [title, impact, expectedCat] of samples) {
      assert.equal(calendarService.classifyEventCategory(title, impact), expectedCat);
      assert.equal(utils.classifyEventCategoryClient(title, impact), expectedCat);
    }

    // Correlated currencies toggle
    const directOnly = utils.resolveWatchedCurrencies(['EURUSD'], false);
    const withCorrelated = utils.resolveWatchedCurrencies(['EURUSD'], true);
    assert.deepEqual(directOnly.sort(), ['EUR', 'USD']);
    assert.ok(withCorrelated.includes('CHF'));
    assert.ok(withCorrelated.includes('CAD'));
    assert.ok(getCorrelatedCurrencies(['EUR']).includes('CHF'));

    // Category-aware alert matching
    const cpiEvent = { title: 'Core CPI m/m', country: 'USD', impact: 'High', date: '2026-11-13T13:30:00Z' };
    const prefWithInflation = {
      isEnabled: true,
      targetingMode: 'CURRENCIES_ONLY',
      currencies: ['USD'],
      impactLevels: ['HIGH'],
      categories: ['INFLATION'],
    };
    const prefEmploymentOnly = {
      ...prefWithInflation,
      categories: ['EMPLOYMENT'],
    };

    assert.equal(matchEventToUserPreferences(cpiEvent, prefWithInflation).matched, true);
    assert.equal(matchEventToUserPreferences(cpiEvent, prefEmploymentOnly).matched, false);
    assert.equal(matchEventToUserPreferences(cpiEvent, prefEmploymentOnly).reason, 'CATEGORY_NOT_SUBSCRIBED');
  });

  await t.test('5. Release states (Scheduled -> Awaiting -> Released -> Revised / Delayed) & Prop-Firm buffer', () => {
    const scheduledIso = '2026-11-13T11:00:00.000Z';
    const scheduledMs = new Date(scheduledIso).getTime();

    // T - 45s -> SCHEDULED
    const beforeDisplay = utils.getEventReleaseDisplay(
      { date: scheduledIso, impact: 'High', forecast: '0.3%', previous: '0.2%', actual: '' },
      scheduledMs - 45000,
      'UTC',
      '24h'
    );
    assert.equal(beforeDisplay.state, 'SCHEDULED');
    assert.equal(beforeDisplay.label, 'in 45s');

    // T + 1m with no actual -> AWAITING_RELEASE
    const awaitingDisplay = utils.getEventReleaseDisplay(
      { date: scheduledIso, impact: 'High', forecast: '0.3%', previous: '0.2%', actual: '' },
      scheduledMs + 60000,
      'UTC',
      '24h'
    );
    assert.equal(awaitingDisplay.state, 'AWAITING_RELEASE');
    assert.equal(awaitingDisplay.actualText, 'Awaiting release');

    // T + 6m with 5m post-buffer STILL AWAITING_RELEASE -> prop firm risk window stays active!
    const riskHeldWhileAwaiting = computeRisk(scheduledIso, scheduledMs + 6 * 60000, '');
    assert.equal(riskHeldWhileAwaiting.level, 'CRITICAL');

    // T + 2m actual arrives via ReleaseObservationStore -> RELEASED with receivedAt
    const obsStore = new ReleaseObservationStore();
    obsStore.observe(
      { country: 'EUR', title: 'Core CPI m/m', date: scheduledIso, actual: '' },
      scheduledMs - 60000
    );
    const firstArrival = obsStore.observe(
      { country: 'EUR', title: 'Core CPI m/m', date: scheduledIso, actual: '0.4%' },
      scheduledMs + 2 * 60000
    );
    assert.ok(firstArrival.receivedAt);
    assert.equal(firstArrival.isRevised, false);

    const releasedDisplay = utils.getEventReleaseDisplay(
      {
        date: scheduledIso,
        impact: 'High',
        forecast: '0.3%',
        previous: '0.2%',
        actual: '0.4%',
        receivedAt: firstArrival.receivedAt,
      },
      scheduledMs + 2 * 60000,
      'UTC',
      '24h'
    );
    assert.equal(releasedDisplay.state, 'RELEASED');
    assert.equal(releasedDisplay.timingSublabel, 'Scheduled 11:00 · received 11:02');

    // T + 6m after RELEASED with 5m post buffer -> risk window clears!
    const riskClearedAfterBuffer = computeRisk(scheduledIso, scheduledMs + 6 * 60000, '0.4%');
    assert.equal(riskClearedAfterBuffer.level, 'CLEAR');

    // Revision from 0.4% -> 0.5% -> REVISED
    const revisedMeta = obsStore.observe(
      { country: 'EUR', title: 'Core CPI m/m', date: scheduledIso, actual: '0.5%' },
      scheduledMs + 5 * 60000
    );
    assert.equal(revisedMeta.isRevised, true);
    assert.equal(revisedMeta.previousActual, '0.4%');
    const revisedDisplay = utils.getEventReleaseDisplay(
      {
        date: scheduledIso,
        impact: 'High',
        actual: '0.5%',
        isRevised: revisedMeta.isRevised,
        previousActual: revisedMeta.previousActual,
        receivedAt: revisedMeta.receivedAt,
      },
      scheduledMs + 5 * 60000,
      'UTC',
      '24h'
    );
    assert.equal(revisedDisplay.state, 'REVISED');

    // T + 18m still no actual -> DELAYED
    const delayedDisplay = utils.getEventReleaseDisplay(
      { date: scheduledIso, impact: 'High', forecast: '0.3%', previous: '0.2%', actual: '' },
      scheduledMs + 18 * 60000,
      'UTC',
      '24h'
    );
    assert.equal(delayedDisplay.state, 'DELAYED');
    assert.equal(delayedDisplay.label, 'Delayed / time tentative');

    function computeRisk(iso, now, actualVal) {
      return utils.computePropFirmRiskStatus(
        [{ country: 'EUR', title: 'CPI', impact: 'High', date: iso, forecast: '0.3%', actual: actualVal }],
        now,
        5,
        5
      );
    }
  });

  await t.test('6. Adaptive refresh scheduling, request deduplication, and 429 rate-limit protection', async () => {
    const now = Date.now();
    // Normal
    assert.equal(utils.getAdaptiveRefreshPlan([], now, 0).intervalMs, 120000);
    // Medium window
    assert.equal(
      utils.getAdaptiveRefreshPlan([{ impact: 'Medium', date: new Date(now + 10000).toISOString(), actual: '' }], now, 0).intervalMs,
      15000
    );
    // High window
    assert.equal(
      utils.getAdaptiveRefreshPlan([{ impact: 'High', date: new Date(now + 10000).toISOString(), actual: '' }], now, 0).intervalMs,
      4000
    );
    // Exponential backoff on errors
    assert.equal(
      utils.getAdaptiveRefreshPlan([{ impact: 'High', date: new Date(now + 10000).toISOString(), actual: '' }], now, 2).intervalMs,
      16000
    );

    // ManagedFeedProvider deduplication + 429 rate limit backoff
    let upstreamCalls = 0;
    const provider = new ManagedFeedProvider({
      name: 'test-provider',
      ttlMs: 60000,
      minCooldownMs: 4000,
      fetcher: async () => {
        upstreamCalls++;
        await new Promise((r) => setTimeout(r, 25));
        return [{ id: 'ev1', title: 'Test Event' }];
      },
    });

    const [r1, r2, r3] = await Promise.all([
      provider.fetch({ force: true, nowMs: 100000 }),
      provider.fetch({ force: true, nowMs: 100000 }),
      provider.fetch({ force: true, nowMs: 100000 }),
    ]);
    assert.equal(upstreamCalls, 1, 'Concurrent calls must deduplicate into 1 upstream request');
    assert.equal(r1.data.length, 1);
    assert.equal(r2.deduped || r3.deduped, true);

    // Rate-limit protection returns cached data & enters cooldown
    const rlProvider = new ManagedFeedProvider({
      name: 'rl-provider',
      ttlMs: 10,
      minCooldownMs: 10,
      fetcher: async () => {
        const err = new Error('Too Many Requests');
        err.status = 429;
        throw err;
      },
    });
    rlProvider.cache = [{ id: 'cached-1' }];
    const rlRes = await rlProvider.fetch({ force: true, nowMs: 500000 });
    assert.equal(rlRes.data[0].id, 'cached-1');
    assert.equal(rlProvider.getHealth(500100).inCooldown, true);
  });

  await t.test('7. Settings modal accessibility and permission-request restraint verified', () => {
    const modalPath = path.resolve(__dirname, '../../client/src/components/calendar/CalendarPreferencesModal.jsx');
    const modalSource = fs.readFileSync(modalPath, 'utf8');

    assert.match(modalSource, /role="dialog"/);
    assert.match(modalSource, /aria-modal="true"/);
    assert.match(modalSource, /e\.key === 'Escape'/);
    assert.match(modalSource, /role="listbox"/);
    assert.match(modalSource, /triggerRef\?\.current/);
    // Must not call Notification.requestPermission automatically
    assert.doesNotMatch(modalSource, /Notification\.requestPermission/);
  });
});
