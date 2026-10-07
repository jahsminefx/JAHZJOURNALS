const test = require('node:test');
const assert = require('node:assert');
const { PLANS, getPlanConfig, getEffectivePlanKey, buildLimitReachedPayload } = require('../src/config/plans');

test('Free Plan has correct limits (20 trades/mo, 1 account, 1 screenshot/trade, no MT5 sync)', () => {
  const config = getPlanConfig('FREE');
  assert.strictEqual(config.tradeLimit, 20);
  assert.strictEqual(config.accountLimit, 1);
  assert.strictEqual(config.screenshotLimit, 1);
  assert.strictEqual(config.aiAccess, false);
  assert.strictEqual(config.propFirmAccess, false);
  assert.strictEqual(config.reportsAccess, false);
  assert.strictEqual(config.mentorAccess, false);
  assert.strictEqual(config.mt5Sync, false);
});

test('Starter Plan has correct limits (100 trades/mo, 3 accounts, 3 screenshots/trade, MT5 sync enabled)', () => {
  const config = getPlanConfig('STARTER');
  assert.strictEqual(config.priceNgn, 4000);
  assert.strictEqual(config.priceFormatted, '₦4,000 / month');
  assert.strictEqual(config.tradeLimit, 100);
  assert.strictEqual(config.accountLimit, 3);
  assert.strictEqual(config.screenshotLimit, 3);
  assert.strictEqual(config.emotionTracking, true);
  assert.strictEqual(config.ruleViolations, true);
  assert.strictEqual(config.propFirmAccess, false);
  assert.strictEqual(config.aiAccess, false);
  assert.strictEqual(config.mt5Sync, true);
});

test('Pro Plan has correct limits (Infinity trades/accounts, 10 screenshots, AI/PropFirm/Reports/MT5 sync)', () => {
  const config = getPlanConfig('PRO');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.screenshotLimit, 10);
  assert.strictEqual(config.aiAccess, true);
  assert.strictEqual(config.propFirmAccess, true);
  assert.strictEqual(config.reportsAccess, true);
  assert.strictEqual(config.mt5Sync, true);
});

test('Mentor Plan has unlimited features, mentor access, and MT5 sync', () => {
  const config = getPlanConfig('MENTOR');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.mentorAccess, true);
  assert.strictEqual(config.mt5Sync, true);
});

test('Effective plan key resolution correctly falls back to FREE or active status', () => {
  assert.strictEqual(getEffectivePlanKey(null), 'FREE');
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }), 'STARTER');
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'PRO', subscriptionStatus: 'CANCELLED' }), 'FREE');
  assert.strictEqual(getEffectivePlanKey({ role: 'ADMIN' }), 'PRO');
  assert.strictEqual(getEffectivePlanKey({ role: 'MENTOR' }), 'MENTOR');
});

test('buildLimitReachedPayload produces consistent structured error object', () => {
  const payload = buildLimitReachedPayload({
    feature: 'trades',
    current: 50,
    limit: 50,
    userPlan: 'FREE',
    requiredPlan: 'STARTER',
  });

  assert.deepStrictEqual(payload, {
    error: 'PLAN_LIMIT_REACHED',
    feature: 'trades',
    current: 50,
    limit: 50,
    plan: 'FREE',
    requiredPlan: 'STARTER',
    message: "You've reached your Free plan limit of 50 trades this month. Upgrade to Starter to continue journaling without interruption."
  });
});

test('checkMt5SyncAllowed middleware blocks Free users and allows Starter/Pro/Mentor/Admin', async () => {
  const { checkMt5SyncAllowed } = require('../src/middleware/subscriptionGate');

  // Test Free user blocked
  let freeStatus = null;
  let freeJson = null;
  let freeNextCalled = false;
  const freeReq = { user: { id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  const freeRes = {
    status(code) { freeStatus = code; return this; },
    json(data) { freeJson = data; return this; }
  };
  await checkMt5SyncAllowed(freeReq, freeRes, () => { freeNextCalled = true; });
  assert.strictEqual(freeNextCalled, false);
  assert.strictEqual(freeStatus, 403);
  assert.strictEqual(freeJson?.error, 'PLAN_LIMIT_REACHED');
  assert.strictEqual(freeJson?.feature, 'mt5_sync');

  // Test Starter user allowed
  let starterNextCalled = false;
  const starterReq = { user: { id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(starterReq, {}, () => { starterNextCalled = true; });
  assert.strictEqual(starterNextCalled, true);

  // Test Pro user allowed
  let proNextCalled = false;
  const proReq = { user: { id: 'u3', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(proReq, {}, () => { proNextCalled = true; });
  assert.strictEqual(proNextCalled, true);

  // Test Mentor user allowed
  let mentorNextCalled = false;
  const mentorReq = { user: { id: 'u4', subscriptionPlan: 'MENTOR', subscriptionStatus: 'ACTIVE', role: 'MENTOR' } };
  await checkMt5SyncAllowed(mentorReq, {}, () => { mentorNextCalled = true; });
  assert.strictEqual(mentorNextCalled, true);
});
