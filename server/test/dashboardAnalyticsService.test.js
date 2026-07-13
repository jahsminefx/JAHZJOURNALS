const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const {
  buildPerformanceCurve,
  calculateDrawdown,
  calculateEquityCurve,
  calculatePeriodComparison,
  calculateSummary,
} = require('../src/utils/dashboardMath');
const {
  buildCalendar,
  buildSessionPerformance,
  buildTopPairs,
  filterTradesByPeriod,
  getPreviousPeriod,
} = require('../src/services/dashboardAnalyticsService');

const makeTrade = (overrides) => ({
  id: overrides.id,
  tradingAccountId: overrides.tradingAccountId || 'account-1',
  tradingAccount: overrides.tradingAccount || { id: overrides.tradingAccountId || 'account-1', name: 'Main account' },
  pair: overrides.pair || 'EURUSD',
  result: overrides.result || 'WIN',
  status: overrides.status ?? ((overrides.result || 'WIN') === 'OPEN' ? 'ACTIVE' : 'CLOSED'),
  profitLossAmount: overrides.profitLossAmount ?? 0,
  session: overrides.session || 'LONDON',
  entryTime: new Date(overrides.entryTime || '2026-07-01T09:00:00Z'),
  exitTime: overrides.exitTime ? new Date(overrides.exitTime) : null,
  createdAt: new Date(overrides.createdAt || overrides.entryTime || '2026-07-01T09:00:00Z'),
  updatedAt: new Date(overrides.updatedAt || overrides.exitTime || overrides.createdAt || overrides.entryTime || '2026-07-01T09:00:00Z'),
});

const makeAccount = (overrides = {}) => ({
  id: overrides.id || 'account-1',
  name: overrides.name || 'Main account',
  startingBalance: overrides.startingBalance ?? 10000,
  currentBalance: overrides.currentBalance ?? overrides.startingBalance ?? 10000,
  currency: overrides.currency || 'USD',
  createdAt: new Date(overrides.createdAt || '2026-07-01T00:00:00Z'),
  updatedAt: new Date(overrides.updatedAt || overrides.createdAt || '2026-07-01T00:00:00Z'),
});

test('performance curve starts at zero and excludes deposits from cumulative trading P/L', () => {
  const performanceCurve = buildPerformanceCurve({
    accounts: [makeAccount({ startingBalance: 10000 })],
    trades: [
      makeTrade({ id: 'closed-loss', result: 'LOSS', profitLossAmount: -55.4, exitTime: '2026-07-03T16:00:00Z' }),
      makeTrade({ id: 'open-profit', status: 'ACTIVE', result: 'OPEN', profitLossAmount: 999, exitTime: '2026-07-04T16:00:00Z' }),
    ],
    now: new Date('2026-07-05T00:00:00Z'),
  });

  assert.equal(performanceCurve.cumulativePnl[0].eventType, 'account_start');
  assert.equal(performanceCurve.cumulativePnl[0].value, 0);
  assert.equal(performanceCurve.cumulativePnl.length, 2);
  assert.equal(performanceCurve.cumulativePnl[1].tradeId, 'closed-loss');
  assert.equal(performanceCurve.cumulativePnl[1].value, -55.4);
  assert.equal(performanceCurve.cumulativePnl[1].tradePnl, -55.4);

  assert.equal(performanceCurve.accountBalance[0].value, 0);
  assert.equal(performanceCurve.accountBalance[1].eventType, 'deposit');
  assert.equal(performanceCurve.accountBalance[1].value, 10000);
  assert.equal(performanceCurve.accountBalance[2].eventType, 'trade_loss');
  assert.equal(performanceCurve.accountBalance[2].tradeId, 'closed-loss');
  assert.equal(performanceCurve.accountBalance.at(-1).value, 9944.6);
  assert.equal(performanceCurve.accountBalance.some((point) => point.tradeId === 'open-profit'), false);

  assert.equal(performanceCurve.summary.netTradingPnl, -55.4);
  assert.equal(performanceCurve.summary.tradingReturnPercentage, -0.55);
  assert.equal(performanceCurve.summary.closedTrades, 1);
  assert.equal(performanceCurve.summary.totalDeposits, 10000);
  assert.equal(performanceCurve.summary.totalWithdrawals, 0);
  assert.equal(performanceCurve.summary.currentBalance, 9944.6);
});

