const test = require('node:test');
const assert = require('node:assert');
const {
  AI_FEATURE_LIMITS,
  getStartOfUtcMonth,
  canCreateTrades,
  canCreateAccount,
  canAttachScreenshot,
  checkAiAllowance,
  hasFeatureAccess,
  getQuotaSummary,
} = require('../src/services/entitlementService');
const {
  PLANS,
  getPlanConfig,
  getEffectivePlanKey,
  buildLimitReachedPayload,
} = require('../src/config/plans');
const {
  checkTradeLimit,
  checkAccountLimit,
  checkScreenshotLimit,
  requireFeature,
  requireProFeature,
  checkMt5SyncAllowed,
} = require('../src/middleware/subscriptionGate');

test('UTC month calculation is consistent across timezones', () => {
  const d = new Date(Date.UTC(2026, 9, 26, 17, 30, 0));
  const start = getStartOfUtcMonth(d);
  assert.strictEqual(start.getUTCFullYear(), 2026);
  assert.strictEqual(start.getUTCMonth(), 9);
  assert.strictEqual(start.getUTCDate(), 1);
  assert.strictEqual(start.getUTCHours(), 0);
  assert.strictEqual(start.getUTCMinutes(), 0);
  assert.strictEqual(start.getUTCSeconds(), 0);
});

