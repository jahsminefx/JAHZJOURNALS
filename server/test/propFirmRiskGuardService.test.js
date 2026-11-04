const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const propFirmRiskGuard = require('../src/services/propFirmRiskGuardService');
const propFirmRuleEngine = require('../src/services/propFirmRuleEngine');

describe('PropFirmRiskGuardService — Unit & Safety Guard Test Suite', () => {
  test('1. Helper functions correctly approximate pip size and pip value per lot', () => {
    assert.equal(propFirmRiskGuard.getPipSize('EURUSD'), 0.0001);
    assert.equal(propFirmRiskGuard.getPipSize('GBPJPY'), 0.01);
    assert.equal(propFirmRiskGuard.getPipSize('XAUUSD'), 0.1);
    assert.equal(propFirmRiskGuard.getPipSize('US30'), 1.0);

    assert.equal(propFirmRiskGuard.getApproxPipValuePerLot('EURUSD'), 10.0);
    assert.equal(propFirmRiskGuard.getApproxPipValuePerLot('XAUUSD'), 10.0);
  });

  test('2. Proposed trade within safe limits returns SAFE status and canExecuteSafely = true', async () => {
    // Stub getPropFirmComplianceReport
    const originalGetReport = propFirmRuleEngine.getPropFirmComplianceReport;
    propFirmRuleEngine.getPropFirmComplianceReport = async () => ({
      tradingAccountId: 'acc-1',
      accountName: '100k Challenge',
      currentBalance: 100000,
      dailyLoss: {
        enabled: true,
        limitAmount: 5000,
        remainingAllowanceAmount: 4500,
      },
      overallDrawdown: {
        drawdownType: 'STATIC',
        liquidationFloor: 90000,
        highWaterMark: 100000,
        drawdownLimitAmount: 10000,
        remainingAllowanceAmount: 10000,
      },
    });

    try {
      const evaluation = await propFirmRiskGuard.evaluateProposedTrade({
        tradingAccountId: 'acc-1',
        userId: 'user-1',
        lotSize: 1.0,
        entryPrice: 1.1000,
        stopLoss: 1.0980, // 20 pips = $200 risk
        pair: 'EURUSD',
        direction: 'BUY',
      });

      assert.equal(evaluation.status, 'SAFE');
      assert.equal(evaluation.canExecuteSafely, true);
      assert.equal(evaluation.estimatedTradeRisk, 200);
      assert.equal(evaluation.dailyLoss.remainingAfterTrade, 4300);
      assert.equal(evaluation.hardBlocks.length, 0);
    } finally {
      propFirmRuleEngine.getPropFirmComplianceReport = originalGetReport;
    }
  });

  test('3. Proposed trade exceeding daily loss allowance triggers POTENTIAL_BREACH and canExecuteSafely = false', async () => {
    const originalGetReport = propFirmRuleEngine.getPropFirmComplianceReport;
    propFirmRuleEngine.getPropFirmComplianceReport = async () => ({
      tradingAccountId: 'acc-2',
      accountName: '100k Challenge',
      currentBalance: 96000,
      dailyLoss: {
        enabled: true,
        limitAmount: 5000,
        remainingAllowanceAmount: 800, // Only $800 left today
      },
      overallDrawdown: {
        drawdownType: 'STATIC',
        liquidationFloor: 90000,
        highWaterMark: 100000,
        drawdownLimitAmount: 10000,
        remainingAllowanceAmount: 6000,
      },
    });

    try {
      const evaluation = await propFirmRiskGuard.evaluateProposedTrade({
        tradingAccountId: 'acc-2',
        userId: 'user-1',
        estimatedRiskAmount: 1200, // Proposed risk $1,200 > $800
        pair: 'EURUSD',
      });

      assert.equal(evaluation.status, 'POTENTIAL_BREACH');
      assert.equal(evaluation.canExecuteSafely, false);
      assert.ok(evaluation.hardBlocks.some((b) => b.includes('Daily Loss Breach Risk')));
    } finally {
      propFirmRuleEngine.getPropFirmComplianceReport = originalGetReport;
    }
  });

  test('4. Trade consuming near-threshold risk triggers CRITICAL warning', async () => {
    const originalGetReport = propFirmRuleEngine.getPropFirmComplianceReport;
    propFirmRuleEngine.getPropFirmComplianceReport = async () => ({
      tradingAccountId: 'acc-3',
      accountName: '100k Challenge',
      currentBalance: 98000,
      dailyLoss: {
        enabled: true,
        limitAmount: 5000,
        remainingAllowanceAmount: 1000,
      },
      overallDrawdown: {
        drawdownType: 'STATIC',
        liquidationFloor: 90000,
        highWaterMark: 100000,
        drawdownLimitAmount: 10000,
        remainingAllowanceAmount: 8000,
      },
    });

    try {
      // Limit 5000 * 0.15 = 750 margin threshold. Risk 500 leaves 500 <= 750 -> CRITICAL
      const evaluation = await propFirmRiskGuard.evaluateProposedTrade({
        tradingAccountId: 'acc-3',
        userId: 'user-1',
        estimatedRiskAmount: 500,
      });

      assert.equal(evaluation.status, 'CRITICAL');
      assert.equal(evaluation.canExecuteSafely, true);
      assert.ok(evaluation.warnings.some((w) => w.includes('Critical Margin')));
    } finally {
      propFirmRuleEngine.getPropFirmComplianceReport = originalGetReport;
    }
  });
});
