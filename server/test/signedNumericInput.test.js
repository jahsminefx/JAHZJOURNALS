const test = require('node:test');
const assert = require('node:assert');
const { calculateTradeResult } = require('../src/utils/tradeCalculations');
const { quickTradeSchema } = require('../src/validation/tradeSchemas');

test('calculateTradeResult correctly identifies WIN for positive P/L', () => {
  const result = calculateTradeResult('CLOSED', 250.50);
  assert.strictEqual(result, 'WIN');
});

test('calculateTradeResult correctly identifies LOSS for negative P/L', () => {
  const result = calculateTradeResult('CLOSED', -250.50);
  assert.strictEqual(result, 'LOSS');
});

test('calculateTradeResult correctly identifies BREAKEVEN for zero P/L', () => {
  const result = calculateTradeResult('CLOSED', 0);
  assert.strictEqual(result, 'BREAKEVEN');
});

test('quickTradeSchema accepts negative profitLossAmount (-250.50)', () => {
  const validData = {
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'CLOSED',
    entryPrice: 1.0850,
    exitPrice: 1.0820,
    entryTime: '2026-08-10T10:00:00.000Z',
    exitTime: '2026-08-10T11:00:00.000Z',
    profitLossAmount: -250.50,
  };

  const parsed = quickTradeSchema.safeParse(validData);
  assert.strictEqual(parsed.success, true);
  if (parsed.success) {
    assert.strictEqual(parsed.data.profitLossAmount, -250.50);
  }
});

test('quickTradeSchema accepts negative string profitLossAmount ("-250.50")', () => {
  const validData = {
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'GBPUSD',
    direction: 'SELL',
    status: 'CLOSED',
    entryPrice: 1.2500,
    exitPrice: 1.2550,
    entryTime: '2026-08-10T10:00:00.000Z',
    exitTime: '2026-08-10T11:00:00.000Z',
    profitLossAmount: '-250.50',
  };

  const parsed = quickTradeSchema.safeParse(validData);
  assert.strictEqual(parsed.success, true);
  if (parsed.success) {
    assert.strictEqual(parsed.data.profitLossAmount, -250.50);
  }
});
