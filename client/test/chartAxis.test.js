import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateYAxisDomain,
  detectInitialDepositJump,
  formatAxisCurrency,
  formatAxisDate,
  generateXAxisTicks,
  generateYAxisTicks,
  prepareAccountBalanceDisplayPoints,
  selectNiceTickInterval,
} from '../src/utils/chartAxis.js';

const hasClockTimestamp = (label) => /\b\d{1,2}:\d{2}\b|\bAM\b|\bPM\b/i.test(String(label || ''));

test('selectNiceTickInterval selects clean rounded intervals across scales', () => {
  assert.equal(selectNiceTickInterval(10000, 5), 2500);
  assert.equal(selectNiceTickInterval(2000, 5), 500);
  assert.equal(selectNiceTickInterval(1000, 5), 250);
  assert.equal(selectNiceTickInterval(180, 5), 50);
  assert.equal(selectNiceTickInterval(0, 5), 10);
});

test('account balance scaling eliminates awkward intervals after initial deposit jumps and pre-deposit dips', () => {
  const preDepositDipPoints = [
    { date: '2026-07-06T10:00:00Z', value: -92, eventType: 'trade_loss', change: -92 },
    { date: '2026-07-10T00:00:00Z', value: 9908, eventType: 'deposit', change: 10000, source: 'startingBalance' },
    { date: '2026-07-15T12:00:00Z', value: 10374, eventType: 'trade_win', change: 466 },
  ];

  const config = calculateYAxisDomain(preDepositDipPoints, { mode: 'accountBalance' });
  assert.deepEqual(config.ticks, [0, 2500, 5000, 7500, 10000, 12500]);
  assert.ok(config.domain[0] < -92 && config.domain[0] >= -250);
  assert.equal(config.domain[1], 12500);
  assert.equal(config.ticks.some((v) => String(v).endsWith('16') || String(v).endsWith('84')), false);
});

test('account balance domain adapts cleanly to newly funded, medium, narrow, multiple funding, and near-zero datasets', () => {
  // Newly funded account ($0 -> $10k)
  const newlyFunded = calculateYAxisDomain([
    { date: '2026-07-10T00:00:00Z', value: 0, eventType: 'account_start' },
    { date: '2026-07-10T00:00:00Z', value: 10000, eventType: 'deposit', change: 10000 },
  ], { mode: 'accountBalance' });
  assert.deepEqual(newlyFunded.ticks, [0, 2500, 5000, 7500, 10000]);

  // Medium balance range (~$8k to ~$10k)
  const mediumRange = calculateYAxisDomain([
    { date: '2026-08-01T00:00:00Z', value: 8120 },
    { date: '2026-08-15T00:00:00Z', value: 9880 },
  ], { mode: 'accountBalance' });
  assert.deepEqual(mediumRange.ticks, [8000, 8500, 9000, 9500, 10000]);

  // Narrow balance range (~$9k to ~$10k)
  const narrowRange = calculateYAxisDomain([
    { date: '2026-09-01T00:00:00Z', value: 9180 },
    { date: '2026-09-15T00:00:00Z', value: 9920 },
  ], { mode: 'accountBalance' });
  assert.deepEqual(narrowRange.ticks, [9000, 9250, 9500, 9750, 10000]);

  // Multiple deposits and withdrawals keeping clean rounded intervals
  const multiFunding = calculateYAxisDomain([
    { date: '2026-07-01T00:00:00Z', value: 0, eventType: 'account_start' },
    { date: '2026-07-02T00:00:00Z', value: 5000, eventType: 'deposit', change: 5000 },
    { date: '2026-07-15T00:00:00Z', value: 3500, eventType: 'withdrawal', change: -1500 },
    { date: '2026-08-01T00:00:00Z', value: 8500, eventType: 'deposit', change: 5000 },
  ], { mode: 'accountBalance' });
  assert.deepEqual(multiFunding.ticks, [0, 2500, 5000, 7500, 10000]);

  // Balances close to zero and flat zero balance
  const nearZero = calculateYAxisDomain([
    { date: '2026-10-01T00:00:00Z', value: 2 },
    { date: '2026-10-02T00:00:00Z', value: 18 },
  ], { mode: 'accountBalance' });
  assert.deepEqual(nearZero.ticks, [0, 5, 10, 15, 20]);

  const flatZero = generateYAxisTicks([
    { date: '2026-10-01T00:00:00Z', value: 0 },
    { date: '2026-10-02T00:00:00Z', value: 0 },
  ], { mode: 'accountBalance' });
  assert.deepEqual(flatZero, [0, 250, 500, 750, 1000]);
});

