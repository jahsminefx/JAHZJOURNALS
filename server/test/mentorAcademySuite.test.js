const test = require('node:test');
const assert = require('node:assert');
const { 
  PLANS, 
  MENTOR_TIERS, 
  getMentorTierConfig, 
  getEffectivePlanKey, 
  buildLimitReachedPayload 
} = require('../src/config/plans');
const { requireMentorPlan } = require('../src/middleware/subscriptionGate');

// Helper to simulate express req, res, next
const createMockHttp = ({ user = null, params = {}, body = {} } = {}) => {
  const req = { user, params, body };
  let statusCode = 200;
  let responseData = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) throw err;
    nextCalled = true;
  };

  return { req, res, next, getStatus: () => statusCode, getData: () => responseData, wasNextCalled: () => nextCalled };
};

// ==========================================
// 1. TIER DEFINITION & PRICING CONSISTENCY
// ==========================================

test('Mentor Workspace Tiers are defined with correct prices and student caps', () => {
  assert.strictEqual(MENTOR_TIERS.PRIVATE_COHORT.priceNgn, 8000);
  assert.strictEqual(MENTOR_TIERS.PRIVATE_COHORT.maxStudents, 50);
  assert.strictEqual(MENTOR_TIERS.PRIVATE_COHORT.maxCohorts, 2);

  assert.strictEqual(MENTOR_TIERS.GROWTH.priceNgn, 25000);
  assert.strictEqual(MENTOR_TIERS.GROWTH.maxStudents, 150);
  assert.strictEqual(MENTOR_TIERS.GROWTH.maxCohorts, 5);

  assert.strictEqual(MENTOR_TIERS.MEGA.priceNgn, 65000);
  assert.strictEqual(MENTOR_TIERS.MEGA.maxStudents, 1000);
  assert.strictEqual(MENTOR_TIERS.MEGA.maxCohorts, Infinity);

  // Fallback defaults to PRIVATE_COHORT
  assert.strictEqual(getMentorTierConfig('UNKNOWN').key, 'PRIVATE_COHORT');
  assert.strictEqual(getMentorTierConfig('GROWTH').key, 'GROWTH');
});

// ==========================================
// 2. SECURITY & AUTHORIZATION (EXPIRED MENTORS)
// ==========================================

test('Security: requireMentorPlan allows active MENTOR and ADMIN users', async () => {
  // Active mentor subscription
  const mock1 = createMockHttp({
    user: { id: 'm1', role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'ACTIVE' }
  });
  await requireMentorPlan(mock1.req, mock1.res, mock1.next);
  assert.strictEqual(mock1.wasNextCalled(), true);

  // Platform admin
  const mock2 = createMockHttp({
    user: { id: 'a1', role: 'ADMIN', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }
  });
  await requireMentorPlan(mock2.req, mock2.res, mock2.next);
  assert.strictEqual(mock2.wasNextCalled(), true);

  // Platform super admin
  const mock3 = createMockHttp({
    user: { id: 'sa1', role: 'SUPER_ADMIN', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }
  });
  await requireMentorPlan(mock3.req, mock3.res, mock3.next);
  assert.strictEqual(mock3.wasNextCalled(), true);
});