test('performance curve reconciles saved current balance changes without changing trading P/L', () => {
  const performanceCurve = buildPerformanceCurve({
    accounts: [makeAccount({
      startingBalance: 10000,
      currentBalance: 9944.6,
      updatedAt: '2026-07-05T12:00:00Z',
    })],
    trades: [],
    now: new Date('2026-07-05T13:00:00Z'),
  });

  const balanceAdjustment = performanceCurve.accountBalance.find((point) => point.eventType === 'balance_adjustment');

  assert.equal(performanceCurve.cumulativePnl[0].value, 0);
  assert.equal(performanceCurve.cumulativePnl.at(-1).value, 0);
  assert.equal(performanceCurve.summary.netTradingPnl, 0);
  assert.equal(performanceCurve.summary.closedTrades, 0);
  assert.equal(balanceAdjustment.change, -55.4);
  assert.equal(performanceCurve.accountBalance.at(-1).value, 9944.6);
  assert.equal(performanceCurve.summary.currentBalance, 9944.6);
  assert.equal(performanceCurve.summary.balanceAdjustments, -55.4);
  assert.equal(performanceCurve.metadata.usesCurrentBalanceReconciliation, true);
});

test('performance curve sorts trades chronologically and keeps withdrawals out of trading P/L', () => {
  const performanceCurve = buildPerformanceCurve({
    accounts: [makeAccount({ startingBalance: 1000 })],
    fundingEvents: [
      { accountId: 'account-1', type: 'withdrawal', amount: 100, date: '2026-07-03T12:00:00Z' },
      { accountId: 'account-1', type: 'deposit', amount: 200, date: '2026-07-02T12:00:00Z' },
    ],
    trades: [
      makeTrade({ id: 'win-second', result: 'WIN', profitLossAmount: 80, exitTime: '2026-07-04T16:00:00Z' }),
      makeTrade({ id: 'loss-first', result: 'LOSS', profitLossAmount: -30, exitTime: '2026-07-01T16:00:00Z' }),
    ],
  });

  assert.deepEqual(
    performanceCurve.cumulativePnl.filter((point) => String(point.eventType).startsWith('trade')).map((point) => point.tradeId),
    ['loss-first', 'win-second'],
  );
  assert.deepEqual(
    performanceCurve.cumulativePnl.filter((point) => String(point.eventType).startsWith('trade')).map((point) => point.eventType),
    ['trade_loss', 'trade_win'],
  );
  assert.equal(performanceCurve.cumulativePnl.at(-1).value, 50);
  assert.equal(performanceCurve.accountBalance.at(-1).value, 1150);
  assert.equal(performanceCurve.summary.netTradingPnl, 50);
  assert.equal(performanceCurve.summary.totalDeposits, 1200);
  assert.equal(performanceCurve.summary.totalWithdrawals, 100);
});

test('account balance curve preserves full timestamps and same-timestamp ledger order', () => {
  const timestamp = '2026-07-02T10:30:00Z';
  const isoTimestamp = new Date(timestamp).toISOString();
  const performanceCurve = buildPerformanceCurve({
    accounts: [makeAccount({ startingBalance: 0, currentBalance: 0, createdAt: timestamp })],
    fundingEvents: [
      { accountId: 'account-1', type: 'withdrawal', amount: 40, date: timestamp },
      { accountId: 'account-1', type: 'deposit', amount: 100, date: timestamp },
    ],
    trades: [
      makeTrade({ id: 'same-time-loss', result: 'LOSS', profitLossAmount: -15, exitTime: timestamp }),
      makeTrade({ id: 'same-time-win', result: 'WIN', profitLossAmount: 25, exitTime: timestamp }),
    ],
  });

  assert.deepEqual(
    performanceCurve.accountBalance.map((point) => point.eventType),
    ['account_start', 'deposit', 'withdrawal', 'trade_loss', 'trade_win'],
  );
  assert.deepEqual(
    performanceCurve.accountBalance.map((point) => point.value),
    [0, 100, 60, 45, 70],
  );
  assert.deepEqual(
    performanceCurve.accountBalance.map((point) => point.date),
    [isoTimestamp, isoTimestamp, isoTimestamp, isoTimestamp, isoTimestamp],
  );
  assert.equal(performanceCurve.summary.totalDeposits, 100);
  assert.equal(performanceCurve.summary.totalWithdrawals, 40);
  assert.equal(performanceCurve.summary.netTradingPnl, 10);
  assert.equal(performanceCurve.summary.currentBalance, 70);
});

test('performance curve aggregates all selected accounts and protects zero-deposit returns', () => {
  const performanceCurve = buildPerformanceCurve({
    accounts: [
      makeAccount({ id: 'a1', name: 'A1', startingBalance: 0, createdAt: '2026-07-01T00:00:00Z' }),
      makeAccount({ id: 'a2', name: 'A2', startingBalance: 0, createdAt: '2026-07-02T00:00:00Z' }),
    ],
    trades: [
      makeTrade({ id: 'a1-win', tradingAccountId: 'a1', result: 'WIN', profitLossAmount: 10, exitTime: '2026-07-03T12:00:00Z' }),
      makeTrade({ id: 'a2-loss', tradingAccountId: 'a2', result: 'LOSS', profitLossAmount: -5, exitTime: '2026-07-04T12:00:00Z' }),
    ],
  });

  assert.equal(performanceCurve.cumulativePnl[0].value, 0);
  assert.equal(performanceCurve.cumulativePnl.at(-1).value, 5);
  assert.equal(performanceCurve.accountBalance.at(-1).value, 5);
  assert.equal(performanceCurve.summary.netDeposits, 0);
  assert.equal(performanceCurve.summary.tradingReturnPercentage, 0);
});

