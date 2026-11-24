const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createTrade, updateTrade } = require('../src/controllers/tradeController');
const { handleConfirmSave, handleChatTradeCapture } = require('../src/controllers/aiTradeCaptureController');
const { handleMtSyncWebhook } = require('../src/controllers/mtSyncController');
const { generateWeeklyReview } = require('../src/controllers/weeklyReviewController');

const prisma = new PrismaClient();

const createMockRes = () => {
  let statusCode = 200;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      body = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
  };
  return res;
};

describe('Editable Risk-to-Reward & Break-Even Isolation Suite', () => {
  let testUser;
  let testAccount;
  let syncToken;

  beforeEach(async () => {
    syncToken = `test_sync_rr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    testUser = await prisma.user.create({
      data: {
        name: 'RR Test Trader',
        email: `rr_tester_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`,
        passwordHash: 'hashedpassword',
        role: 'TRADER',
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
      },
    });

    testAccount = await prisma.tradingAccount.create({
      data: {
        userId: testUser.id,
        name: 'RR Primary Account',
        currency: 'USD',
        startingBalance: 10000,
        currentBalance: 10000,
        syncToken,
        syncEnabled: true,
      },
    });
  });

  afterEach(async () => {
    if (testAccount) {
      await prisma.weeklyReview.deleteMany({ where: { userId: testUser.id } });
      await prisma.notificationRecipient.deleteMany({ where: { userId: testUser.id } });
      await prisma.trade.deleteMany({ where: { tradingAccountId: testAccount.id } });
      await prisma.tradingAccount.deleteMany({ where: { userId: testUser.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  it('1. Manual create & update supports flexible R:R edits, rejects negatives, resets to auto, and keeps BE state intact', async () => {
    // Create closed break-even trade with custom R:R "1:3"
    const createReq = {
      user: { id: testUser.id },
      body: {
        tradingAccountId: testAccount.id,
        pair: 'EURUSD',
        direction: 'BUY',
        status: 'CLOSED',
        entryPrice: 1.1000,
        stopLoss: 1.1000, // trailed to break-even
        exitPrice: 1.1002,
        profitLossAmount: 0,
        breakEvenActivated: true,
        riskRewardRatio: '1:3',
      },
    };
    const createRes = createMockRes();
    await createTrade(createReq, createRes);

    assert.equal(createRes.getStatusCode(), 201);
    const created = createRes.getBody();
    assert.equal(created.riskRewardRatio, 3);
    assert.equal(created.isManualRiskReward, true);
    assert.equal(created.result, 'BREAKEVEN');
    assert.equal(created.breakEvenActivated, true);

    // Reject negative R:R with HTTP 400
    const negReq = {
      user: { id: testUser.id },
      params: { id: created.id },
      body: { riskRewardRatio: -1.5 },
    };
    const negRes = createMockRes();
    await updateTrade(negReq, negRes);
    assert.equal(negRes.getStatusCode(), 400);

    // Partial update (notes only) preserves manual R:R and break-even flags
    const noteReq = {
      user: { id: testUser.id },
      params: { id: created.id },
      body: { notesAfter: 'Trailed stop to BE after +1.5R move' },
    };
    const noteRes = createMockRes();
    await updateTrade(noteReq, noteRes);
    assert.equal(noteRes.getStatusCode(), 200);
    assert.equal(noteRes.getBody().riskRewardRatio, 3);
    assert.equal(noteRes.getBody().isManualRiskReward, true);
    assert.equal(noteRes.getBody().result, 'BREAKEVEN');
    assert.equal(noteRes.getBody().breakEvenActivated, true);

    // Edit R:R to explicit 0 ("0")
    const zeroReq = {
      user: { id: testUser.id },
      params: { id: created.id },
      body: { riskRewardRatio: '0', isManualRiskReward: true },
    };
    const zeroRes = createMockRes();
    await updateTrade(zeroReq, zeroRes);
    assert.equal(zeroRes.getStatusCode(), 200);
    assert.equal(zeroRes.getBody().riskRewardRatio, 0);
    assert.equal(zeroRes.getBody().isManualRiskReward, true);
    assert.equal(zeroRes.getBody().breakEvenActivated, true);

    // Set original SL/TP and Reset to Auto
    await prisma.trade.update({
      where: { id: created.id },
      data: { initialStopLoss: 1.0950, takeProfit: 1.1125 },
    });
    const resetReq = {
      user: { id: testUser.id },
      params: { id: created.id },
      body: { riskRewardRatio: null, isManualRiskReward: false },
    };
    const resetRes = createMockRes();
    await updateTrade(resetReq, resetRes);
    assert.equal(resetRes.getStatusCode(), 200);
    assert.equal(resetRes.getBody().riskRewardRatio, 2.5);
    assert.equal(resetRes.getBody().isManualRiskReward, false);
    assert.equal(resetRes.getBody().result, 'BREAKEVEN');
  });

  it('2. JAHZ AI card save persists manual R:R, rejects negative R:R, and preserves card edits across follow-up chat', async () => {
    // Follow-up chat turn should preserve card-edited manual R:R
    const chatReq = {
      user: { id: testUser.id, subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'TRADER' },
      body: {
        message: 'Also add note that I entered after London sweep',
        currentDraft: {
          tradingAccountId: testAccount.id,
          pair: 'BTCUSD',
          direction: 'BUY',
          status: 'CLOSED',
          entryPrice: 82000,
          stopLoss: 82000,
          exitPrice: 82005,
          grossProfit: 0,
          profitLossAmount: 0,
          breakEvenActivated: true,
          riskRewardRatio: 2.75,
          isManualRiskReward: true,
        },
        mockExtraction: {
          notes: 'Entered after London sweep',
          assistantReply: 'Updated your note.',
        },
      },
      files: [],
      protocol: 'http',
      get: () => 'localhost:5000',
    };
    const chatRes = createMockRes();
    await handleChatTradeCapture(chatReq, chatRes);
    assert.equal(chatRes.getStatusCode(), 200);
    assert.equal(chatRes.getBody().trade.riskRewardRatio, 2.75);
    assert.equal(chatRes.getBody().trade.isManualRiskReward, true);

    // Reject negative R:R in AI confirm-save
    const badSaveReq = {
      user: { id: testUser.id, subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'TRADER' },
      headers: {},
      body: {
        trade: {
          tradingAccountId: testAccount.id,
          pair: 'BTCUSD',
          direction: 'BUY',
          status: 'CLOSED',
          entryPrice: 82000,
          stopLoss: 82000,
          exitPrice: 82005,
          grossProfit: 0,
          profitLossAmount: 0,
          riskRewardRatio: -2,
          isManualRiskReward: true,
        },
      },
    };
    const badSaveRes = createMockRes();
    await handleConfirmSave(badSaveReq, badSaveRes);
    assert.equal(badSaveRes.getStatusCode(), 400);

    // Empty string R:R must not coerce to 0
    const emptySaveReq = {
      user: { id: testUser.id, subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'TRADER' },
      headers: {},
      body: {
        trade: {
          tradingAccountId: testAccount.id,
          pair: 'BTCUSD',
          direction: 'BUY',
          status: 'CLOSED',
          entryPrice: 82000,
          stopLoss: 82000,
          exitPrice: 82005,
          grossProfit: 0,
          profitLossAmount: 0,
          breakEvenActivated: true,
          riskRewardRatio: '',
          isManualRiskReward: false,
        },
      },
    };
    const emptySaveRes = createMockRes();
    await handleConfirmSave(emptySaveReq, emptySaveRes);
    assert.equal(emptySaveRes.getStatusCode(), 201);
    const savedEmpty = emptySaveRes.getBody().savedTrades[0];
    assert.equal(savedEmpty.riskRewardRatio, null);
    assert.equal(savedEmpty.isManualRiskReward, false);

    // Card-edited manual R:R is saved accurately
    const manualSaveReq = {
      user: { id: testUser.id, subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', role: 'TRADER' },
      headers: {},
      body: {
        trade: {
          tradingAccountId: testAccount.id,
          pair: 'XAUUSD',
          direction: 'SELL',
          status: 'CLOSED',
          entryPrice: 2650,
          stopLoss: 2650,
          exitPrice: 2649.5,
          grossProfit: 0,
          profitLossAmount: 0,
          breakEvenActivated: true,
          riskRewardRatio: 3.2,
          isManualRiskReward: true,
        },
      },
    };
    const manualSaveRes = createMockRes();
    await handleConfirmSave(manualSaveReq, manualSaveRes);
    assert.equal(manualSaveRes.getStatusCode(), 201);
    const savedManual = manualSaveRes.getBody().savedTrades[0];
    assert.equal(savedManual.riskRewardRatio, 3.2);
    assert.equal(savedManual.isManualRiskReward, true);
    assert.equal(savedManual.result, 'BREAKEVEN');
  });

  it('3. MT5 EA Webhook preserves initialStopLoss R:R on BE move and never overwrites user manual R:R', async () => {
    const ticket = `MT5_${Date.now()}`;

    // Step A: MT5 opens position with initial SL and TP (1:3 planned)
    const openReq = {
      headers: { 'x-sync-token': syncToken },
      body: {
        ticket,
        symbol: 'EURUSD',
        type: 'BUY',
        openPrice: 1.1000,
        stopLoss: 1.0950,
        takeProfit: 1.1150,
        lots: 1.0,
        openTime: '2026-11-20T09:00:00Z',
      },
    };
    const openRes = createMockRes();
    await handleMtSyncWebhook(openReq, openRes);
    assert.equal(openRes.getStatusCode(), 200);

    let synced = await prisma.trade.findFirst({
      where: { tradingAccountId: testAccount.id, externalId: ticket },
    });
    assert.equal(synced.initialStopLoss, 1.095);
    assert.equal(synced.riskRewardRatio, 3);
    assert.equal(synced.isManualRiskReward, false);

    // Step B: MT5 trails SL to entry (break-even) — auto R:R still preserved via initialStopLoss
    const modifyBeReq = {
      headers: { 'x-sync-token': syncToken },
      body: {
        ticket,
        symbol: 'EURUSD',
        type: 'BUY',
        openPrice: 1.1000,
        stopLoss: 1.1000,
        takeProfit: 1.1150,
        lots: 1.0,
      },
    };
    const modifyBeRes = createMockRes();
    await handleMtSyncWebhook(modifyBeReq, modifyBeRes);
    assert.equal(modifyBeRes.getStatusCode(), 200);

    synced = await prisma.trade.findUnique({ where: { id: synced.id } });
    assert.equal(synced.breakEvenActivated, true);
    assert.equal(synced.riskRewardRatio, 3, 'initialStopLoss should preserve 1:3 planned RR after BE move');

    // Step C: Trader manually edits R:R to 4.5, then MT5 closes the trade at BE
    const editReq = {
      user: { id: testUser.id },
      params: { id: synced.id },
      body: { riskRewardRatio: '4.5', isManualRiskReward: true },
    };
    const editRes = createMockRes();
    await updateTrade(editReq, editRes);
    assert.equal(editRes.getStatusCode(), 200);
    assert.equal(editRes.getBody().riskRewardRatio, 4.5);
    assert.equal(editRes.getBody().isManualRiskReward, true);

    const closeBeReq = {
      headers: { 'x-sync-token': syncToken },
      body: {
        ticket,
        symbol: 'EURUSD',
        type: 'BUY',
        openPrice: 1.1000,
        closePrice: 1.1000,
        stopLoss: 1.1000,
        takeProfit: 1.1150,
        lots: 1.0,
        profit: 0,
        commission: 0,
        swap: 0,
        isClosed: true,
        closeTime: '2026-11-20T12:00:00Z',
      },
    };
    const closeBeRes = createMockRes();
    await handleMtSyncWebhook(closeBeReq, closeBeRes);
    assert.equal(closeBeRes.getStatusCode(), 200);

    synced = await prisma.trade.findUnique({ where: { id: synced.id } });
    assert.equal(synced.status, 'CLOSED');
    assert.equal(synced.result, 'BREAKEVEN');
    assert.equal(synced.riskRewardRatio, 4.5, 'Manual R:R must NEVER be overwritten by MT5 sync close');
    assert.equal(synced.isManualRiskReward, true);
  });

  it('4. Weekly Review retains signed negative realized R:R while individual trade storage stays non-negative', async () => {
    await prisma.trade.create({
      data: {
        tradingAccountId: testAccount.id,
        pair: 'GBPUSD',
        direction: 'BUY',
        status: 'CLOSED',
        result: 'LOSS',
        entryPrice: 1.2500,
        stopLoss: 1.2450,
        exitPrice: 1.2450,
        profitLossAmount: -100,
        riskAmount: 100,
        riskRewardRatio: null,
        entryTime: new Date('2026-11-18T10:00:00Z'),
        exitTime: new Date('2026-11-18T11:00:00Z'),
      },
    });

    const req = {
      user: { id: testUser.id },
      body: {
        accountId: testAccount.id,
        weekStartDate: '2026-11-16',
        timezone: 'UTC',
      },
    };
    const res = createMockRes();
    await generateWeeklyReview(req, res);

    assert.equal(res.getStatusCode(), 201);
    assert.equal(res.getBody().data.averageRiskReward, -1);
  });
});
