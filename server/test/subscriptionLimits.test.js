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

test('Starter Plan has correct limits (100 trades/mo, 3 accounts, 3 screenshots/trade, no MT5 sync in regional model)', () => {
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
  assert.strictEqual(config.mt5Sync, false);
});

test('Pro Plan has correct limits (Infinity trades/accounts, 10 screenshots, AI/PropFirm/Reports, sync in Sync Plus tier)', () => {
  const config = getPlanConfig('PRO');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.screenshotLimit, 10);
  assert.strictEqual(config.aiAccess, true);
  assert.strictEqual(config.propFirmAccess, true);
  assert.strictEqual(config.reportsAccess, true);
  assert.strictEqual(config.mt5Sync, false);
});

test('Sync Plus Plan has local MT5 Cloud Sync enabled at target price', () => {
  const config = getPlanConfig('SYNC_PLUS');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.screenshotLimit, 10);
  assert.strictEqual(config.aiAccess, true);
  assert.strictEqual(config.propFirmAccess, true);
  assert.strictEqual(config.mt5Sync, true);
  assert.strictEqual(config.priceNgn, 38000);
});

test('Pro Sync Plan has international MT5 Cloud Sync enabled ($27/mo)', () => {
  const config = getPlanConfig('PRO_SYNC');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.screenshotLimit, 10);
  assert.strictEqual(config.aiAccess, true);
  assert.strictEqual(config.propFirmAccess, true);
  assert.strictEqual(config.mt5Sync, true);
  assert.strictEqual(config.priceUsd, 27);
});

test('Elite Plan has highest individual trader limits and unlimited screenshots ($32/mo)', () => {
  const config = getPlanConfig('ELITE');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.screenshotLimit, Infinity);
  assert.strictEqual(config.aiAccess, true);
  assert.strictEqual(config.propFirmAccess, true);
  assert.strictEqual(config.mt5Sync, true);
  assert.strictEqual(config.priceUsd, 32);
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

test('checkMt5SyncAllowed middleware enforces MT5 Cloud Sync access according to regional tiers', async () => {
  const { checkMt5SyncAllowed } = require('../src/middleware/subscriptionGate');

  const createMockRes = () => {
    const res = {
      statusCode: null,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };
    return res;
  };

  // Test Free user blocked
  const freeRes = createMockRes();
  let freeNextCalled = false;
  const freeReq = { user: { id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(freeReq, freeRes, () => { freeNextCalled = true; });
  assert.strictEqual(freeNextCalled, false);
  assert.strictEqual(freeRes.statusCode, 403);
  assert.strictEqual(freeRes.jsonData?.error, 'PLAN_LIMIT_REACHED');
  assert.strictEqual(freeRes.jsonData?.feature, 'mt5_sync');

  // Test Starter user blocked under new regional sync tier policy
  const starterRes = createMockRes();
  let starterNextCalled = false;
  const starterReq = { user: { id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(starterReq, starterRes, () => { starterNextCalled = true; });
  assert.strictEqual(starterNextCalled, false);
  assert.strictEqual(starterRes.statusCode, 403);

  // Test Sync Plus user allowed
  let syncPlusNextCalled = false;
  const syncPlusReq = { user: { id: 'u3', subscriptionPlan: 'SYNC_PLUS', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(syncPlusReq, createMockRes(), () => { syncPlusNextCalled = true; });
  assert.strictEqual(syncPlusNextCalled, true);

  // Test Pro Sync user allowed
  let proSyncNextCalled = false;
  const proSyncReq = { user: { id: 'u4', subscriptionPlan: 'PRO_SYNC', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(proSyncReq, createMockRes(), () => { proSyncNextCalled = true; });
  assert.strictEqual(proSyncNextCalled, true);

  // Test Elite user allowed
  let eliteNextCalled = false;
  const eliteReq = { user: { id: 'u5', subscriptionPlan: 'ELITE', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await checkMt5SyncAllowed(eliteReq, createMockRes(), () => { eliteNextCalled = true; });
  assert.strictEqual(eliteNextCalled, true);

  // Test Mentor user allowed
  let mentorNextCalled = false;
  const mentorReq = { user: { id: 'u6', subscriptionPlan: 'MENTOR', subscriptionStatus: 'ACTIVE', role: 'MENTOR' } };
  await checkMt5SyncAllowed(mentorReq, createMockRes(), () => { mentorNextCalled = true; });
  assert.strictEqual(mentorNextCalled, true);

  // Test Admin allowed
  let adminNextCalled = false;
  const adminReq = { user: { id: 'u7', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'ADMIN' } };
  await checkMt5SyncAllowed(adminReq, createMockRes(), () => { adminNextCalled = true; });
  assert.strictEqual(adminNextCalled, true);
});