test('performance curve filters selected ranges while preserving balance opening value', () => {
  const performanceCurve = buildPerformanceCurve({
    accounts: [makeAccount({ startingBalance: 1000 })],
    trades: [
      makeTrade({ id: 'before', result: 'WIN', profitLossAmount: 100, exitTime: '2026-07-01T12:00:00Z' }),
      makeTrade({ id: 'inside', result: 'LOSS', profitLossAmount: -25, exitTime: '2026-07-03T12:00:00Z' }),
      makeTrade({ id: 'after', result: 'WIN', profitLossAmount: 60, exitTime: '2026-07-07T12:00:00Z' }),
    ],
    startDate: new Date('2026-07-02T00:00:00Z'),
    endDate: new Date('2026-07-05T23:59:59Z'),
  });

  assert.deepEqual(
    performanceCurve.cumulativePnl.filter((point) => String(point.eventType).startsWith('trade')).map((point) => point.tradeId),
    ['inside'],
  );
  assert.equal(performanceCurve.cumulativePnl[0].eventType, 'period_start');
  assert.equal(performanceCurve.cumulativePnl[0].value, 0);
  assert.equal(performanceCurve.cumulativePnl.at(-1).value, -25);
  assert.equal(performanceCurve.accountBalance[0].value, 1100);
  assert.equal(performanceCurve.accountBalance.at(-1).value, 1075);
  assert.equal(performanceCurve.summary.closedTrades, 1);
});

test('dashboard summary calculates win rate, return, profit factor, and empty states safely', () => {
  const summary = calculateSummary([
    makeTrade({ id: '1', result: 'WIN', profitLossAmount: 100 }),
    makeTrade({ id: '2', result: 'LOSS', profitLossAmount: -50 }),
    makeTrade({ id: '3', result: 'BREAKEVEN', profitLossAmount: 0 }),
    makeTrade({ id: '4', result: 'OPEN', profitLossAmount: 500 }),
  ], 10000);

  assert.equal(summary.netProfitLoss, 50);
  assert.equal(summary.returnPercentage, 0.5);
  assert.equal(summary.winRate, 33.3);
  assert.equal(summary.totalTrades, 4);
  assert.equal(summary.closedTrades, 3);
  assert.equal(summary.profitFactor, 2);

  const noLossSummary = calculateSummary([
    makeTrade({ id: '5', result: 'WIN', profitLossAmount: 250 }),
  ], 10000);
  assert.equal(noLossSummary.profitFactor, null);

  const emptySummary = calculateSummary([], 10000);
  assert.equal(emptySummary.totalTrades, 0);
  assert.equal(emptySummary.winRate, 0);
});

test('dashboard summary normalizes closed trades that were saved with an open result', () => {
  const summary = calculateSummary([
    makeTrade({ id: 'stale-open-result', status: 'CLOSED', result: 'OPEN', profitLossAmount: 75 }),
  ], 10000);

  assert.equal(summary.totalTrades, 1);
  assert.equal(summary.closedTrades, 1);
  assert.equal(summary.wins, 1);
  assert.equal(summary.netProfitLoss, 75);
  assert.equal(summary.winRate, 100);
});

test('dashboard equity curve includes starting balance and maximum drawdown is peak to trough', () => {
  const trades = [
    makeTrade({ id: '2', result: 'LOSS', profitLossAmount: -100, entryTime: '2026-07-02T09:00:00Z' }),
    makeTrade({ id: '1', result: 'WIN', profitLossAmount: 200, entryTime: '2026-07-01T09:00:00Z' }),
    makeTrade({ id: '3', result: 'LOSS', profitLossAmount: -300, entryTime: '2026-07-03T09:00:00Z' }),
  ];

  const equityCurve = calculateEquityCurve(trades, 1000);
  const drawdown = calculateDrawdown(equityCurve, 1000);

  assert.equal(equityCurve[0].label, 'Start');
  assert.equal(equityCurve[1].tradeId, '1');
  assert.equal(equityCurve[1].equity, 1200);
  assert.equal(drawdown.maximumDrawdown, 400);
  assert.equal(drawdown.maximumDrawdownPercentage, 33.33);
});

