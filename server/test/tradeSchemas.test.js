const assert = require('node:assert/strict');
const { test } = require('node:test');
const { quickTradeSchema, tradeReviewSchema } = require('../src/validation/tradeSchemas');

test('quick trade schema requires fundamental context', () => {
  const result = quickTradeSchema.safeParse({});
  assert.equal(result.success, false);
});

test('quick trade schema allows planned trade without entry/exit times', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'PLANNED',
  });
  assert.equal(result.success, true);
});

test('quick trade schema allows null optional values from the client form', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'PLANNED',
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    lotSize: null,
    riskAmount: null,
    entryTime: null,
    strategyName: null,
    setupType: null,
    entryReason: null,
  });
  assert.equal(result.success, true);
});

test('quick trade schema allows browser datetime-local values', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'ACTIVE',
    entryPrice: 1.10,
    entryTime: '2026-07-10T13:15',
  });
  assert.equal(result.success, true);
});

test('quick trade schema requires entry price and time for open/active trades', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'ACTIVE',
  });
  assert.equal(result.success, false);
  const messages = result.error.issues.map(i => i.message);
  assert.ok(messages.includes('Entry price is required for active/closed trades'));
  assert.ok(messages.includes('Entry time is required for active/closed trades'));
});

test('quick trade schema requires exit price and time for closed trades', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'CLOSED',
    entryPrice: 1.10,
    entryTime: new Date().toISOString(),
  });
  assert.equal(result.success, false);
  const messages = result.error.issues.map(i => i.message);
  assert.ok(messages.includes('Exit price is required for closed trades'));
  assert.ok(messages.includes('Exit time is required for closed trades'));
});

test('quick trade schema rejects exit time before entry time', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'CLOSED',
    entryPrice: 1.10,
    entryTime: new Date(Date.now() + 10000).toISOString(),
    exitPrice: 1.15,
    exitTime: new Date().toISOString(),
  });
  assert.equal(result.success, false);
  const messages = result.error.issues.map(i => i.message);
  assert.ok(messages.includes('Exit time cannot be before entry time'));
});

test('quick trade schema accepts closed trades with realised profit even when form result is still open', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'CLOSED',
    result: 'OPEN',
    entryPrice: 1.10,
    entryTime: '2026-07-10T12:00',
    exitPrice: 1.15,
    exitTime: '2026-07-10T13:00',
    profitLossAmount: '25',
  });
  assert.equal(result.success, true);
});

test('quick trade schema rejects closed trades without realised profit or a closed result', () => {
  const result = quickTradeSchema.safeParse({
    tradingAccountId: '123e4567-e89b-12d3-a456-426614174000',
    pair: 'EURUSD',
    direction: 'BUY',
    status: 'CLOSED',
    result: 'OPEN',
    entryPrice: 1.10,
    entryTime: '2026-07-10T12:00',
    exitPrice: 1.15,
    exitTime: '2026-07-10T13:00',
  });
  assert.equal(result.success, false);
  const messages = result.error.issues.map(i => i.message);
  assert.ok(messages.includes('Realised P/L or a closed result is required for closed trades'));
});

test('trade review schema validates rules and emotions arrays correctly', () => {
  const result = tradeReviewSchema.safeParse({
    grade: 'A_PLUS',
    ruleViolations: [{ tradeRuleId: '123e4567-e89b-12d3-a456-426614174000', severity: 'MAJOR', note: 'Revenge trading' }],
    emotionLogs: [{ stage: 'DURING_TRADE', emotion: 'ANXIOUS', intensity: 8, note: 'Sweating' }]
  });
  assert.equal(result.success, true);
});

test('trade review schema accepts form-style empty values and numeric emotion intensity strings', () => {
  const result = tradeReviewSchema.safeParse({
    session: null,
    followedPlan: null,
    isAPlusSetup: null,
    newsRelated: null,
    grade: '',
    notesAfter: '',
    emotionLogs: [{ stage: 'AFTER_TRADE', emotion: 'DISCIPLINED', intensity: '7', note: '' }],
  });
  assert.equal(result.success, true);
  assert.equal(result.data.emotionLogs[0].intensity, 7);
});
