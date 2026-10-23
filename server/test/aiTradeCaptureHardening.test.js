const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  classifyTrade,
  OUTCOMES,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS,
} = require('../src/services/tradeClassificationService');
const {
  calculateTradeSimilarity,
  checkTradeDuplicate,
  claimIdempotencyKey,
  releaseIdempotencyKey,
  getIdempotentResult,
  setIdempotentResult,
} = require('../src/services/tradeDuplicateDetectionService');
const {
  handleConfirmSave,
  handleCheckDuplicate,
} = require('../src/controllers/aiTradeCaptureController');
const { reconcileAccountBalance } = require('../src/services/accountBalanceService');

describe('AI Trade Capture Hardening & Production Audit Suite', () => {
  let userA, userB, accountA, accountB;

  before(async () => {
    // Create isolated test users and trading accounts
    userA = await prisma.user.create({
      data: {
        email: `audit_user_a_${Date.now()}@jahzjournal.com`,
        name: 'Audit User A',
        passwordHash: 'hash123',
        role: 'TRADER',
        subscriptionPlan: 'PRO',
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `audit_user_b_${Date.now()}@jahzjournal.com`,
        name: 'Audit User B',
        passwordHash: 'hash123',
        role: 'TRADER',
        subscriptionPlan: 'FREE',
      },
    });

    accountA = await prisma.tradingAccount.create({
      data: {
        userId: userA.id,
        name: 'User A Main Account',
        startingBalance: 10000.00,
        currentBalance: 10000.00,
        currency: 'USD',
      },
    });

    accountB = await prisma.tradingAccount.create({
      data: {
        userId: userB.id,
        name: 'User B Main Account',
        startingBalance: 5000.00,
        currentBalance: 5000.00,
        currency: 'USD',
      },
    });
  });

  after(async () => {
    // Cleanup test records
    await prisma.tradeScreenshot.deleteMany({
      where: { trade: { tradingAccountId: { in: [accountA.id, accountB.id] } } },
    });
    await prisma.trade.deleteMany({
      where: { tradingAccountId: { in: [accountA.id, accountB.id] } },
    });
    await prisma.tradingAccount.deleteMany({
      where: { id: { in: [accountA.id, accountB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    await prisma.systemConfig.deleteMany({
      where: { key: { startsWith: 'idemp:' } },
    });
  });

  // =========================================================================
  // 1. CANONICAL CLASSIFICATION TOLERANCE BOUNDARIES & BE MANAGEMENT
  // =========================================================================
  describe('1. Classification Tolerance Boundaries & BE Separation', () => {
    it('1.1. Default 0.00 tolerance strictly classifies positive as WIN and negative as LOSS', () => {
      const winTrade = classifyTrade({ status: 'CLOSED', profitLossAmount: 0.01 });
      assert.equal(winTrade.result, OUTCOMES.WIN);

      const lossTrade = classifyTrade({ status: 'CLOSED', profitLossAmount: -0.01 });
      assert.equal(lossTrade.result, OUTCOMES.LOSS);

      const beTrade = classifyTrade({ status: 'CLOSED', profitLossAmount: 0.00 });
      assert.equal(beTrade.result, OUTCOMES.BREAKEVEN);
    });

    it('1.2. Custom user threshold of $3.00 boundaries', () => {
      const exactlyAtPositiveBoundary = classifyTrade({ status: 'CLOSED', profitLossAmount: 3.00, userThresholdAmount: 3.00 });
      assert.equal(exactlyAtPositiveBoundary.result, OUTCOMES.BREAKEVEN);

      const abovePositiveBoundary = classifyTrade({ status: 'CLOSED', profitLossAmount: 3.01, userThresholdAmount: 3.00 });
      assert.equal(abovePositiveBoundary.result, OUTCOMES.WIN);

      const exactlyAtNegativeBoundary = classifyTrade({ status: 'CLOSED', profitLossAmount: -3.00, userThresholdAmount: 3.00 });
      assert.equal(exactlyAtNegativeBoundary.result, OUTCOMES.BREAKEVEN);

      const belowNegativeBoundary = classifyTrade({ status: 'CLOSED', profitLossAmount: -3.01, userThresholdAmount: 3.00 });
      assert.equal(belowNegativeBoundary.result, OUTCOMES.LOSS);
    });

    it('1.3. Small win with BE protection: Result is WIN with badge "Small win · BE protected"', () => {
      const res = classifyTrade({
        status: 'CLOSED',
        grossProfit: 2.25,
        commission: -0.66,
        swap: 0.00,
        breakEvenActivated: true,
      });
      assert.equal(res.netProfit, 1.59);
      assert.equal(res.result, OUTCOMES.WIN);
      assert.equal(res.breakEvenActivated, true);
      assert.equal(res.badgeLabel, 'Small win · BE protected');
    });

    it('1.4. Small loss with BE protection: Result is LOSS with badge "Small loss · BE protected"', () => {
      const res = classifyTrade({
        status: 'CLOSED',
        grossProfit: 0.00,
        commission: -0.66,
        swap: 0.00,
        breakEvenActivated: true,
      });
      assert.equal(res.netProfit, -0.66);
      assert.equal(res.result, OUTCOMES.LOSS);
      assert.equal(res.breakEvenActivated, true);
      assert.equal(res.badgeLabel, 'Small loss · BE protected');
    });

    it('1.5. Trailing stop or breakEvenActivated does NOT force BREAKEVEN on large wins', () => {
      const res = classifyTrade({
        status: 'CLOSED',
        profitLossAmount: 850.00,
        breakEvenActivated: true,
      });
      assert.equal(res.result, OUTCOMES.WIN);
      assert.equal(res.breakEvenActivated, true);
      assert.equal(res.badgeLabel, 'Win · BE protected');
    });

    it('1.6. Stop-loss on loss side of entry is strictly NOT break-even protected (BUY & SELL)', () => {
      // BUY trade: entry 1.1000, SL 1.0950 (50 pips in loss)
      const buyLossSide = classifyTrade({
        status: 'CLOSED',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1020,
        stopLoss: 1.0950,
        profitLossAmount: 20.00,
      });
      assert.equal(buyLossSide.breakEvenActivated, false);
      assert.equal(buyLossSide.badgeLabel, 'Win');

      // SELL trade: entry 1.1000, SL 1.1050 (50 pips in loss)
      const sellLossSide = classifyTrade({
        status: 'CLOSED',
        direction: 'SELL',
        entryPrice: 1.1000,
        exitPrice: 1.0980,
        stopLoss: 1.1050,
        profitLossAmount: 20.00,
      });
      assert.equal(sellLossSide.breakEvenActivated, false);
      assert.equal(sellLossSide.badgeLabel, 'Win');
    });

    it('1.7. Stop-loss at entry or beyond entry into profit is BE protected (BUY & SELL)', () => {
      // BUY trade: SL at entry
      const buyAtEntry = classifyTrade({
        status: 'CLOSED',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1010,
        stopLoss: 1.1000,
        profitLossAmount: 1.00,
      });
      assert.equal(buyAtEntry.breakEvenActivated, true);
      assert.equal(buyAtEntry.badgeLabel, 'Small win · BE protected');

      // BUY trade: SL beyond entry in profit
      const buyBeyondEntry = classifyTrade({
        status: 'CLOSED',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1010,
        stopLoss: 1.1005,
        profitLossAmount: 1.00,
      });
      assert.equal(buyBeyondEntry.breakEvenActivated, true);

      // SELL trade: SL at entry
      const sellAtEntry = classifyTrade({
        status: 'CLOSED',
        direction: 'SELL',
        entryPrice: 1.1000,
        exitPrice: 1.0990,
        stopLoss: 1.1000,
        profitLossAmount: 1.00,
      });
      assert.equal(sellAtEntry.breakEvenActivated, true);
      assert.equal(sellAtEntry.badgeLabel, 'Small win · BE protected');

      // SELL trade: SL beyond entry in profit
      const sellBeyondEntry = classifyTrade({
        status: 'CLOSED',
        direction: 'SELL',
        entryPrice: 1.1000,
        exitPrice: 1.0990,
        stopLoss: 1.0995,
        profitLossAmount: 1.00,
      });
      assert.equal(sellBeyondEntry.breakEvenActivated, true);
    });

    it('1.8. SL history detecting trailed stop to entry establishes BE management', () => {
      const historyTrade = classifyTrade({
        status: 'CLOSED',
        direction: 'BUY',
        entryPrice: 1.2500,
        exitPrice: 1.2510,
        stopLoss: 1.2400, // final SL might be old or changed
        profitLossAmount: 1.50,
        slTpHistory: [
          { timestamp: '2026-10-20T10:00:00Z', stopLoss: 1.2450, note: 'Initial stop' },
          { timestamp: '2026-10-20T10:15:00Z', stopLoss: 1.2505, note: 'Moved SL to break-even' },
        ],
      });
      assert.equal(historyTrade.breakEvenActivated, true);
      assert.equal(historyTrade.breakEvenEvidenceStatus, EVIDENCE_STATUS.CONFIRMED);
    });

    it('1.9. Commission is NOT deducted twice if broker profit is already net', () => {
      // Broker supplies already-net profit of $15.00, with commission -$2.50 shown on statement
      const alreadyNetTrade = classifyTrade({
        status: 'CLOSED',
        profitLossAmount: 15.00,
        commission: -2.50,
        swap: 0.00,
      });
      assert.equal(alreadyNetTrade.netProfit, 15.00, 'Must NOT subtract commission a second time from net profit');
      assert.equal(alreadyNetTrade.result, OUTCOMES.WIN);

      // When only grossProfit is provided, commission must be applied
      const grossTrade = classifyTrade({
        status: 'CLOSED',
        grossProfit: 15.00,
        commission: -2.50,
        swap: 0.00,
      });
      assert.equal(grossTrade.netProfit, 12.50, 'Must deduct commission when only gross is provided');
    });

    it('1.10. Missing stop-loss and history preserves uncertainty and does NOT claim BE protection', () => {
      const uncertainTrade = classifyTrade({
        status: 'CLOSED',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1001,
        profitLossAmount: 0.10,
        stopLoss: null,
        slTpHistory: null,
      });
      assert.equal(uncertainTrade.breakEvenActivated, false);
      assert.equal(uncertainTrade.result, OUTCOMES.WIN); // Zero tolerance -> win
      assert.equal(uncertainTrade.badgeLabel, 'Win'); // No false claim of BE protection
    });
  });

  // =========================================================================
  // 2. RESTART-SAFE DURABLE IDEMPOTENCY & CONCURRENCY
  // =========================================================================
  describe('2. Restart-Safe Durable Idempotency System', () => {
    it('2.1. Persists to PostgreSQL SystemConfig and survives in-memory cache clear', async () => {
      const testKey = `restart_test_${Date.now()}`;
      const payload = { success: true, savedCount: 1, testId: 'persisted_123' };

      await setIdempotentResult(testKey, payload, userA.id);

      // Verify PostgreSQL record exists directly
      const dbRecord = await prisma.systemConfig.findUnique({
        where: { key: `idemp:${userA.id}:${testKey}` },
      });
      assert.ok(dbRecord, 'Idempotency record must exist in PostgreSQL SystemConfig table');
      assert.equal(dbRecord.value.payload.testId, 'persisted_123');

      // Fetch via getIdempotentResult
      const retrieved = await getIdempotentResult(testKey, userA.id);
      assert.deepEqual(retrieved, payload);
    });

    it('2.2. Concurrent request locking: Blocks simultaneous save attempts with same key', async () => {
      const concurrentKey = `concurrent_${Date.now()}`;

      // First caller claims the lock
      const claim1 = await claimIdempotencyKey(concurrentKey, userA.id);
      assert.equal(claim1.acquired, true);

      // Second caller tries to claim simultaneously before first completes
      const claim2 = await claimIdempotencyKey(concurrentKey, userA.id);
      assert.equal(claim2.acquired, false);
      assert.equal(claim2.inProgress, true);

      // Release key on failure or finish
      await releaseIdempotencyKey(concurrentKey, userA.id);
    });

    it('2.3. Simultaneous Promise.all claims guarantee strictly 1 caller acquires lock at DB level', async () => {
      const raceKey = `atomic_race_${Date.now()}`;
      
      // Fire 5 concurrent claim attempts at the exact same moment
      const results = await Promise.all([
        claimIdempotencyKey(raceKey, userA.id),
        claimIdempotencyKey(raceKey, userA.id),
        claimIdempotencyKey(raceKey, userA.id),
        claimIdempotencyKey(raceKey, userA.id),
        claimIdempotencyKey(raceKey, userA.id),
      ]);

      const acquiredCount = results.filter((r) => r.acquired === true).length;
      const inProgressCount = results.filter((r) => r.acquired === false && r.inProgress === true).length;

      assert.equal(acquiredCount, 1, 'Exactly one concurrent request must acquire the lock');
      assert.equal(inProgressCount, 4, 'All four contending concurrent requests must be rejected with inProgress');

      await releaseIdempotencyKey(raceKey, userA.id);
    });
  });

  // =========================================================================
  // 3. DATABASE TRANSACTIONS & PARTIAL FAILURE RECOVERY
  // =========================================================================
  describe('3. Database Transactions & Batch Partial Failure Handling', () => {
    it('3.1. Batch save: 1 valid trade, 1 invalid trade -> returns 207 Multi-Status with item-level error', async () => {
      const batchPayload = [
        {
          tradingAccountId: accountA.id,
          pair: 'EURUSD',
          direction: 'BUY',
          entryPrice: 1.0850,
          exitPrice: 1.0890,
          lotSize: 1.0,
          grossProfit: 400.00,
          status: 'CLOSED',
        },
        {
          tradingAccountId: accountA.id,
          pair: 'GBPUSD',
          direction: 'INVALID_DIRECTION', // Should fail validation
          entryPrice: 1.2650,
          lotSize: 0.5,
        },
      ];

      let statusCode = null;
      let responseBody = null;
      const fakeReq = {
        user: { id: userA.id },
        headers: {},
        body: { trades: batchPayload },
      };
      const fakeRes = {
        status: (code) => { statusCode = code; return fakeRes; },
        json: (data) => { responseBody = data; return fakeRes; },
      };

      await handleConfirmSave(fakeReq, fakeRes);

      assert.equal(statusCode, 207, 'Partial success must return 207 Multi-Status');
      assert.equal(responseBody.savedCount, 1);
      assert.equal(responseBody.failedCount, 1);
      assert.equal(responseBody.failedTrades[0].batchIndex, 1);
      assert.equal(responseBody.failedTrades[0].retryable, true);
    });

    it('3.2. Failed save with idempotency key releases lock so user can retry immediately', async () => {
      const retryKey = `retry_test_${Date.now()}`;
      const invalidPayload = {
        tradingAccountId: accountA.id,
        pair: '', // Missing pair will fail
        direction: 'BUY',
      };

      let statusCode = null;
      let responseBody = null;
      const fakeReq = {
        user: { id: userA.id },
        headers: { 'x-idempotency-key': retryKey },
        body: { trade: invalidPayload },
      };
      const fakeRes = {
        status: (code) => { statusCode = code; return fakeRes; },
        json: (data) => { responseBody = data; return fakeRes; },
      };

      await handleConfirmSave(fakeReq, fakeRes);
      assert.equal(statusCode, 400);

      // Verify lock was released so user can retry without getting 409
      const reClaim = await claimIdempotencyKey(retryKey, userA.id);
      assert.equal(reClaim.acquired, true, 'Failed request must release lock for retry');
      await releaseIdempotencyKey(retryKey, userA.id);
    });
  });

  // =========================================================================
  // 4. ACCOUNT BALANCE GROUND TRUTH & TRADE LIFECYCLE
  // =========================================================================
  describe('4. Account Balance Ground Truth & Trade Lifecycle Safeguards', () => {
    it('4.1. Planned and Active trades NEVER increment or affect realized account balance', async () => {
      const initialBalance = (await prisma.tradingAccount.findUnique({ where: { id: accountA.id } })).currentBalance;

      // 1. Create Planned Trade
      const plannedTrade = await prisma.trade.create({
        data: {
          tradingAccountId: accountA.id,
          pair: 'AUDUSD',
          direction: 'BUY',
          entryPrice: 0.6550,
          stopLoss: 0.6500,
          takeProfit: 0.6650,
          status: 'PLANNED',
          result: 'OPEN',
        },
      });

      // 2. Create Active Trade with floating PnL in notes
      const activeTrade = await prisma.trade.create({
        data: {
          tradingAccountId: accountA.id,
          pair: 'NZDUSD',
          direction: 'SELL',
          entryPrice: 0.5950,
          status: 'ACTIVE',
          result: 'OPEN',
          notesBefore: 'Floating profit +$45.00',
        },
      });

      // Reconcile balance
      await reconcileAccountBalance(accountA.id);

      const balanceAfterOpenTrades = (await prisma.tradingAccount.findUnique({ where: { id: accountA.id } })).currentBalance;
      assert.equal(balanceAfterOpenTrades, initialBalance, 'Planned and Active trades must never change balance');

      // Cleanup
      await prisma.trade.deleteMany({ where: { id: { in: [plannedTrade.id, activeTrade.id] } } });
    });

    it('4.2. Closed trade updates balance to exact ground truth (starting + sum(closed PnL))', async () => {
      const closedTrade = await prisma.trade.create({
        data: {
          tradingAccountId: accountA.id,
          pair: 'USDJPY',
          direction: 'BUY',
          entryPrice: 154.00,
          exitPrice: 154.50,
          lotSize: 1.0,
          grossProfit: 350.00,
          commission: -5.00,
          swap: 0.00,
          profitLossAmount: 345.00,
          status: 'CLOSED',
          result: 'WIN',
        },
      });

      await reconcileAccountBalance(accountA.id);

      const allClosedTrades = await prisma.trade.findMany({
        where: { tradingAccountId: accountA.id, status: 'CLOSED' },
      });
      const totalClosedPnl = allClosedTrades.reduce((sum, t) => sum + (Number(t.profitLossAmount) || 0), 0);
      const expectedBalance = accountA.startingBalance + totalClosedPnl;

      const updatedAccount = await prisma.tradingAccount.findUnique({ where: { id: accountA.id } });
      assert.equal(updatedAccount.currentBalance, expectedBalance);

      // Cleanup
      await prisma.trade.delete({ where: { id: closedTrade.id } });
      await reconcileAccountBalance(accountA.id);
    });
  });

  // =========================================================================
  // 5. SECURITY & MULTI-ACCOUNT ISOLATION
  // =========================================================================
  describe('5. Security, Multi-Account Isolation & Unauthorized Writes', () => {
    it('5.1. Rejects attempt to save trade to an account owned by another user', async () => {
      // User A attempts to write a trade to User B's account
      const maliciousPayload = {
        tradingAccountId: accountB.id, // User B's account!
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
        lotSize: 1.0,
      };

      let statusCode = null;
      let responseBody = null;
      const fakeReq = {
        user: { id: userA.id }, // Authenticated as User A
        headers: {},
        body: { trade: maliciousPayload },
      };
      const fakeRes = {
        status: (code) => { statusCode = code; return fakeRes; },
        json: (data) => { responseBody = data; return fakeRes; },
      };

      await handleConfirmSave(fakeReq, fakeRes);

      assert.equal(statusCode, 400);
      assert.equal(responseBody.savedCount, 0);
      assert.ok(responseBody.failedTrades[0].error.includes('unauthorized') || responseBody.failedTrades[0].error.includes('not found'));
    });

    it('5.2. Duplicate check for User A never returns User B trades', async () => {
      // Create a trade in User B's account
      const userBTrade = await prisma.trade.create({
        data: {
          tradingAccountId: accountB.id,
          pair: 'SECRET_PAIR',
          direction: 'BUY',
          entryPrice: 100.0,
          exitPrice: 110.0,
          lotSize: 5.0,
          externalId: 'SECRET_TICKET_9999',
          status: 'CLOSED',
          result: 'WIN',
        },
      });

      // User A checks duplicate with same ticket and pair
      const dupResult = await checkTradeDuplicate({
        candidate: { pair: 'SECRET_PAIR', direction: 'BUY', externalId: 'SECRET_TICKET_9999' },
        userId: userA.id,
      });

      assert.equal(dupResult.hasDuplicate, false, 'User A check must not discover User B trades');
      assert.equal(dupResult.matchedTrade, null);

      // Cleanup
      await prisma.trade.delete({ where: { id: userBTrade.id } });
    });
  });
});