test('dashboard period filtering and previous-period comparison use equivalent windows', () => {
  const start = new Date('2026-07-01T00:00:00.000Z');
  const end = new Date('2026-07-07T23:59:59.999Z');
  const previous = getPreviousPeriod(start, end);

  assert.equal(previous.startDate.toISOString(), '2026-06-24T00:00:00.000Z');
  assert.equal(previous.endDate.toISOString(), '2026-06-30T23:59:59.999Z');

  const trades = [
    makeTrade({ id: 'inside', entryTime: '2026-07-02T09:00:00Z' }),
    makeTrade({ id: 'outside', entryTime: '2026-06-29T09:00:00Z' }),
  ];
  assert.deepEqual(filterTradesByPeriod(trades, start, end).map((trade) => trade.id), ['inside']);

  const comparison = calculatePeriodComparison(
    { netProfitLoss: 200, winRate: 60, totalTrades: 10, profitFactor: 2, maximumDrawdownPercentage: 4 },
    { netProfitLoss: 150, winRate: 50, totalTrades: 8, profitFactor: 1.5, maximumDrawdownPercentage: 6 },
  );

  assert.equal(comparison.netProfitLossChange, 50);
  assert.equal(comparison.winRateChange, 10);
  assert.equal(comparison.totalTradesChange, 2);
  assert.equal(comparison.profitFactorChange, 0.5);
  assert.equal(comparison.drawdownChange, -2);
});

test('dashboard session aggregation requires enough samples before naming a strongest session', () => {
  const sessions = buildSessionPerformance([
    makeTrade({ id: 'l1', session: 'LONDON', result: 'WIN', profitLossAmount: 200 }),
    makeTrade({ id: 'l2', session: 'LONDON', result: 'WIN', profitLossAmount: 150 }),
    makeTrade({ id: 'l3', session: 'LONDON', result: 'LOSS', profitLossAmount: -50 }),
    makeTrade({ id: 'n1', session: 'NEW_YORK', result: 'WIN', profitLossAmount: 1000 }),
  ]);

  const london = sessions.find((session) => session.key === 'LONDON');
  const newYork = sessions.find((session) => session.key === 'NEW_YORK');

  assert.equal(london.isStrongest, true);
  assert.equal(newYork.isStrongest, false);
  assert.equal(newYork.totalTrades, 1);
});

test('dashboard calendar and top-pair aggregations use real closed trade results', () => {
  const trades = [
    makeTrade({ id: '1', pair: 'EURUSD', result: 'WIN', profitLossAmount: 100, entryTime: '2026-07-01T09:00:00Z' }),
    makeTrade({ id: '2', pair: 'EURUSD', result: 'LOSS', profitLossAmount: -40, entryTime: '2026-07-01T10:00:00Z' }),
    makeTrade({ id: '3', pair: 'XAUUSD', result: 'WIN', profitLossAmount: 30, entryTime: '2026-07-02T09:00:00Z' }),
    makeTrade({ id: '4', pair: 'GBPUSD', result: 'LOSS', profitLossAmount: -10, entryTime: '2026-07-03T09:00:00Z' }),
  ];

  const calendar = buildCalendar(trades);
  assert.equal(calendar[0].date, '2026-07-01');
  assert.equal(calendar[0].outcome, 'PROFIT');
  assert.equal(calendar[2].outcome, 'LOSS');

  const topPairs = buildTopPairs(trades);
  assert.equal(topPairs[0].pair, 'EURUSD');
  assert.equal(topPairs[0].netProfitLoss, 60);
  assert.equal(topPairs[1].pair, 'XAUUSD');
});

test('dashboard analytics service preserves ownership and goal-query safeguards in source', async () => {
  const [source, userRoutes, userController, analyticsController] = await Promise.all([
    readFile(path.join(__dirname, '../src/services/dashboardAnalyticsService.js'), 'utf8'),
    readFile(path.join(__dirname, '../src/routes/userRoutes.js'), 'utf8'),
    readFile(path.join(__dirname, '../src/controllers/userController.js'), 'utf8'),
    readFile(path.join(__dirname, '../src/controllers/analyticsController.js'), 'utf8'),
  ]);

  assert.match(source, /where:\s*{\s*userId\b/);
  assert.match(source, /tradingAccount:\s*{\s*userId\s*}/);
  assert.match(source, /Account not found/);
  assert.match(source, /normalizeTradeResult/);
  assert.match(source, /buildPerformanceCurve/);
  assert.match(source, /performanceCurve/);
  assert.match(source, /closedTrades:\s*currentSummary\.closedTrades/);
  assert.match(source, /prisma\.tradingGoal\.findMany/);
  assert.match(source, /periodType:\s*'WEEKLY'/);
  assert.match(userRoutes, /\/trading-goals\/weekly/);
  assert.match(userController, /upsertWeeklyTradingGoal/);
  assert.match(userController, /where:\s*{\s*id: tradingAccountId,\s*userId: req\.user\.id\s*}/);
  assert.match(analyticsController, /Cache-Control', 'no-store'/);
});
