const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMPLIANCE_STATUS,
  parseTimeString,
  calculateDailyResetBoundaries,
  calculateHighWaterMark,
  evaluatePropFirmCompliance,
} = require('../src/services/propFirmRuleEngine');

test('PropFirmRuleEngine — Unit & Regression Test Suite', async (t) => {
  await t.test('1. Time string parser handles valid and invalid inputs gracefully', () => {
    assert.deepEqual(parseTimeString('17:00'), { hour: 17, minute: 0 });
    assert.deepEqual(parseTimeString('08:30'), { hour: 8, minute: 30 });
    assert.deepEqual(parseTimeString('00:00'), { hour: 0, minute: 0 });
    assert.deepEqual(parseTimeString(''), { hour: 0, minute: 0 });
    assert.deepEqual(parseTimeString(null), { hour: 0, minute: 0 });
    assert.deepEqual(parseTimeString('invalid'), { hour: 0, minute: 0 });
  });

  await t.test('2. Daily reset boundaries calculate correctly across timezones', () => {
    // Noon UTC on 2026-10-26
    const refDate = new Date('2026-10-26T12:00:00.000Z');
    
    // UTC Midnight reset (00:00 UTC)
    const boundariesUtc = calculateDailyResetBoundaries('00:00', 'UTC', refDate);
    assert.equal(boundariesUtc.currentDayResetUtc.toISOString(), '2026-10-26T00:00:00.000Z');
    assert.equal(boundariesUtc.nextResetUtc.toISOString(), '2026-10-27T00:00:00.000Z');
    assert.equal(boundariesUtc.secondsUntilReset, 12 * 3600);

    // New York 17:00 reset (EDT UTC-4 -> 21:00 UTC)
    const boundariesNy = calculateDailyResetBoundaries('17:00', 'America/New_York', refDate);
    assert.ok(boundariesNy.currentDayResetUtc instanceof Date);
    assert.ok(boundariesNy.nextResetUtc > refDate);
    assert.ok(boundariesNy.secondsUntilReset > 0);
  });

  await t.test('3. High-Water Mark correctly tracks peak equity/balance from closed trades', () => {
    const trades = [
      { profitLossAmount: 3000, createdAt: '2026-10-20T10:00:00Z', status: 'CLOSED' },
      { profitLossAmount: 5000, createdAt: '2026-10-21T10:00:00Z', status: 'CLOSED' }, // Bal: 108,000 (Peak)
      { profitLossAmount: -2000, createdAt: '2026-10-22T10:00:00Z', status: 'CLOSED' }, // Bal: 106,000
    ];

    const { highWaterMark, currentCalculatedBalance } = calculateHighWaterMark(100000, trades);
    assert.equal(highWaterMark, 108000);
    assert.equal(currentCalculatedBalance, 106000);
  });

  await t.test('4. Static Drawdown calculates deterministic thresholds, allowances and statuses', () => {
    const mockAccount = {
      id: 'acc_static_1',
      name: 'FTMO $100K Static Challenge',
      startingBalance: 100000,
      currentBalance: 96000,
      currency: 'USD',
      propFirmAccount: {
        firmName: 'FTMO',
        programmeName: 'Standard 100K',
        marketType: 'FOREX_CFD',
        evaluationType: 'TWO_STEP',
        accountStatus: 'ACTIVE',
        drawdownType: 'STATIC',
        maximumLossPercent: 10, // $10,000 max loss -> floor = 90,000
        dailyLossPercent: 5,    // $5,000 daily loss
        phases: [
          { phaseNumber: 1, name: 'Phase 1', profitTargetPercent: 10, minimumTradingDays: 4 },
        ],
      },
      trades: [],
    };

    // Case A: Safe position ($96,000 balance -> $4,000 loss used, $6,000 remaining, 40% util)
    const compA = evaluatePropFirmCompliance(mockAccount);
    assert.equal(compA.drawdown.type, 'STATIC');
    assert.equal(compA.drawdown.limitAmount, 10000);
    assert.equal(compA.drawdown.liquidationFloor, 90000);
    assert.equal(compA.drawdown.drawdownUsed, 4000);
    assert.equal(compA.drawdown.remainingAllowance, 6000);
    assert.equal(compA.drawdown.utilizationPercentage, 40);
    assert.equal(compA.drawdown.status, COMPLIANCE_STATUS.SAFE);

    // Case B: Approaching limit ($92,000 balance -> 80% util)
    const compB = evaluatePropFirmCompliance({ ...mockAccount, currentBalance: 92000 });
    assert.equal(compB.drawdown.remainingAllowance, 2000);
    assert.equal(compB.drawdown.utilizationPercentage, 80);
    assert.equal(compB.compliance.status, COMPLIANCE_STATUS.APPROACHING_LIMIT);

    // Case C: Critical position ($90,500 balance -> 95% util)
    const compC = evaluatePropFirmCompliance({ ...mockAccount, currentBalance: 90500 });
    assert.equal(compC.drawdown.remainingAllowance, 500);
    assert.equal(compC.drawdown.utilizationPercentage, 95);
    assert.equal(compC.compliance.status, COMPLIANCE_STATUS.CRITICAL);

    // Case D: Breach detected ($89,900 balance -> floor breached)
    const compD = evaluatePropFirmCompliance({ ...mockAccount, currentBalance: 89900 });
    assert.equal(compD.drawdown.remainingAllowance, 0);
    assert.equal(compD.drawdown.utilizationPercentage, 101);
    assert.equal(compD.compliance.status, COMPLIANCE_STATUS.BREACH_DETECTED);
    assert.equal(compD.compliance.isBreached, true);
  });

  await t.test('5. Trailing Drawdown dynamically trails peak High-Water Mark (Futures / Apex Model)', () => {
    const mockAccount = {
      id: 'acc_trailing_1',
      name: 'Apex $100K Trailing',
      startingBalance: 100000,
      currentBalance: 104000,
      currency: 'USD',
      propFirmAccount: {
        firmName: 'Apex Trader Funding',
        programmeName: '100K Full',
        marketType: 'FUTURES',
        evaluationType: 'ONE_STEP',
        accountStatus: 'ACTIVE',
        drawdownType: 'TRAILING',
        maximumLossPercent: 5, // $5,000 trailing drawdown
        dailyLossPercent: 5,
        phases: [{ phaseNumber: 1, name: 'Evaluation', profitTargetPercent: 6, minimumTradingDays: 5 }],
      },
      trades: [
        // Grew account from 100k to 108k peak
        { profitLossAmount: 8000, createdAt: '2026-10-21T10:00:00Z', status: 'CLOSED' },
        // Then lost 4000 to drop to 104,000
        { profitLossAmount: -4000, createdAt: '2026-10-22T10:00:00Z', status: 'CLOSED' },
      ],
    };

    const comp = evaluatePropFirmCompliance(mockAccount);
    assert.equal(comp.drawdown.type, 'TRAILING');
    assert.equal(comp.highWaterMark, 108000); // Peak reached
    // Floor must trail up to 108,000 - 5,000 = 103,000! (NOT 95,000)
    assert.equal(comp.drawdown.liquidationFloor, 103000);
    assert.equal(comp.drawdown.drawdownUsed, 4000);
    assert.equal(comp.drawdown.remainingAllowance, 1000);
    assert.equal(comp.drawdown.utilizationPercentage, 80);
    assert.equal(comp.compliance.status, COMPLIANCE_STATUS.APPROACHING_LIMIT);

    // If it drops to 102,500, floor (103,000) is breached!
    const breachedComp = evaluatePropFirmCompliance({ ...mockAccount, currentBalance: 102500 });
    assert.equal(breachedComp.drawdown.liquidationFloor, 103000);
    assert.equal(breachedComp.drawdown.remainingAllowance, 0);
    assert.equal(breachedComp.compliance.status, COMPLIANCE_STATUS.BREACH_DETECTED);
  });

  await t.test('6. Daily Loss calculates accurately from closed trades strictly within current trading day', () => {
    const now = new Date('2026-10-26T14:00:00.000Z');
    const resetTime = '00:00';
    const timezone = 'UTC';

    const mockAccount = {
      id: 'acc_daily_1',
      name: 'FundedNext 50K',
      startingBalance: 50000,
      currentBalance: 48000,
      currency: 'USD',
      propFirmAccount: {
        firmName: 'FundedNext',
        programmeName: 'Stellar 50K',
        drawdownType: 'STATIC',
        maximumLossPercent: 10, // $5,000
        dailyLossPercent: 5,    // $2,500 limit
        dailyResetTime: resetTime,
        dailyResetTimezone: timezone,
        phases: [{ phaseNumber: 1, name: 'Phase 1', profitTargetPercent: 8, minimumTradingDays: 5 }],
      },
      trades: [
        // Trade 1: Closed yesterday (should NOT count toward today's daily loss)
        { profitLossAmount: -1000, exitTime: '2026-10-25T18:00:00Z', status: 'CLOSED' },
        // Trade 2: Closed today (counts!)
        { profitLossAmount: -1875, exitTime: '2026-10-26T09:30:00Z', status: 'CLOSED' },
      ],
    };

    const comp = evaluatePropFirmCompliance(mockAccount, now);
    assert.equal(comp.dailyLoss.limitAmount, 2500);
    // Only Trade 2 counts (-$1,875) -> 75% utilization
    assert.equal(comp.dailyLoss.lossUsedToday, 1875);
    assert.equal(comp.dailyLoss.remainingAllowance, 625);
    assert.equal(comp.dailyLoss.utilizationPercentage, 75);
    assert.equal(comp.dailyLoss.status, COMPLIANCE_STATUS.APPROACHING_LIMIT);
  });

  await t.test('7. Phase qualification validates both profit target and minimum trading days', () => {
    const mockAccount = {
      id: 'acc_pass_1',
      name: 'FTMO Challenge',
      startingBalance: 100000,
      currentBalance: 110500, // +$10,500 profit (>= 10% target)
      currency: 'USD',
      propFirmAccount: {
        firmName: 'FTMO',
        programmeName: '100K Standard',
        evaluationType: 'TWO_STEP',
        accountStatus: 'ACTIVE',
        drawdownType: 'STATIC',
        maximumLossPercent: 10,
        dailyLossPercent: 5,
        phases: [{ phaseNumber: 1, name: 'Phase 1', profitTargetPercent: 10, minimumTradingDays: 3 }],
      },
      // 3 distinct trading days
      trades: [
        { profitLossAmount: 4000, entryTime: '2026-10-20T10:00:00Z', status: 'CLOSED' },
        { profitLossAmount: 3500, entryTime: '2026-10-21T10:00:00Z', status: 'CLOSED' },
        { profitLossAmount: 3000, entryTime: '2026-10-22T10:00:00Z', status: 'CLOSED' },
      ],
    };

    const comp = evaluatePropFirmCompliance(mockAccount);
    assert.equal(comp.phase.targetAmount, 10000);
    assert.equal(comp.phase.remainingProfitRequired, 0);
    assert.equal(comp.phase.completedTradingDays, 3);
    assert.equal(comp.phase.isQualified, true);
    assert.equal(comp.compliance.status, COMPLIANCE_STATUS.PASSED);
  });
});
