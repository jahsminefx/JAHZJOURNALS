const { test } = require('node:test');
const assert = require('node:assert');
const { analyzeTradingPatterns } = require('./psychologyService');

test('analyzeTradingPatterns detects Revenge Trading', () => {
  const trades = [
    { entryTime: '2026-07-14T10:00:00Z', exitTime: '2026-07-14T10:05:00Z', result: 'LOSS', riskAmount: 50 },
    { entryTime: '2026-07-14T10:15:00Z', exitTime: '2026-07-14T10:20:00Z', result: 'LOSS', riskAmount: 100 },
    { entryTime: '2026-07-14T15:00:00Z', exitTime: '2026-07-14T15:30:00Z', result: 'WIN', riskAmount: 50 },
  ];
  const patterns = analyzeTradingPatterns(trades);
  
  assert.ok(patterns.some(p => p.includes('Revenge Trading')));
  assert.strictEqual(patterns.length, 1);
});

test('analyzeTradingPatterns detects cutting winners short', () => {
  const trades = [
    { entryTime: '2026-07-14T10:00:00Z', result: 'LOSS', profitLossAmount: -200 },
    { entryTime: '2026-07-14T11:00:00Z', result: 'WIN', profitLossAmount: 50 },
    { entryTime: '2026-07-14T12:00:00Z', result: 'LOSS', profitLossAmount: -180 },
    { entryTime: '2026-07-14T13:00:00Z', result: 'WIN', profitLossAmount: 40 },
  ];
  const patterns = analyzeTradingPatterns(trades);
  
  assert.ok(patterns.some(p => p.includes('skewed risk asymmetry')));
});

test('analyzeTradingPatterns returns empty for normal play', () => {
  const trades = [
    { entryTime: '2026-07-14T10:00:00Z', result: 'LOSS', riskAmount: 50, profitLossAmount: -50 },
    { entryTime: '2026-07-14T14:00:00Z', result: 'WIN', riskAmount: 50, profitLossAmount: 150 },
    { entryTime: '2026-07-15T12:00:00Z', result: 'WIN', riskAmount: 50, profitLossAmount: 100 },
  ];
  const patterns = analyzeTradingPatterns(trades);
  assert.strictEqual(patterns.length, 0);
});
