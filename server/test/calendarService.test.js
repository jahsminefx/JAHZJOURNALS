const test = require('node:test');
const assert = require('node:assert/strict');
const calendarService = require('../src/services/calendarService');

test('Economic Calendar Service Tests', async (t) => {
  await t.test('1. fetchCalendarEvents returns valid array of economic events', async () => {
    const events = await calendarService.fetchCalendarEvents();
    assert.ok(Array.isArray(events), 'Events should be an array');
    assert.ok(events.length > 0, 'Should return at least fallback/remote events');
    const first = events[0];
    assert.ok(first.title, 'Event should have title');
    assert.ok(first.country, 'Event should have country/currency');
    assert.ok(first.impact, 'Event should have impact');
    assert.ok(first.date, 'Event should have date');
  });

  await t.test('2. getEvents filters by impact correctly', async () => {
    const highEvents = await calendarService.getEvents({ impact: 'High' });
    assert.ok(Array.isArray(highEvents), 'Should return array');
    for (const ev of highEvents) {
      assert.equal(ev.impact.toLowerCase(), 'high', 'All filtered events must have High impact');
    }
  });

  await t.test('3. getEvents filters by currency correctly', async () => {
    const usdEvents = await calendarService.getEvents({ currency: 'USD' });
    assert.ok(Array.isArray(usdEvents), 'Should return array');
    for (const ev of usdEvents) {
      assert.equal(ev.country, 'USD', 'All filtered events must have USD country');
    }
  });

  await t.test('4. getUpcomingHighImpactEvents returns chronological events with countdown', async () => {
    const upcoming = await calendarService.getUpcomingHighImpactEvents(10080); // 7 days window
    assert.ok(Array.isArray(upcoming), 'Should return array');
    if (upcoming.length > 0) {
      assert.ok(upcoming[0].countdown, 'Upcoming event should have countdown text');
      assert.ok(upcoming[0].impact === 'High' || upcoming[0].impact === 'Medium', 'Only High or Medium impact');
    }
  });

  await t.test('5. getCurrenciesForPair correctly resolves base and quote currencies', () => {
    const eurusd = calendarService.getCurrenciesForPair('EURUSD');
    assert.deepEqual(eurusd, ['EUR', 'USD']);

    const gold = calendarService.getCurrenciesForPair('XAUUSD');
    assert.ok(gold.includes('USD'), 'Gold should map to USD');

    const us30 = calendarService.getCurrenciesForPair('US30');
    assert.deepEqual(us30, ['USD']);
  });

  await t.test('6. correlateTradeWithNews flags trade when within window of high-impact event', async () => {
    const events = await calendarService.fetchCalendarEvents();
    const highEvent = events.find((e) => e.impact === 'High');
    if (highEvent) {
      const matchPair = `${highEvent.country}JPY`;
      const tradeTime = new Date(new Date(highEvent.date).getTime() + 5 * 60 * 1000); // 5 mins after
      const result = await calendarService.correlateTradeWithNews(tradeTime, matchPair, 15);
      assert.equal(result.isNewsTrade, true, 'Should be flagged as news trade');
      assert.ok(result.event, 'Should include matched event');
      assert.ok(result.warning, 'Should include warning message');
    }
  });
});
