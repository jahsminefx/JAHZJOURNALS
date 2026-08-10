const test = require('node:test');
const assert = require('node:assert');
const { PLANS, getPlanConfig, getEffectivePlanKey, buildLimitReachedPayload } = require('../src/config/plans');

test('Free Plan has correct limits (50 trades/mo, 1 account, 2 screenshots/trade)', () => {
  const config = getPlanConfig('FREE');
  assert.strictEqual(config.tradeLimit, 50);
  assert.strictEqual(config.accountLimit, 1);
  assert.strictEqual(config.screenshotLimit, 2);
  assert.strictEqual(config.aiAccess, false);
  assert.strictEqual(config.propFirmAccess, false);
  assert.strictEqual(config.reportsAccess, false);
  assert.strictEqual(config.mentorAccess, false);
});

test('Starter Plan has correct limits (300 trades/mo, 3 accounts, 6 screenshots/trade)', () => {
  const config = getPlanConfig('STARTER');
  assert.strictEqual(config.tradeLimit, 300);
  assert.strictEqual(config.accountLimit, 3);
  assert.strictEqual(config.screenshotLimit, 6);
  assert.strictEqual(config.emotionTracking, true);
  assert.strictEqual(config.ruleViolations, true);
  assert.strictEqual(config.propFirmAccess, false);
  assert.strictEqual(config.aiAccess, false);
});

test('Pro Plan has correct limits (Infinity trades/accounts, 10 screenshots, AI/PropFirm/Reports)', () => {
  const config = getPlanConfig('PRO');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.screenshotLimit, 10);
  assert.strictEqual(config.aiAccess, true);
  assert.strictEqual(config.propFirmAccess, true);
  assert.strictEqual(config.reportsAccess, true);
});

test('Mentor Plan has unlimited features and mentor access', () => {
  const config = getPlanConfig('MENTOR');
  assert.strictEqual(config.tradeLimit, Infinity);
  assert.strictEqual(config.accountLimit, Infinity);
  assert.strictEqual(config.mentorAccess, true);
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