test('cumulative P/L domain always includes zero and handles negative, positive, and mixed curves', () => {
  const mixed = calculateYAxisDomain([
    { date: '2026-07-01T00:00:00Z', value: 0 },
    { date: '2026-07-06T00:00:00Z', value: -387 },
    { date: '2026-08-04T00:00:00Z', value: 1742 },
  ], { mode: 'cumulativePnl' });
  assert.deepEqual(mixed.ticks, [-500, 0, 500, 1000, 1500, 2000]);
  assert.ok(mixed.ticks.includes(0));

  const negativeOnly = calculateYAxisDomain([
    { date: '2026-07-01T00:00:00Z', value: 0 },
    { date: '2026-07-06T00:00:00Z', value: -420 },
  ], { mode: 'cumulativePnl' });
  assert.equal(negativeOnly.domain[1], 0);
  assert.ok(negativeOnly.ticks.includes(0));
});

test('formatAxisCurrency formats abbreviated clean values across multiple currencies', () => {
  assert.equal(formatAxisCurrency(0, 'USD'), '$0');
  assert.equal(formatAxisCurrency(2500, 'USD'), '$2.5k');
  assert.equal(formatAxisCurrency(9250, 'USD'), '$9.25k');
  assert.equal(formatAxisCurrency(10000, 'USD'), '$10k');
  assert.equal(formatAxisCurrency(-2500, 'EUR'), '-€2.5k');
  assert.equal(formatAxisCurrency(500, 'GBP'), '£500');
  assert.equal(formatAxisCurrency(150000, 'JPY'), '¥150k');
  assert.equal(formatAxisCurrency(10000, 'AED'), 'AED 10k');
});

test('X-axis formatting adapts consistently per timeframe without timestamps or duplicates', () => {
  const weekPoints = [
    { date: '2026-11-16T09:00:00Z', value: 100 },
    { date: '2026-11-17T14:30:00Z', value: 250 },
    { date: '2026-11-18T11:15:00Z', value: 190 },
    { date: '2026-11-19T21:58:00Z', value: 420 },
  ];
  const x7d = generateXAxisTicks(weekPoints, { activeRange: '7d', timeZone: 'UTC' });
  const labels7d = x7d.ticks.map((d) => formatAxisDate(d, { activeRange: '7d', ...x7d.meta, timeZone: 'UTC' }));
  assert.deepEqual(labels7d, ['Mon', 'Tue', 'Wed', 'Thu']);
  assert.equal(labels7d.some(hasClockTimestamp), false);

  const monthPoints = Array.from({ length: 12 }, (_, idx) => ({
    date: new Date(Date.UTC(2026, 10, idx * 2 + 1, 15, 30)).toISOString(),
    value: idx * 100,
  }));
  const x30d = generateXAxisTicks(monthPoints, { activeRange: '30d', isMobile: false, timeZone: 'UTC' });
  const labels30d = x30d.ticks.map((d) => formatAxisDate(d, { activeRange: '30d', ...x30d.meta, timeZone: 'UTC' }));
  assert.equal(labels30d.some(hasClockTimestamp), false);
  assert.equal(new Set(labels30d).size, labels30d.length);
  assert.ok(labels30d.every((label) => /^Nov \d{1,2}$/.test(label)));

  const yearPoints = [
    { date: '2026-01-10T10:00:00Z', value: 100 },
    { date: '2026-03-15T10:00:00Z', value: 300 },
    { date: '2026-06-20T10:00:00Z', value: 500 },
    { date: '2026-09-14T14:08:00Z', value: 900 },
  ];
  const x1y = generateXAxisTicks(yearPoints, { activeRange: 'thisYear', timeZone: 'UTC' });
  const labels1y = x1y.ticks.map((d) => formatAxisDate(d, { activeRange: 'thisYear', ...x1y.meta, timeZone: 'UTC' }));
  assert.deepEqual(labels1y, ['Jan', 'Mar', 'Jun', 'Sep']);

  const allSameYear = [
    { date: '2026-07-10T00:00:00Z', value: 10000 },
    { date: '2026-08-26T23:05:00Z', value: 10150 },
    { date: '2026-09-01T13:42:00Z', value: 10240 },
    { date: '2026-09-01T18:12:00Z', value: 10280 },
    { date: '2026-11-19T21:58:00Z', value: 10374 },
  ];
  const xAll = generateXAxisTicks(allSameYear, { activeRange: 'all', timeZone: 'UTC' });
  const labelsAll = xAll.ticks.map((d) => formatAxisDate(d, { activeRange: 'all', ...xAll.meta, timeZone: 'UTC' }));
  assert.equal(labelsAll.some(hasClockTimestamp), false);
  assert.equal(new Set(labelsAll).size, labelsAll.length);
  assert.deepEqual(labelsAll, ['Jul 10', 'Aug 26', 'Sep 1', 'Nov 19']);

  const multiYear = [
    { date: '2025-07-10T00:00:00Z', value: 10000 },
    { date: '2026-09-14T14:08:00Z', value: 10450 },
  ];
  const xMulti = generateXAxisTicks(multiYear, { activeRange: 'all', timeZone: 'UTC' });
  const labelsMulti = xMulti.ticks.map((d) => formatAxisDate(d, { activeRange: 'all', ...xMulti.meta, timeZone: 'UTC' }));
  assert.equal(labelsMulti.some((label) => /25|26|2025|2026/.test(label)), true);
  assert.equal(labelsMulti.some(hasClockTimestamp), false);
});

