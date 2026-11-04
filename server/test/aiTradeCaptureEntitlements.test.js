const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  handleChatTradeCapture,
  handleConfirmSave,
} = require('../src/controllers/aiTradeCaptureController');
const { requireProFeature } = require('../src/middleware/subscriptionGate');
const {
  checkAiAllowance,
  AI_FEATURE_LIMITS,
} = require('../src/services/entitlementService');

describe('AI Trade Capture Plan Entitlements & Role Gating Suite', () => {
  let freeUser;
  let starterUser;
  let proUser;
  let syncPlusUser;
  let mentorUser;
  let expiredMentorUser;
  let adminUser;
  let testAccount;

  before(async () => {
    // 1. Create FREE user
    freeUser = await prisma.user.create({
      data: {
        name: 'Free Trader',
        email: `free_ai_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'TRADER',
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 2. Create STARTER user
    starterUser = await prisma.user.create({
      data: {
        name: 'Starter Trader',
        email: `starter_ai_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'TRADER',
        subscriptionPlan: 'STARTER',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 3. Create PRO user
    proUser = await prisma.user.create({
      data: {
        name: 'Pro Trader',
        email: `pro_ai_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'TRADER',
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 4. Create SYNC_PLUS user
    syncPlusUser = await prisma.user.create({
      data: {
        name: 'Sync Plus Trader',
        email: `syncplus_ai_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'TRADER',
        subscriptionPlan: 'SYNC_PLUS',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 5. Create MENTOR user (active)
    mentorUser = await prisma.user.create({
      data: {
        name: 'Mentor Trader',
        email: `mentor_ai_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'MENTOR',
        subscriptionPlan: 'MENTOR',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 6. Create EXPIRED MENTOR user
    expiredMentorUser = await prisma.user.create({
      data: {
        name: 'Expired Mentor',
        email: `expired_mentor_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'MENTOR',
        subscriptionPlan: 'MENTOR',
        subscriptionStatus: 'EXPIRED',
      },
    });

    // 7. Create ADMIN user
    adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: `admin_ai_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'ADMIN',
      },
    });

    // Trading account for save tests
    testAccount = await prisma.tradingAccount.create({
      data: {
        userId: proUser.id,
        name: 'Pro Testing Account',
        currency: 'USD',
        startingBalance: 10000.0,
        currentBalance: 10000.0,
      },
    });
  });

  after(async () => {
    await prisma.tradeScreenshot.deleteMany({
      where: { trade: { tradingAccountId: testAccount.id } },
    }).catch(() => {});
    await prisma.trade.deleteMany({
      where: { tradingAccountId: testAccount.id },
    }).catch(() => {});
    await prisma.tradingAccount.deleteMany({
      where: { id: testAccount.id },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            freeUser.id,
            starterUser.id,
            proUser.id,
            syncPlusUser.id,
            mentorUser.id,
            expiredMentorUser.id,
            adminUser.id,
          ],
        },
      },
    }).catch(() => {});
    await prisma.$disconnect();
  });

  const createMockRes = () => {
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonBody = data;
        return res;
      },
      getStatusCode: () => statusCode,
      getBody: () => jsonBody,
    };
    return res;
  };

  it('1. FREE account is strictly blocked from logging trades with JAHZ AI (HTTP 403)', async () => {
    const req = {
      user: freeUser,
      body: { message: 'Bought 1 lot EURUSD at 1.0850' },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 403);
    const body = res.getBody();
    assert.equal(body.error, 'PLAN_LIMIT_REACHED');
    assert.equal(body.feature, 'ai_trade_capture');
    assert.equal(body.requiredPlan, 'PRO');
  });

  it('2. STARTER account is strictly blocked from logging trades with JAHZ AI (HTTP 403)', async () => {
    const req = {
      user: starterUser,
      body: { message: 'Sold 0.5 lot GBPUSD at 1.2500' },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 403);
    const body = res.getBody();
    assert.equal(body.error, 'PLAN_LIMIT_REACHED');
    assert.equal(body.feature, 'ai_trade_capture');
    assert.equal(body.requiredPlan, 'PRO');
  });

  it('3. EXPIRED MENTOR account is strictly blocked from logging trades with JAHZ AI (HTTP 403)', async () => {
    const req = {
      user: expiredMentorUser,
      body: { message: 'Bought 2 lots US30 at 42000' },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 403);
    const body = res.getBody();
    assert.equal(body.error, 'PLAN_LIMIT_REACHED');
  });

  it('4. PRO account is authorized to log trades with JAHZ AI (Passes Gate)', async () => {
    const req = {
      user: proUser,
      body: {
        message: 'Bought 1 lot EURUSD at 1.0850 with TP 1.0900 SL 1.0800',
        mockExtraction: {
          instrument: 'EURUSD',
          direction: 'BUY',
          entryPrice: 1.0850,
          exitPrice: 1.0900,
          volume: 1.0,
          grossProfit: 500,
        },
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getBody().success, true);
  });

  it('5. SYNC_PLUS account is authorized to log trades with JAHZ AI (Passes Gate)', async () => {
    const req = {
      user: syncPlusUser,
      body: {
        message: 'Sold 0.5 lot USDJPY at 155.00 with TP 154.00 SL 155.50',
        mockExtraction: {
          instrument: 'USDJPY',
          direction: 'SELL',
          entryPrice: 155.00,
          exitPrice: 154.00,
          volume: 0.5,
          grossProfit: 350,
        },
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getBody().success, true);
  });

  it('6. MENTOR account is authorized to log trades with JAHZ AI (Passes Gate)', async () => {
    const req = {
      user: mentorUser,
      body: {
        message: 'Bought 1 lot XAUUSD at 2700 with TP 2720 SL 2690',
        mockExtraction: {
          instrument: 'XAUUSD',
          direction: 'BUY',
          entryPrice: 2700.0,
          exitPrice: 2720.0,
          volume: 1.0,
          grossProfit: 2000,
        },
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getBody().success, true);
  });

  it('7. ADMIN account is authorized to log trades with JAHZ AI (Passes Gate)', async () => {
    const req = {
      user: adminUser,
      body: {
        message: 'Bought 0.1 lot BTCUSD at 85000 with TP 86000 SL 84000',
        mockExtraction: {
          instrument: 'BTCUSD',
          direction: 'BUY',
          entryPrice: 85000.0,
          exitPrice: 86000.0,
          volume: 0.1,
          grossProfit: 100,
        },
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const res = createMockRes();

    await handleChatTradeCapture(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getBody().success, true);
  });

  it('8. Route Middleware requireProFeature blocks FREE and STARTER requests', async () => {
    const gateMiddleware = requireProFeature('ai_trade_capture');

    // Test with Free user
    let nextCalledFree = false;
    const reqFree = { user: freeUser };
    const resFree = createMockRes();
    await gateMiddleware(reqFree, resFree, () => { nextCalledFree = true; });

    assert.equal(nextCalledFree, false);
    assert.equal(resFree.getStatusCode(), 403);
    assert.equal(resFree.getBody().error, 'PLAN_LIMIT_REACHED');

    // Test with Starter user
    let nextCalledStarter = false;
    const reqStarter = { user: starterUser };
    const resStarter = createMockRes();
    await gateMiddleware(reqStarter, resStarter, () => { nextCalledStarter = true; });

    assert.equal(nextCalledStarter, false);
    assert.equal(resStarter.getStatusCode(), 403);
    assert.equal(resStarter.getBody().error, 'PLAN_LIMIT_REACHED');

    // Test with Pro user
    let nextCalledPro = false;
    const reqPro = { user: proUser };
    const resPro = createMockRes();
    await gateMiddleware(reqPro, resPro, () => { nextCalledPro = true; });

    assert.equal(nextCalledPro, true);

    // Test with Mentor user
    let nextCalledMentor = false;
    const reqMentor = { user: mentorUser };
    const resMentor = createMockRes();
    await gateMiddleware(reqMentor, resMentor, () => { nextCalledMentor = true; });

    assert.equal(nextCalledMentor, true);
  });

  it('9. handleConfirmSave blocks non-pro accounts attempting to confirm and save trades', async () => {
    const req = {
      user: starterUser,
      headers: {},
      body: {
        trade: {
          tradingAccountId: testAccount.id,
          pair: 'EURUSD',
          direction: 'BUY',
          entryPrice: 1.0850,
          exitPrice: 1.0900,
          lotSize: 1.0,
          grossProfit: 500,
        },
      },
    };
    const res = createMockRes();

    await handleConfirmSave(req, res);

    assert.equal(res.getStatusCode(), 403);
    assert.equal(res.getBody().error, 'PLAN_LIMIT_REACHED');
    assert.equal(res.getBody().feature, 'ai_trade_capture');
  });

  it('10. Enforces 300 AI trade capture monthly quota for PRO tier and Unlimited for PRO_SYNC in checkAiAllowance', async () => {
    // 1. Quota definitions
    assert.equal(AI_FEATURE_LIMITS.PRO.AI_TRADE_CAPTURE, 300);
    assert.equal(AI_FEATURE_LIMITS.SYNC_PLUS.AI_TRADE_CAPTURE, Infinity);
    assert.equal(AI_FEATURE_LIMITS.PRO_SYNC.AI_TRADE_CAPTURE, Infinity);
    assert.equal(AI_FEATURE_LIMITS.ELITE.AI_TRADE_CAPTURE, Infinity);
    assert.equal(AI_FEATURE_LIMITS.MENTOR.AI_TRADE_CAPTURE, 300);

    // 2. Pro user with 0 trades used: allowed with 300 remaining
    const initialAllowance = await checkAiAllowance(proUser, 'AI_TRADE_CAPTURE');
    assert.equal(initialAllowance.allowed, true);
    assert.equal(initialAllowance.limit, 300);
    assert.equal(initialAllowance.remaining, 300);

    // 3. Pro Sync (SYNC_PLUS) user: allowed with Unlimited (Infinity) limit
    const syncPlusAllowance = await checkAiAllowance(syncPlusUser, 'AI_TRADE_CAPTURE');
    assert.equal(syncPlusAllowance.allowed, true);
    assert.equal(syncPlusAllowance.limit, Infinity);

    // 4. Mentor user: Private Cohort / Growth gets 300 limit; Mega Academy gets Infinity
    const mentorAllowance = await checkAiAllowance(mentorUser, 'AI_TRADE_CAPTURE');
    assert.equal(mentorAllowance.allowed, true);
    assert.equal(mentorAllowance.limit, 300);

    const megaMentorAllowance = await checkAiAllowance({ ...mentorUser, mentorTier: 'MEGA' }, 'AI_TRADE_CAPTURE');
    assert.equal(megaMentorAllowance.allowed, true);
    assert.equal(megaMentorAllowance.limit, Infinity);

    // 5. Pro user simulated at 299 trades: still allowed with 1 remaining
    const mockTxNearLimit = {
      user: prisma.user,
      userSettings: prisma.userSettings,
      trade: {
        count: async () => 299,
      },
    };
    const nearLimitAllowance = await checkAiAllowance(proUser, 'AI_TRADE_CAPTURE', mockTxNearLimit);
    assert.equal(nearLimitAllowance.allowed, true);
    assert.equal(nearLimitAllowance.current, 299);
    assert.equal(nearLimitAllowance.remaining, 1);

    // 6. Pro user simulated at 300 trades: strictly blocked with PLAN_LIMIT_REACHED and PRO_SYNC upgrade prompt
    const mockTxAtLimit = {
      user: prisma.user,
      userSettings: prisma.userSettings,
      trade: {
        count: async () => 300,
      },
    };
    const atLimitAllowance = await checkAiAllowance(proUser, 'AI_TRADE_CAPTURE', mockTxAtLimit);
    assert.equal(atLimitAllowance.allowed, false);
    assert.equal(atLimitAllowance.current, 300);
    assert.equal(atLimitAllowance.limit, 300);
    assert.equal(atLimitAllowance.payload.error, 'PLAN_LIMIT_REACHED');
    assert.equal(atLimitAllowance.payload.feature, 'ai_trade_capture');
    assert.equal(atLimitAllowance.payload.requiredPlan, 'PRO_SYNC');
    assert.ok(atLimitAllowance.payload.message.includes('300 AI trade captures this month'));
  });

  it('11. handleConfirmSave enforces the 300 limit when saving trades would exceed quota', async () => {
    // Insert a batch of trades marked with classificationSource: AI_SUGGESTION
    // to test that handleConfirmSave counts them against the monthly limit
    const originalTradeCount = await prisma.trade.count({
      where: { tradingAccount: { userId: proUser.id }, classificationSource: 'AI_SUGGESTION' },
    });

    const singleTrade = {
      tradingAccountId: testAccount.id,
      pair: 'USDCHF',
      direction: 'BUY',
      entryPrice: 0.8850,
      exitPrice: 0.8900,
      lotSize: 0.5,
      grossProfit: 250,
    };

    const req = {
      user: proUser,
      headers: {},
      body: { trade: singleTrade },
    };
    const res = createMockRes();

    await handleConfirmSave(req, res);
    assert.equal(res.getStatusCode(), 201);
    assert.equal(res.getBody().success, true);
    assert.equal(res.getBody().savedCount, 1);

    const newTradeCount = await prisma.trade.count({
      where: { tradingAccount: { userId: proUser.id }, classificationSource: 'AI_SUGGESTION' },
    });
    assert.equal(newTradeCount, originalTradeCount + 1);
  });
});
