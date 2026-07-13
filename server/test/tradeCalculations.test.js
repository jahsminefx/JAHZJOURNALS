const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculateRiskReward, calculateTradeResult, calculateProfitLossPercentage, normalizeTradeState } = require('../src/utils/tradeCalculations');

test('calculateRiskReward calculates correctly for BUY trades', () => {
  const { Math } = global;
  const result = calculateRiskReward('BUY', 1.1000, 1.0500, 1.2000); // Risk 0.05, Reward 0.10 => RR 2
  assert.equal(result.riskDistance, 0.05);
  assert.equal(result.rewardDistance, 0.10);
  assert.equal(result.riskRewardRatio, 2);
});

test('calculateRiskReward calculates correctly for SELL trades', () => {
  const result = calculateRiskReward('SELL', 1.2000, 1.2500, 1.1000); // Risk 0.05, Reward 0.10 => RR 2
  assert.equal(result.riskDistance, 0.05);
  assert.equal(result.rewardDistance, 0.10);
  assert.equal(result.riskRewardRatio, 2);
});

test('calculateRiskReward handles missing TP or SL safely', () => {
  const result = calculateRiskReward('BUY', 1.1000, 1.0500, null);
  assert.equal(result.riskDistance, 0.05);
  assert.equal(result.rewardDistance, null);
  assert.equal(result.riskRewardRatio, null);
});

test('calculateTradeResult determines WIN/LOSS/BREAKEVEN automatically', () => {
  assert.equal(calculateTradeResult('CLOSED', 50), 'WIN');
  assert.equal(calculateTradeResult('CLOSED', -25), 'LOSS');
  assert.equal(calculateTradeResult('CLOSED', 0), 'BREAKEVEN');
  assert.equal(calculateTradeResult('CLOSED', 50, 'OPEN'), 'WIN');
  assert.equal(calculateTradeResult('CLOSED', null, 'LOSS'), 'LOSS');
});

test('calculateTradeResult forces OPEN status when trade is planned or active', () => {
  assert.equal(calculateTradeResult('PLANNED', 100), 'OPEN');
  assert.equal(calculateTradeResult('ACTIVE', 0), 'OPEN');
  assert.equal(calculateTradeResult('CANCELLED', 100, 'WIN'), 'OPEN');
  assert.equal(calculateTradeResult(undefined, 100, 'OPEN'), 'OPEN');
});

test('calculateProfitLossPercentage calculates accurately', () => {
  // $100 profit on $10000 account = 1%
  assert.equal(calculateProfitLossPercentage(100, 10000), 1.00);
});

test('normalizeTradeState enforces Planned rules', () => {
  const input = {
    status: 'PLANNED',
    entryPrice: 1.1,
    exitPrice: 1.2,
    profitLossAmount: 100,
    result: 'WIN'
  };
  const result = normalizeTradeState(input);
  assert.equal(result.status, 'PLANNED');
  assert.equal(result.entryPrice, null);
  assert.equal(result.exitPrice, null);
  assert.equal(result.profitLossAmount, null);
  assert.equal(result.result, 'OPEN');
});

test('normalizeTradeState enforces Active rules', () => {
  const input = {
    status: 'ACTIVE',
    entryPrice: 1.1,
    exitPrice: 1.2,
    profitLossAmount: 100,
    result: 'WIN'
  };
  const result = normalizeTradeState(input);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(result.entryPrice, 1.1);
  assert.equal(result.exitPrice, null);
  assert.equal(result.profitLossAmount, null);
  assert.equal(result.result, 'OPEN');
  assert.ok(result.entryTime, 'Should auto-populate entryTime if active and missing');
});

test('normalizeTradeState enforces Closed rules', () => {
  const inputWin = { status: 'CLOSED', profitLossAmount: 50 };
  const inputLoss = { status: 'CLOSED', profitLossAmount: -50 };
  const inputBe = { status: 'CLOSED', profitLossAmount: 0 };
  
  assert.equal(normalizeTradeState(inputWin).result, 'WIN');
  assert.equal(normalizeTradeState(inputLoss).result, 'LOSS');
  assert.equal(normalizeTradeState(inputBe).result, 'BREAKEVEN');
});
