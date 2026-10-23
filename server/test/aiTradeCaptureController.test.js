const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  handleConfirmSave,
} = require('../src/controllers/aiTradeCaptureController');

describe('AI Trade Capture Controller Integration Suite', () => {
  let testUser;
  let testAccount;

  before(async () => {
    // Create test user and account
    testUser = await prisma.user.create({
      data: {
        name: 'AI Capture Tester',
        email: `ai_tester_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        role: 'TRADER',
      },
    });

    testAccount = await prisma.tradingAccount.create({
      data: {
        userId: testUser.id,
        name: 'AI Test Prop Account',
        currency: 'USD',
        startingBalance: 10000.0,
        currentBalance: 10000.0,
      },
    });
  });

  after(async () => {
    // Cleanup test records
    await prisma.tradeScreenshot.deleteMany({
      where: { trade: { tradingAccountId: testAccount.id } },
    });
    await prisma.trade.deleteMany({
      where: { tradingAccountId: testAccount.id },
    });
    await prisma.tradingAccount.deleteMany({
      where: { id: testAccount.id },
    });
    await prisma.user.deleteMany({
      where: { id: testUser.id },
    });
    await prisma.$disconnect();
  });

  it('1. Rejects trade creation if trading account does not belong to authenticated user', async () => {
    const fakeReq = {
      user: { id: 'some-other-user-uuid' },
      headers: {},
      body: {
        trade: {
          tradingAccountId: testAccount.id, // belongs to testUser, not some-other-user
          pair: 'EURUSD',
          direction: 'BUY',
        },
      },
    };

    let responseStatus = null;
    let responseBody = null;
    const fakeRes = {
      status: (code) => { responseStatus = code; return fakeRes; },
      json: (data) => { responseBody = data; return fakeRes; },
    };

    await handleConfirmSave(fakeReq, fakeRes);
    assert.equal(responseStatus, 400);
    assert.equal(responseBody.failedCount, 1);
    assert.ok(responseBody.failedTrades[0].error.includes('unauthorized') || responseBody.failedTrades[0].error.includes('not found'));
  });

  it('2. Successfully persists an AI-extracted trade, links screenshot, and updates balance', async () => {
    const candidateTrade = {
      tradingAccountId: testAccount.id,
      pair: 'BTCUSD',
      direction: 'BUY',
      entryPrice: 82351.75,
      exitPrice: 82361.97,
      lotSize: 0.22,
      grossProfit: 2.25,
      commission: -0.66,
      swap: 0.00,
      profitLossAmount: 1.59,
      status: 'CLOSED',
      breakEvenActivated: true,
      breakEvenPrice: 82370.08,
      externalId: '43789391',
      imageUrl: '/uploads/screenshots/test/sample.png',
      screenshotType: 'BROKER_RECEIPT',
    };

    const fakeReq = {
      user: { id: testUser.id },
      headers: {},
      body: { trade: candidateTrade },
    };

    let responseStatus = null;
    let responseBody = null;
    const fakeRes = {
      status: (code) => { responseStatus = code; return fakeRes; },
      json: (data) => { responseBody = data; return fakeRes; },
    };

    await handleConfirmSave(fakeReq, fakeRes);
    assert.equal(responseStatus, 201);
    assert.equal(responseBody.savedCount, 1);

    const savedTrade = responseBody.savedTrades[0];
    assert.equal(savedTrade.pair, 'BTCUSD');
    // Positive net profit +$1.59 with default 0.00 tolerance is a WIN, while preserving BE management
    assert.equal(savedTrade.result, 'WIN');
    assert.equal(savedTrade.breakEvenActivated, true);
    assert.equal(savedTrade.profitLossAmount, 1.59);
    assert.equal(savedTrade.externalId, '43789391');

    // Verify screenshot was attached
    const attachedScreenshot = await prisma.tradeScreenshot.findFirst({
      where: { tradeId: savedTrade.id },
    });
    assert.ok(attachedScreenshot, 'TradeScreenshot must be attached to the saved trade');
    assert.equal(attachedScreenshot.imageUrl, '/uploads/screenshots/test/sample.png');

    // Verify account balance updated
    const updatedAccount = await prisma.tradingAccount.findUnique({
      where: { id: testAccount.id },
    });
    assert.equal(updatedAccount.currentBalance, 10001.59, 'Balance incremented by net profit 1.59');
  });

  it('3. Repeated save with same idempotency key does not create duplicate trade', async () => {
    const key = `idem_${Date.now()}`;
    const candidateTrade = {
      tradingAccountId: testAccount.id,
      pair: 'XAUUSD',
      direction: 'SELL',
      entryPrice: 2740.0,
      exitPrice: 2730.0,
      lotSize: 0.5,
      profitLossAmount: 500.0,
      status: 'CLOSED',
    };

    const makeCall = async () => {
      let responseStatus = null;
      let responseBody = null;
      const fakeRes = {
        status: (code) => { responseStatus = code; return fakeRes; },
        json: (data) => { responseBody = data; return fakeRes; },
      };
      const fakeReq = {
        user: { id: testUser.id },
        headers: { 'x-idempotency-key': key },
        body: { trade: candidateTrade },
      };
      await handleConfirmSave(fakeReq, fakeRes);
      return { status: responseStatus, body: responseBody };
    };

    const first = await makeCall();
    assert.equal(first.status, 201);
    assert.equal(first.body.savedCount, 1);
    const tradeId1 = first.body.savedTrades[0].id;

    // Second call with same idempotency key (e.g. user double-clicked or network retried)
    const second = await makeCall();
    assert.equal(second.status, 200, 'Returns 200 cached response');
    assert.equal(second.body.savedTrades[0].id, tradeId1, 'Must return same trade instead of creating new');

    // Verify count in database
    const dbCount = await prisma.trade.count({
      where: { tradingAccountId: testAccount.id, pair: 'XAUUSD' },
    });
    assert.equal(dbCount, 1, 'Only one trade must be created in DB');
  });
});