test('detectInitialDepositJump identifies initial deposit funding events and post-funding bounds without mutating data', () => {
  const points = [
    { date: '2026-07-06T00:00:00Z', value: -92, eventType: 'trade_loss', change: -92 },
    { date: '2026-07-10T00:00:00Z', value: 9908, eventType: 'deposit', change: 10000, source: 'startingBalance' },
    { date: '2026-08-01T00:00:00Z', value: 9815.66, eventType: 'trade_loss', change: -92.34 },
    { date: '2026-09-01T00:00:00Z', value: 10374, eventType: 'trade_win', change: 558.34 },
  ];

  const jumpInfo = detectInitialDepositJump(points);
  assert.equal(jumpInfo.hasInitialDepositJump, true);
  assert.equal(jumpInfo.initialDepositIndex, 1);
  assert.equal(jumpInfo.initialDepositPoint.change, 10000);
  assert.equal(jumpInfo.postDepositMin, 9815.66);
  assert.equal(jumpInfo.postDepositMax, 10374);

  const nonJump = detectInitialDepositJump([
    { date: '2026-07-01T00:00:00Z', value: 10000, eventType: 'account_start' },
    { date: '2026-07-05T00:00:00Z', value: 10350, eventType: 'trade_win', change: 350 },
  ]);
  assert.equal(nonJump.hasInitialDepositJump, false);
});

test('prepareAccountBalanceDisplayPoints starts curve at initial funding balance and preserves subsequent activity', () => {
  // Single account funded with $10,000 followed by trades & withdrawal
  const rawSeries = [
    { date: '2026-07-08T00:00:00Z', value: 0, change: 0, eventType: 'account_start', label: 'Account created' },
    { date: '2026-07-08T00:00:00Z', value: 10000, change: 10000, eventType: 'deposit', label: 'Deposit', source: 'startingBalance' },
    { date: '2026-07-12T10:00:00Z', value: 9650, change: -350, eventType: 'trade_loss', label: 'Closed trade', result: 'LOSS' },
    { date: '2026-07-18T14:00:00Z', value: 10250, change: 600, eventType: 'trade_win', label: 'Closed trade', result: 'WIN' },
    { date: '2026-07-25T16:00:00Z', value: 9750, change: -500, eventType: 'withdrawal', label: 'Withdrawal' },
  ];

  const prepared = prepareAccountBalanceDisplayPoints(rawSeries);
  assert.equal(prepared.length, 4);
  assert.equal(prepared[0].value, 10000);
  assert.equal(prepared[0].isInitialFundingStart, true);
  assert.equal(prepared[0].initialFundingAmount, 10000);
  assert.equal(prepared[1].value, 9650);
  assert.equal(prepared[3].value, 9750);

  // Recalculated Y-axis starts near post-funding range, NOT $0
  const postFundingAxis = calculateYAxisDomain(prepared, { mode: 'accountBalance' });
  assert.ok(postFundingAxis.ticks[0] >= 9000, `Expected lower tick >= 9000, got ${postFundingAxis.ticks}`);
  assert.equal(postFundingAxis.ticks.includes(0), false);
});