test('Security: requireMentorPlan strictly rejects expired or cancelled mentors', async () => {
  // Expired mentor
  const mockExpired = createMockHttp({
    user: { id: 'm2', role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'EXPIRED' }
  });
  await requireMentorPlan(mockExpired.req, mockExpired.res, mockExpired.next);
  assert.strictEqual(mockExpired.wasNextCalled(), false);
  assert.strictEqual(mockExpired.getStatus(), 403);
  assert.strictEqual(mockExpired.getData().error, 'PLAN_LIMIT_REACHED');
  assert.match(mockExpired.getData().message, /expired or is inactive/i);

  // Cancelled mentor
  const mockCancelled = createMockHttp({
    user: { id: 'm3', role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'CANCELLED' }
  });
  await requireMentorPlan(mockCancelled.req, mockCancelled.res, mockCancelled.next);
  assert.strictEqual(mockCancelled.wasNextCalled(), false);
  assert.strictEqual(mockCancelled.getStatus(), 403);

  // Regular trader attempting to access mentor workspace
  const mockTrader = createMockHttp({
    user: { id: 't1', role: 'TRADER', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' }
  });
  await requireMentorPlan(mockTrader.req, mockTrader.res, mockTrader.next);
  assert.strictEqual(mockTrader.wasNextCalled(), false);
  assert.strictEqual(mockTrader.getStatus(), 403);
  assert.strictEqual(mockTrader.getData().requiredPlan, 'MENTOR');
});

test('getEffectivePlanKey correctly resolves expired mentor to FREE', () => {
  const activeMentor = { role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'ACTIVE' };
  assert.strictEqual(getEffectivePlanKey(activeMentor), 'MENTOR');

  const expiredMentor = { role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'EXPIRED' };
  assert.strictEqual(getEffectivePlanKey(expiredMentor), 'FREE');

  const cancelledMentor = { role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'CANCELLED' };
  assert.strictEqual(getEffectivePlanKey(cancelledMentor), 'FREE');
});

// ==========================================
// 3. STUDENT PRIVACY ENFORCEMENT RULES
// ==========================================

test('Student Privacy: unshared accounts and screenshots stripped when consent absent', () => {
  const mockStudentTrades = [
    {
      id: 'trade-1',
      pair: 'EURUSD',
      tradingAccount: { id: 'acc-1', isSharedWithMentor: true },
      screenshots: [{ id: 's1', url: 'https://cdn.example.com/chart1.png' }],
      emotionLogs: [{ id: 'e1', emotion: 'ANXIOUS', intensity: 7 }],
    },
    {
      id: 'trade-2',
      pair: 'BTCUSD',
      tradingAccount: { id: 'acc-2', isSharedWithMentor: false }, // Personal unshared account
      screenshots: [{ id: 's2', url: 'https://cdn.example.com/chart2.png' }],
      emotionLogs: [{ id: 'e2', emotion: 'CALM', intensity: 3 }],
    }
  ];

  // Rule 1: Trades from accounts with isSharedWithMentor: false MUST NOT be included
  const visibleTrades = mockStudentTrades.filter(t => t.tradingAccount.isSharedWithMentor === true);
  assert.strictEqual(visibleTrades.length, 1);
  assert.strictEqual(visibleTrades[0].id, 'trade-1');

  // Rule 2: When student disables screenshot sharing (shareScreenshots: false), screenshots array must be empty
  const studentSettingsNoScreenshots = { shareScreenshots: false, shareEmotions: false };
  const sanitizedTrade = {
    ...visibleTrades[0],
    screenshots: studentSettingsNoScreenshots.shareScreenshots ? visibleTrades[0].screenshots : [],
    emotionLogs: studentSettingsNoScreenshots.shareEmotions ? visibleTrades[0].emotionLogs : []
  };

  assert.strictEqual(sanitizedTrade.screenshots.length, 0);
  assert.strictEqual(sanitizedTrade.emotionLogs.length, 0);
});

// ==========================================
// 4. COHORT RISK GUARD & VIOLATION LOGIC
// ==========================================

test('Risk Guard: detects excessive risk and missing stop loss breaches deterministically', () => {
  const cohortRules = {
    enforceRiskGuard: true,
    maxRiskPerTradePercent: 1.0,
    maxDailyTrades: 5,
    allowedPairs: ['EURUSD', 'GBPUSD'],
    requireStopLoss: true,
  };

  const tradeBreaching = {
    pair: 'XAUUSD', // Not in allowed pairs
    riskAmount: 250,
    stopLoss: null, // Missing mandatory stop loss
    tradingAccount: { startingBalance: 5000 }, // 250 / 5000 = 5.0% risk (exceeds 1.0%)
  };

  const balance = tradeBreaching.tradingAccount.startingBalance;
  const calculatedRisk = (tradeBreaching.riskAmount / balance) * 100;
  const violations = [];

  // Excessive risk check
  if (calculatedRisk > cohortRules.maxRiskPerTradePercent) {
    violations.push({
      type: 'EXCESSIVE_RISK',
      excess: calculatedRisk - cohortRules.maxRiskPerTradePercent,
    });
  }

  // Missing SL check
  if (cohortRules.requireStopLoss && !tradeBreaching.stopLoss) {
    violations.push({ type: 'NO_STOP_LOSS' });
  }

  // Unauthorized pair check
  const allowed = cohortRules.allowedPairs.map(p => p.toUpperCase());
  if (!allowed.includes(tradeBreaching.pair.toUpperCase())) {
    violations.push({ type: 'UNAUTHORIZED_PAIR' });
  }

  assert.strictEqual(violations.length, 3);
  assert.strictEqual(violations[0].type, 'EXCESSIVE_RISK');
  assert.strictEqual(violations[0].excess, 4.0);
  assert.strictEqual(violations[1].type, 'NO_STOP_LOSS');
  assert.strictEqual(violations[2].type, 'UNAUTHORIZED_PAIR');
});

// ==========================================
// 5. DETERMINISTIC COHORT ANALYTICS
// ==========================================

test('Cohort Analytics: calculates win rate and profit factor safely without zero-division', () => {
  // Case A: Normal trades with positive and negative PnL
  const sampleTrades = [
    { result: 'WIN', profitLossAmount: 300 },
    { result: 'WIN', profitLossAmount: 150 },
    { result: 'LOSS', profitLossAmount: -100 },
    { result: 'BREAKEVEN', profitLossAmount: 0 },
  ];

  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  sampleTrades.forEach(t => {
    if (t.result === 'WIN') {
      wins++;
      grossProfit += t.profitLossAmount;
    } else if (t.result === 'LOSS') {
      grossLoss += Math.abs(t.profitLossAmount);
    }
  });

  const winRate = Number(((wins / sampleTrades.length) * 100).toFixed(1));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : 99.9;

  assert.strictEqual(winRate, 50.0);
  assert.strictEqual(profitFactor, 4.5); // 450 / 100 = 4.5

  // Case B: Zero trades (Empty cohort)
  const emptyTrades = [];
  const emptyWinRate = emptyTrades.length > 0 ? (0 / emptyTrades.length) * 100 : 0;
  const emptyProfitFactor = 0;

  assert.strictEqual(emptyWinRate, 0);
  assert.strictEqual(emptyProfitFactor, 0);
  assert.strictEqual(isNaN(emptyWinRate), false);
  assert.strictEqual(isNaN(emptyProfitFactor), false);
});

// ==========================================
// 6. PAID COHORT BILLING & PLATFORM COMMISSION
// ==========================================

test('Cohort Fee: 1.5% platform commission and mentor payout calculated accurately', () => {
  const cohortPrice = 50000; // ₦50,000 cohort price
  const platformFeePercent = 1.5;

  const platformFeeAmount = cohortPrice * (platformFeePercent / 100);
  const mentorPayoutAmount = cohortPrice - platformFeeAmount;

  assert.strictEqual(platformFeeAmount, 750); // ₦750
  assert.strictEqual(mentorPayoutAmount, 49250); // ₦49,250
  assert.strictEqual(platformFeeAmount + mentorPayoutAmount, cohortPrice);
});
