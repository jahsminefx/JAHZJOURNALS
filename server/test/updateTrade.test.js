const assert = require('node:assert/strict');
const { test, describe, beforeEach, afterEach } = require('node:test');
const { PrismaClient } = require('@prisma/client');
const { updateTrade } = require('../src/controllers/tradeController');
const currencyService = require('../src/services/fx/currencyService');

const prisma = new PrismaClient();

describe('updateTrade Controller Suite', () => {
  let testUser;
  let testAccount;
  let testAccount2;
  let testTrade;

  beforeEach(async () => {
    // Create clean test user and accounts
    testUser = await prisma.user.create({
      data: {
        name: 'Test Trader',
        email: `updatetrade_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
        passwordHash: 'hashedpassword',
        role: 'TRADER',
        subscriptionPlan: 'PRO',
      },
    });

    testAccount = await prisma.tradingAccount.create({
      data: {
        userId: testUser.id,
        name: 'Primary USD Account',
        currency: 'USD',
        startingBalance: 10000,
        currentBalance: 10000,
      },
    });

    testAccount2 = await prisma.tradingAccount.create({
      data: {
        userId: testUser.id,
        name: 'Secondary EUR Account',
        currency: 'EUR',
        startingBalance: 5000,
        currentBalance: 5000,
      },
    });

    testTrade = await prisma.trade.create({
      data: {
        tradingAccountId: testAccount.id,
        pair: 'EURUSD',
        direction: 'BUY',
        status: 'ACTIVE',
        result: 'OPEN',
        entryPrice: 1.08500,
        stopLoss: 1.08000,
        takeProfit: 1.09500,
        lotSize: 1.0,
        riskAmount: 500,
        pips: 0,
      },
    });
  });

  afterEach(async () => {
    if (testTrade) {
      await prisma.trade.deleteMany({ where: { tradingAccountId: { in: [testAccount.id, testAccount2.id] } } });
    }
    if (testAccount || testAccount2) {
      await prisma.tradingAccount.deleteMany({ where: { userId: testUser.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  test('successfully updates trade fields and calculates pips without crashing', async () => {
    let responseStatus = 200;
    let responseData = null;

    const req = {
      params: { id: testTrade.id },
      user: { id: testUser.id },
      body: {
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.08500,
        exitPrice: 1.09000,
        status: 'CLOSED',
        profitLossAmount: 500,
        stopLoss: 1.08000,
        takeProfit: 1.09500,
        lotSize: 1.0,
      },
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await updateTrade(req, res);

    assert.equal(responseStatus, 200);
    assert.ok(responseData, 'Expected updated trade response');
    assert.equal(responseData.pair, 'EURUSD');
    assert.equal(responseData.status, 'CLOSED');
    assert.equal(responseData.result, 'WIN');
    // Pip diff: (1.09000 - 1.08500) / 0.0001 = 50 pips
    assert.equal(responseData.pips, 50);
    // FX rate reporting should be populated for USD account (1.0)
    assert.equal(responseData.fxRateToReporting, 1.0);
  });

  test('handles account switching and reconciles both accounts', async () => {
    let responseStatus = 200;
    let responseData = null;

    const req = {
      params: { id: testTrade.id },
      user: { id: testUser.id },
      body: {
        tradingAccountId: testAccount2.id,
        pair: 'GBPUSD',
        direction: 'SELL',
        entryPrice: 1.25000,
        exitPrice: 1.24000,
        status: 'CLOSED',
        profitLossAmount: 300,
      },
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await updateTrade(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseData.tradingAccountId, testAccount2.id);
    assert.equal(responseData.pair, 'GBPUSD');
    assert.equal(responseData.direction, 'SELL');
    assert.equal(responseData.status, 'CLOSED');
    assert.equal(responseData.result, 'WIN');
  });

  test('safely handles empty strings and nulls from form submission', async () => {
    let responseStatus = 200;
    let responseData = null;

    const req = {
      params: { id: testTrade.id },
      user: { id: testUser.id },
      body: {
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.08500,
        exitPrice: null,
        stopLoss: '',
        takeProfit: null,
        entryTime: '',
        exitTime: null,
        strategyId: null,
        setupId: '',
        notesBefore: null,
      },
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await updateTrade(req, res);

    assert.equal(responseStatus, 200);
    assert.ok(responseData);
    assert.equal(responseData.stopLoss, null);
    assert.equal(responseData.takeProfit, null);
  });
});
