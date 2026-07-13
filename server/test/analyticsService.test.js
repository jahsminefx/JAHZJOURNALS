const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateSummary,
  calculateEquityCurve,
  calculateDrawdown,
  groupTrades,
} = require('../src/services/analyticsService');

const makeTrade = (overrides) => ({
  id: overrides.id,
  result: overrides.result,
  status: overrides.status,
  profitLossAmount: overrides.profitLossAmount,
  riskRewardRatio: overrides.riskRewardRatio,
  pair: overrides.pair || 'EURUSD',
  session: overrides.session || 'LONDON',
  entryTimeframe: overrides.entryTimeframe || '15M',
  entryTime: new Date(overrides.entryTime),
  exitTime: overrides.exitTime ? new Date(overrides.exitTime) : null,
  createdAt: new Date(overrides.entryTime),
  emotionLogs: overrides.emotionLogs || [],
  ruleViolations: overrides.ruleViolations || [],
});

test('calculateSummary uses closed trades with breakevens in win-rate denominator', () => {
  const summary = calculateSummary([
    makeTrade({ id: '1', result: 'WIN', profitLossAmount: 120, riskRewardRatio: 2, entryTime: '2026-01-01T10:00:00Z' }),
    makeTrade({ id: '2', result: 'LOSS', profitLossAmount: -60, riskRewardRatio: 1, entryTime: '2026-01-02T10:00:00Z' }),
    makeTrade({ id: '3', result: 'BREAKEVEN', profitLossAmount: 0, riskRewardRatio: 0, entryTime: '2026-01-03T10:00:00Z' }),
    makeTrade({ id: '4', result: 'OPEN', profitLossAmount: 0, riskRewardRatio: 0, entryTime: '2026-01-04T10:00:00Z' }),
  ]);

  assert.equal(summary.totalTrades, 4);
  assert.equal(summary.closedTrades, 3);
  assert.equal(summary.winRate, 33.3);
  assert.equal(summary.profitFactor, 2);
  assert.equal(summary.expectancy, 20);
});

test('calculateSummary treats explicitly closed trades with stale open result as closed', () => {
  const summary = calculateSummary([
    makeTrade({
      id: 'closed-open',
      status: 'CLOSED',
      result: 'OPEN',
      profitLossAmount: -40,
      riskRewardRatio: 1,
      entryTime: '2026-01-05T10:00:00Z',
    }),
  ]);

  assert.equal(summary.totalTrades, 1);
  assert.equal(summary.closedTrades, 1);
  assert.equal(summary.losingTrades, 1);
  assert.equal(summary.netRealisedProfitLoss, -40);
});

test('equity curve and drawdown are chronological and finite', () => {
  const trades = [
    makeTrade({ id: '2', result: 'LOSS', profitLossAmount: -100, entryTime: '2026-01-02T10:00:00Z' }),
    makeTrade({ id: '1', result: 'WIN', profitLossAmount: 200, entryTime: '2026-01-01T10:00:00Z' }),
  ];

  const equityCurve = calculateEquityCurve(trades, 1000);
  const drawdown = calculateDrawdown(equityCurve, 1000);

  assert.equal(equityCurve[0].tradeId, '1');
  assert.equal(equityCurve[1].equity, 1100);
  assert.equal(drawdown.maximumDrawdown, 100);
  assert.equal(drawdown.data[1].drawdownPercentage, 8.33);
});

test('emotion grouping separates associated trade count from log count', () => {
  const grouped = groupTrades([
    makeTrade({
      id: '1',
      result: 'WIN',
      profitLossAmount: 100,
      entryTime: '2026-01-01T10:00:00Z',
      emotionLogs: [{ emotion: 'CALM' }, { emotion: 'CALM' }],
    }),
  ], 'emotion');

  assert.equal(grouped[0].associatedTradeCount, 1);
  assert.equal(grouped[0].emotionLogCount, 2);
});
