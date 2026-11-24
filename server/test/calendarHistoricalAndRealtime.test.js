const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const calendarService = require('../src/services/calendarService');
const calendarRealtimeService = require('../src/services/calendarRealtimeService');
const { createHistoricalRangeFetcher } = require('../src/services/calendarProviders');

let clientUtils;
async function loadClientUtils() {
  if (!clientUtils) {
    const absPath = path.resolve(__dirname, '../../client/src/utils/calendarUtils.js');
    clientUtils = await import(pathToFileURL(absPath).href);
  }
  return clientUtils;
}

test('Economic Calendar Historical Views & Real-Time SSE Suite', async (t) => {
  const utils = await loadClientUtils();

  await t.test('1. resolveDateWindow computes yesterday, last_week, past_7_days, and clamped custom ranges', () => {
    // 2026-11-24 is a Tuesday in UTC and Africa/Lagos
    const nowMs = new Date('2026-11-24T12:00:00.000Z').getTime();

    const yesterday = calendarService.resolveDateWindow({ range: 'yesterday' }, 'Africa/Lagos', nowMs);
    assert.deepEqual(yesterday, {
      range: 'yesterday',
      fromKey: '2026-11-23',
      toKey: '2026-11-23',
      isHistorical: true,
    });

    // Week of 2026-11-24 starts Sun 2026-11-22 -> Last Week is Sun 2026-11-15 .. Sat 2026-11-21
    const lastWeek = calendarService.resolveDateWindow({ range: 'last_week' }, 'UTC', nowMs);
    assert.deepEqual(lastWeek, {
      range: 'last_week',
      fromKey: '2026-11-15',
      toKey: '2026-11-21',
      isHistorical: true,
    });

    const past7 = calendarService.resolveDateWindow({ range: 'past_7_days' }, 'UTC', nowMs);
    assert.deepEqual(past7, {
      range: 'past_7_days',
      fromKey: '2026-11-17',
      toKey: '2026-11-24',
      isHistorical: true,
    });

    // Swapped dates auto-order and clamp span to 31 days max
    const clampedSpan = calendarService.resolveDateWindow(
      { range: 'custom', from: '2026-11-20', to: '2026-10-01' },
      'UTC',
      nowMs
    );
    assert.deepEqual(clampedSpan, {
      range: 'custom',
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
      isHistorical: true,
    });

    // Clamp >365 days back cleanly
    const clampedMin = calendarService.resolveDateWindow(
      { range: 'custom', from: '2020-01-01', to: '2020-01-10' },
      'UTC',
      nowMs
    );
    assert.equal(clampedMin.fromKey, '2025-11-24');
    assert.equal(clampedMin.toKey, '2025-11-24');
  });

  await t.test('2. fetchHistoricalCalendarEvents merges current-week FF/TV rows without duplicating covered days', async () => {
    const nowMs = new Date('2026-11-24T12:00:00.000Z').getTime();

    const mockHistoricalProvider = {
      async fetch() {
        return {
          data: [
            {
              title: 'Core Retail Sales MoM',
              currency: 'USD',
              importance: 1,
              actual: 0.4,
              forecast: 0.3,
              previous: 0.2,
              unit: '%',
              date: '2026-11-20T13:30:00.000Z', // Last week -> keep from TV history
            },
            {
              title: 'German Ifo Business Climate',
              currency: 'EUR',
              importance: 0,
              actual: 85.7,
              forecast: 86.0,
              previous: 86.5,
              date: '2026-11-23T09:00:00.000Z', // Covered by currentWeek -> deduplicated
            },
          ],
          fromCache: false,
          error: null,
        };
      },
    };

    const currentEvents = [
      {
        id: 'ff-ifo-mon',
        title: 'German ifo Business Climate',
        country: 'EUR',
        impact: 'Medium',
        actual: '85.7',
        forecast: '86.0',
        previous: '86.5',
        date: '2026-11-23T09:00:00.000Z',
        provider: 'forexfactory',
      },
    ];

    const merged = await calendarService.fetchHistoricalCalendarEvents({
      fromKey: '2026-11-20',
      toKey: '2026-11-23',
      timeZone: 'UTC',
      nowMs,
      options: {
        historicalProvider: mockHistoricalProvider,
        currentEvents,
      },
    });

    assert.equal(merged.length, 2);
    assert.equal(merged[0].title, 'Core Retail Sales MoM');
    assert.equal(merged[0].actual, '0.4%');
    assert.equal(merged[1].id, 'ff-ifo-mon');
  });

  await t.test('3. createHistoricalRangeFetcher caches past windows, deduplicates in-flight calls, and backs off on 429', async () => {
    let calls = 0;
    const fetcher = createHistoricalRangeFetcher({ maxEntries: 2, pastTtlMs: 60000, currentTtlMs: 1000 });
    const mockFetchImpl = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 15));
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: [{ id: `ev-${calls}`, currency: 'USD', date: '2026-11-10T13:30:00.000Z' }] };
        },
      };
    };

    const nowMs = new Date('2026-11-24T12:00:00.000Z').getTime();
    const [a, b] = await Promise.all([
      fetcher.fetch({ fromIso: '2026-11-09T00:00:00Z', toIso: '2026-11-15T23:59:59Z', nowMs, fetchImpl: mockFetchImpl }),
      fetcher.fetch({ fromIso: '2026-11-09T00:00:00Z', toIso: '2026-11-15T23:59:59Z', nowMs, fetchImpl: mockFetchImpl }),
    ]);

    assert.equal(calls, 1);
    assert.equal(a.data.length, 1);
    assert.equal(b.deduped, true);

    const cachedHit = await fetcher.fetch({
      fromIso: '2026-11-09T00:00:00Z',
      toIso: '2026-11-15T23:59:59Z',
      nowMs: nowMs + 10000,
      fetchImpl: mockFetchImpl,
    });
    assert.equal(calls, 1);
    assert.equal(cachedHit.fromCache, true);
  });

  await t.test('4. subscribeToActualUpdates emits only on new or revised actual values', async () => {
    const received = [];
    const unsubscribe = calendarService.subscribeToActualUpdates((payload) => {
      received.push(payload);
    });

    try {
      const eventIso = '2026-11-24T13:30:00.000Z';
      const nowMs = new Date(eventIso).getTime() + 1000;
      const baseSchedule = {
        async fetch() {
          return {
            data: [
              {
                id: 'USD-CPI-test',
                title: 'CPI m/m',
                country: 'USD',
                date: eventIso,
                impact: 'High',
                actual: '',
                forecast: '0.3%',
                previous: '0.2%',
              },
            ],
          };
        },
      };

      let tvActual = null;
      const mockActuals = {
        async fetch() {
          return {
            data: [
              {
                title: 'CPI MoM',
                currency: 'USD',
                date: eventIso,
                forecast: 0.3,
                previous: 0.2,
                actual: tvActual,
                unit: '%',
              },
            ],
          };
        },
      };

      // Initial populate (no actual yet) -> no emission
      await calendarService.fetchCalendarEvents(true, {
        scheduleProvider: baseSchedule,
        actualsProvider: mockActuals,
        nowMs,
      });
      assert.equal(received.length, 0);

      // Actual arrives -> emits actuals_updated
      tvActual = 0.4;
      await calendarService.fetchCalendarEvents(true, {
        scheduleProvider: baseSchedule,
        actualsProvider: mockActuals,
        nowMs: nowMs + 2000,
      });
      assert.equal(received.length, 1);
      assert.equal(received[0].updatedEvents[0].actual, '0.4%');

      // Re-fetch with same actual -> silent
      await calendarService.fetchCalendarEvents(true, {
        scheduleProvider: baseSchedule,
        actualsProvider: mockActuals,
        nowMs: nowMs + 4000,
      });
      assert.equal(received.length, 1);

      // Revision arrives -> emits again
      tvActual = 0.5;
      await calendarService.fetchCalendarEvents(true, {
        scheduleProvider: baseSchedule,
        actualsProvider: mockActuals,
        nowMs: nowMs + 8000,
      });
      assert.equal(received.length, 2);
      assert.equal(received[1].updatedEvents[0].isRevised, true);
      assert.equal(received[1].updatedEvents[0].previousActual, '0.4%');
    } finally {
      unsubscribe();
    }
  });

  await t.test('5. calendarRealtimeService computes 2s/5s/60s watcher intervals and writes SSE frames', () => {
    const nowMs = new Date('2026-11-24T13:30:05.000Z').getTime();

    assert.equal(
      calendarRealtimeService.computeWatcherIntervalMs(
        [{ date: '2026-11-24T13:30:00.000Z', impact: 'High', actual: '' }],
        nowMs,
        0
      ),
      2000
    );
    assert.equal(
      calendarRealtimeService.computeWatcherIntervalMs(
        [{ date: '2026-11-24T13:30:00.000Z', impact: 'Medium', actual: '' }],
        nowMs,
        0
      ),
      5000
    );
    assert.equal(
      calendarRealtimeService.computeWatcherIntervalMs(
        [{ date: '2026-11-24T13:30:00.000Z', impact: 'High', actual: '0.4%' }],
        nowMs,
        0
      ),
      60000
    );

    const written = [];
    const mockClients = new Set([
      {
        writableEnded: false,
        destroyed: false,
        write(chunk) {
          written.push(chunk);
        },
      },
    ]);

    const delivered = calendarRealtimeService.broadcastActualUpdates(
      { type: 'actuals_updated', syncedAt: '2026-11-24T13:30:05.000Z', updatedEvents: [{ id: 'ev1', actual: '0.4%' }] },
      mockClients
    );

    assert.equal(delivered, 1);
    assert.match(written[0], /^event: actuals_updated\ndata: /);
    assert.match(written[0], /"actual":"0\.4%"/);
    assert.ok(written[0].endsWith('\n\n'));
  });

  await t.test('6. client calendarUtils handles Yesterday/Last Week/Custom ranges, summaries, and live actual merges', () => {
    const nowMs = new Date('2026-11-24T12:00:00.000Z').getTime();

    assert.ok(
      utils.formatDateGroupHeaderInZone('2026-11-23T14:00:00.000Z', 'UTC', nowMs).startsWith('Yesterday — ')
    );

    assert.equal(utils.isEventInSelectedRange('2026-11-23T14:00:00.000Z', 'yesterday', 'UTC', nowMs), true);
    assert.equal(utils.isEventInSelectedRange('2026-11-22T14:00:00.000Z', 'yesterday', 'UTC', nowMs), false);
    assert.equal(utils.isEventInSelectedRange('2026-11-18T14:00:00.000Z', 'last_week', 'UTC', nowMs), true);
    assert.equal(utils.isEventInSelectedRange('2026-11-22T14:00:00.000Z', 'last_week', 'UTC', nowMs), false);
    assert.equal(
      utils.isEventInSelectedRange('2026-11-05T10:00:00.000Z', 'custom', 'UTC', nowMs, {
        from: '2026-11-01',
        to: '2026-11-10',
      }),
      true
    );

    assert.equal(
      utils.buildFilterSummaryText({ range: 'yesterday', currencies: ['USD'] }),
      'Showing: Yesterday · USD · All impacts'
    );
    assert.equal(
      utils.buildFilterSummaryText({ range: 'custom', customFrom: '2026-11-01', customTo: '2026-11-10' }),
      'Showing: 2026-11-01 to 2026-11-10 · All currencies · All impacts'
    );

    const existing = [
      { id: 'ev-1', country: 'USD', title: 'CPI m/m', date: '2026-11-24T13:30:00.000Z', actual: '', forecast: '0.3%' },
      { id: 'ev-2', country: 'EUR', title: 'GDP q/q', date: '2026-11-24T10:00:00.000Z', actual: '0.2%', forecast: '0.2%' },
    ];
    const { events: merged, updatedIds } = utils.mergeLiveActualUpdates(existing, [
      { id: 'ev-1', country: 'USD', title: 'CPI m/m', date: '2026-11-24T13:30:00.000Z', actual: '0.4%', actualVsForecast: 'ABOVE' },
    ]);

    assert.deepEqual(updatedIds, ['ev-1']);
    assert.equal(merged[0].actual, '0.4%');
    assert.equal(merged[0].actualVsForecast, 'ABOVE');
    assert.equal(merged[1].actual, '0.2%');
  });
});