test('prepareAccountBalanceDisplayPoints handles no-trade newly funded accounts, filtered periods, and multi-account timelines', () => {
  // Newly funded account with no subsequent trading activity renders flat balance line at $10,000
  const noTrades = prepareAccountBalanceDisplayPoints([
    { date: '2026-07-08T00:00:00Z', value: 0, change: 0, eventType: 'account_start' },
    { date: '2026-07-08T00:00:00Z', value: 10000, change: 10000, eventType: 'deposit', source: 'startingBalance' },
  ]);
  assert.equal(noTrades.length, 2);
  assert.equal(noTrades[0].value, 10000);
  assert.equal(noTrades[1].value, 10000);
  const noTradeAxis = calculateYAxisDomain(noTrades, { mode: 'accountBalance' });
  assert.deepEqual(noTradeAxis.ticks, [9500, 9750, 10000, 10250, 10500]);

  // Filtered timeframe starting after initial funding (7D / 30D) keeps period_start opening balance
  const filteredPeriod = [
    { date: '2026-10-20T00:00:00Z', value: 9850, change: 0, eventType: 'period_start', label: 'Period start' },
    { date: '2026-10-22T10:00:00Z', value: 10120, change: 270, eventType: 'trade_win' },
    { date: '2026-10-25T10:00:00Z', value: 12120, change: 2000, eventType: 'deposit' },
  ];
  const filteredPrepared = prepareAccountBalanceDisplayPoints(filteredPeriod);
  assert.equal(filteredPrepared.length, 3);
  assert.equal(filteredPrepared[0].value, 9850);
  assert.equal(filteredPrepared[2].value, 12120);

  // Multiple accounts with different funding dates preserve later account funding step
  const multiAccDifferentDates = prepareAccountBalanceDisplayPoints([
    { date: '2026-07-01T00:00:00Z', value: 0, change: 0, eventType: 'account_start' },
    { date: '2026-07-01T00:00:00Z', value: 5000, change: 5000, eventType: 'deposit', source: 'startingBalance', accountId: 'a1' },
    { date: '2026-07-10T00:00:00Z', value: 5250, change: 250, eventType: 'trade_win', accountId: 'a1' },
    { date: '2026-08-01T00:00:00Z', value: 15250, change: 10000, eventType: 'deposit', source: 'startingBalance', accountId: 'a2' },
  ]);
  assert.equal(multiAccDifferentDates.length, 3);
  assert.equal(multiAccDifferentDates[0].value, 5000);
  assert.equal(multiAccDifferentDates[2].value, 15250);

  // Multiple accounts created at the exact same timestamp combine cleanly into initial funded balance
  const multiAccSameTimestamp = prepareAccountBalanceDisplayPoints([
    { date: '2026-07-01T00:00:00Z', value: 0, change: 0, eventType: 'account_start' },
    { date: '2026-07-01T00:00:00Z', value: 5000, change: 5000, eventType: 'deposit', source: 'startingBalance', accountId: 'a1' },
    { date: '2026-07-01T00:00:00Z', value: 15000, change: 10000, eventType: 'deposit', source: 'startingBalance', accountId: 'a2' },
    { date: '2026-07-05T00:00:00Z', value: 15400, change: 400, eventType: 'trade_win' },
  ]);
  assert.equal(multiAccSameTimestamp.length, 2);
  assert.equal(multiAccSameTimestamp[0].value, 15000);
  assert.equal(multiAccSameTimestamp[0].initialFundingAmount, 15000);
  assert.equal(multiAccSameTimestamp[1].value, 15400);
});