test('Effective plan resolution handles expired, cancelled, and admin users accurately', () => {
  // Free fallback
  assert.strictEqual(getEffectivePlanKey(null), 'FREE');
  assert.strictEqual(getEffectivePlanKey({}), 'FREE');

  // Cancelled or expired subscriptions fall back to FREE
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'PRO', subscriptionStatus: 'CANCELLED' }), 'FREE');
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'STARTER', subscriptionStatus: 'EXPIRED' }), 'FREE');
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'PRO', subscriptionStatus: 'PAST_DUE' }), 'FREE');

  // Active subscriptions resolve to their plan
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }), 'STARTER');
  assert.strictEqual(getEffectivePlanKey({ subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' }), 'PRO');

  // Admin and Super Admin always get PRO
  assert.strictEqual(getEffectivePlanKey({ role: 'ADMIN' }), 'PRO');
  assert.strictEqual(getEffectivePlanKey({ role: 'SUPER_ADMIN' }), 'PRO');

  // Mentor role
  assert.strictEqual(getEffectivePlanKey({ role: 'MENTOR', subscriptionStatus: 'ACTIVE' }), 'MENTOR');
  assert.strictEqual(getEffectivePlanKey({ role: 'MENTOR', subscriptionStatus: 'EXPIRED' }), 'FREE');
});

test('canCreateTrades correctly evaluates monthly trade creation limits with mock DB', async () => {
  // Mock DB counting 19 trades for a Free user
  const mockPrisma19 = {
    user: { findUnique: async () => ({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'USER' }) },
    trade: { count: async () => 19 },
  };

  const res1 = await canCreateTrades({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, 1, mockPrisma19);
  assert.strictEqual(res1.allowed, true);
  assert.strictEqual(res1.current, 19);
  assert.strictEqual(res1.limit, 20);

  // Attempting to add 2 trades when 19 already created (19 + 2 = 21 > 20)
  const res2 = await canCreateTrades({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, 2, mockPrisma19);
  assert.strictEqual(res2.allowed, false);
  assert.strictEqual(res2.payload?.error, 'PLAN_LIMIT_REACHED');
  assert.strictEqual(res2.payload?.feature, 'trades');
  assert.strictEqual(res2.payload?.requiredPlan, 'STARTER');

  // Pro user has Infinity trade limit
  const resPro = await canCreateTrades({ id: 'uPro', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' }, 500, mockPrisma19);
  assert.strictEqual(resPro.allowed, true);
  assert.strictEqual(resPro.limit, Infinity);
});

test('canCreateAccount correctly checks active account limits', async () => {
  // Free user with 1 active account -> blocked from creating a 2nd
  const mockPrismaFree1 = {
    user: { findUnique: async () => ({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }) },
    tradingAccount: { count: async () => 1 },
  };

  const res1 = await canCreateAccount({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, mockPrismaFree1);
  assert.strictEqual(res1.allowed, false);
  assert.strictEqual(res1.payload?.error, 'PLAN_LIMIT_REACHED');
  assert.strictEqual(res1.payload?.feature, 'accounts');
  assert.strictEqual(res1.payload?.limit, 1);

  // Starter user with 2 active accounts -> allowed to create 3rd
  const mockPrismaStarter2 = {
    user: { findUnique: async () => ({ id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }) },
    tradingAccount: { count: async () => 2 },
  };
  const res2 = await canCreateAccount({ id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }, mockPrismaStarter2);
  assert.strictEqual(res2.allowed, true);

  // Starter user with 3 active accounts -> blocked from creating 4th
  const mockPrismaStarter3 = {
    user: { findUnique: async () => ({ id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }) },
    tradingAccount: { count: async () => 3 },
  };
  const res3 = await canCreateAccount({ id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }, mockPrismaStarter3);
  assert.strictEqual(res3.allowed, false);
  assert.strictEqual(res3.payload?.requiredPlan, 'PRO');
});

test('canAttachScreenshot respects tier limits (Free: 1, Starter: 3, Pro: 10, Mentor: Infinity)', async () => {
  // Free user with 1 screenshot attached -> blocked from attaching 2nd
  const mockPrismaFree1 = {
    tradeScreenshot: { count: async () => 1 },
  };
  const resFree = await canAttachScreenshot('t1', { id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, 1, mockPrismaFree1);
  assert.strictEqual(resFree.allowed, false);
  assert.strictEqual(resFree.payload?.limit, 1);

  // Starter user with 2 screenshots -> allowed to attach 3rd
  const mockPrismaStarter2 = {
    tradeScreenshot: { count: async () => 2 },
  };
  const resStarterAllowed = await canAttachScreenshot('t2', { id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }, 1, mockPrismaStarter2);
  assert.strictEqual(resStarterAllowed.allowed, true);

  // Starter user with 3 screenshots -> blocked
  const mockPrismaStarter3 = {
    tradeScreenshot: { count: async () => 3 },
  };
  const resStarterBlocked = await canAttachScreenshot('t2', { id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE' }, 1, mockPrismaStarter3);
  assert.strictEqual(resStarterBlocked.allowed, false);

  // Pro user with 6 screenshots (formerly blocked by hardcoded 6) -> allowed up to 10
  const mockPrismaPro6 = {
    tradeScreenshot: { count: async () => 6 },
  };
  const resPro6 = await canAttachScreenshot('t3', { id: 'u3', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' }, 1, mockPrismaPro6);
  assert.strictEqual(resPro6.allowed, true);

  // Pro user with 10 screenshots -> blocked
  const mockPrismaPro10 = {
    tradeScreenshot: { count: async () => 10 },
  };
  const resPro10 = await canAttachScreenshot('t3', { id: 'u3', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' }, 1, mockPrismaPro10);
  assert.strictEqual(resPro10.allowed, false);
});

test('checkAiAllowance correctly implements Free trial shared pool of 2 requests', async () => {
  // Free user with 1 completed AI request this month
  const mockPrismaFree1 = {
    userSettings: { findUnique: async () => ({ enableJahzAi: true }) },
    aiRequest: { count: async () => 1 },
  };

  const check1 = await checkAiAllowance({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, 'TRADE_REVIEW', mockPrismaFree1);
  assert.strictEqual(check1.allowed, true);

  // Free user with 2 completed AI requests this month -> blocked on next request
  const mockPrismaFree2 = {
    userSettings: { findUnique: async () => ({ enableJahzAi: true }) },
    aiRequest: { count: async () => 2 },
  };

  const check2 = await checkAiAllowance({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, 'CHAT_SUPPORT', mockPrismaFree2);
  assert.strictEqual(check2.allowed, false);
  assert.strictEqual(check2.payload?.error, 'PLAN_LIMIT_REACHED');

  // Free user attempting premium AI feature (e.g. EDGE_FINDER) -> blocked immediately
  const checkEdge = await checkAiAllowance({ id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }, 'EDGE_FINDER', mockPrismaFree1);
  assert.strictEqual(checkEdge.allowed, false);
  assert.strictEqual(checkEdge.payload?.requiredPlan, 'PRO');
});

test('hasFeatureAccess enforces feature gates correctly across tiers', () => {
  const freeUser = { subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'USER' };
  const starterUser = { subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE', role: 'USER' };
  const proUser = { subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'USER' };
  const syncPlusUser = { subscriptionPlan: 'SYNC_PLUS', subscriptionStatus: 'ACTIVE', role: 'USER' };
  const proSyncUser = { subscriptionPlan: 'PRO_SYNC', subscriptionStatus: 'ACTIVE', role: 'USER' };
  const eliteUser = { subscriptionPlan: 'ELITE', subscriptionStatus: 'ACTIVE', role: 'USER' };
  const adminUser = { role: 'ADMIN' };

  // MT5 sync: Free/Starter/Pro = false (local without sync), Sync Plus/Pro Sync/Elite/Admin = true
  assert.strictEqual(hasFeatureAccess(freeUser, 'mt5Sync'), false);
  assert.strictEqual(hasFeatureAccess(starterUser, 'mt5Sync'), false);
  assert.strictEqual(hasFeatureAccess(proUser, 'mt5Sync'), false);
  assert.strictEqual(hasFeatureAccess(syncPlusUser, 'mt5Sync'), true);
  assert.strictEqual(hasFeatureAccess(proSyncUser, 'mt5Sync'), true);
  assert.strictEqual(hasFeatureAccess(eliteUser, 'mt5Sync'), true);
  assert.strictEqual(hasFeatureAccess(adminUser, 'mt5Sync'), true);

  // Emotion Tracking: Free = false, Starter/Pro/Admin = true
  assert.strictEqual(hasFeatureAccess(freeUser, 'emotionTracking'), false);
  assert.strictEqual(hasFeatureAccess(starterUser, 'emotionTracking'), true);
  assert.strictEqual(hasFeatureAccess(proUser, 'emotionTracking'), true);

  // Rule Violations: Free = false, Starter/Pro/Admin = true
  assert.strictEqual(hasFeatureAccess(freeUser, 'ruleViolations'), false);
  assert.strictEqual(hasFeatureAccess(starterUser, 'ruleViolations'), true);

  // Prop Firm Cockpit: Free/Starter = false, Pro/Admin = true
  assert.strictEqual(hasFeatureAccess(freeUser, 'propFirmAccess'), false);
  assert.strictEqual(hasFeatureAccess(starterUser, 'propFirmAccess'), false);
  assert.strictEqual(hasFeatureAccess(proUser, 'propFirmAccess'), true);
  assert.strictEqual(hasFeatureAccess(adminUser, 'propFirmAccess'), true);

  // Reports (PDF): Free/Starter = false, Pro/Admin = true
  assert.strictEqual(hasFeatureAccess(freeUser, 'reportsAccess'), false);
  assert.strictEqual(hasFeatureAccess(starterUser, 'reportsAccess'), false);
  assert.strictEqual(hasFeatureAccess(proUser, 'reportsAccess'), true);
});

test('requireFeature middleware rejects unauthorized users with 403 PLAN_LIMIT_REACHED', async () => {
  const gate = requireFeature('emotionTracking', 'STARTER');

  // Test Free user blocked
  let status = null;
  let json = null;
  let nextCalled = false;
  const freeReq = { user: { id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  const res = {
    status(code) { status = code; return this; },
    json(data) { json = data; return this; }
  };

  await gate(freeReq, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(status, 403);
  assert.strictEqual(json?.error, 'PLAN_LIMIT_REACHED');
  assert.strictEqual(json?.feature, 'emotionTracking');
  assert.strictEqual(json?.requiredPlan, 'STARTER');

  // Test Starter user allowed
  let starterNextCalled = false;
  const starterReq = { user: { id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await gate(starterReq, {}, () => { starterNextCalled = true; });
  assert.strictEqual(starterNextCalled, true);
});

test('requireProFeature middleware blocks Free and Starter from Prop Firm endpoints', async () => {
  const gate = requireProFeature('prop_firm');

  // Free user blocked
  let freeStatus = null;
  let freeJson = null;
  const freeReq = { user: { id: 'u1', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  const resFree = {
    status(code) { freeStatus = code; return this; },
    json(data) { freeJson = data; return this; }
  };
  await gate(freeReq, resFree, () => {});
  assert.strictEqual(freeStatus, 403);
  assert.strictEqual(freeJson?.requiredPlan, 'PRO');

  // Starter user blocked
  let starterStatus = null;
  const starterReq = { user: { id: 'u2', subscriptionPlan: 'STARTER', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  const resStarter = {
    status(code) { starterStatus = code; return this; },
    json() { return this; }
  };
  await gate(starterReq, resStarter, () => {});
  assert.strictEqual(starterStatus, 403);

  // Pro user allowed
  let proNextCalled = false;
  const proReq = { user: { id: 'u3', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'USER' } };
  await gate(proReq, {}, () => { proNextCalled = true; });
  assert.strictEqual(proNextCalled, true);
});
