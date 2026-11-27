const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const {
  roundMoney,
  resolveTransactionSign,
  computeSignedTransactionAmounts,
  calculateAccountLedgerSummary,
  attachResultingBalances,
  summarizeCashFlowTransactions,
} = require('../src/utils/accountLedgerMath');
const {
  createAccountTransactionSchema,
  updateAccountTransactionSchema,
} = require('../src/validation/accountTransactionSchemas');
const {
  calculateTimeWeightedReturn,
  buildPerformanceCurve,
  calculateDrawdown,
  calculateEquityCurve,
} = require('../src/utils/dashboardMath');
const { isAccountTransactionsEnabled, getAccountTransactionsFlagMode } = require('../src/config/featureFlags');
const { extractBalanceDealsFromRawDeals } = require('../src/services/metaApiService');
const { syncMetaTraderBalanceDeals } = require('../src/services/accountTransactionService');
const { getDailyReviewSummary } = require('../src/services/dailyReviewService');
const { getPropFirmComplianceReport } = require('../src/services/propFirmRuleEngine');
const propFirmPayoutService = require('../src/services/propFirmPayoutService');
const { getAccountCashFlowSummary } = require('../src/ai/chat/chatAnalyticsTools');
const { searchProductKnowledge } = require('../src/ai/chat/productKnowledge');

const tradingAccountRoutes = require('../src/routes/tradingAccountRoutes');
const tradeRoutes = require('../src/routes/tradeRoutes');
const miscRoutes = require('../src/routes/miscRoutes');

const buildTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/accounts', tradingAccountRoutes);
  app.use('/api/trades', tradeRoutes);
  app.use('/api', miscRoutes);
  return app;
};

const signTokenForUser = (user) => {
  const secret = process.env.JWT_SECRET || 'fallback_dev_secret_for_testing';
  return jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion || 0 }, secret, { expiresIn: '1h' });
};

test('Account Transactions & Cash Flow Ledger — Full Unit, Security & Local DB Integration Suite', async (t) => {
  await t.test('1. Pure ledger math: strict sign rules, summary formulas, TWR immunity, resulting balances', () => {
    assert.deepEqual(resolveTransactionSign('DEPOSIT'), { direction: 'INFLOW', sign: 1 });
    assert.deepEqual(resolveTransactionSign('WITHDRAWAL'), { direction: 'OUTFLOW', sign: -1 });
    assert.deepEqual(resolveTransactionSign('PAYOUT'), { direction: 'OUTFLOW', sign: -1 });
    assert.deepEqual(resolveTransactionSign('FEE'), { direction: 'OUTFLOW', sign: -1 });
    assert.deepEqual(resolveTransactionSign('ADJUSTMENT', 'INFLOW'), { direction: 'INFLOW', sign: 1 });
    assert.deepEqual(resolveTransactionSign('ADJUSTMENT', 'OUTFLOW'), { direction: 'OUTFLOW', sign: -1 });
    assert.throws(() => resolveTransactionSign('ADJUSTMENT'), /explicit direction/i);
    assert.throws(() => resolveTransactionSign('DEPOSIT', 'OUTFLOW'), /INFLOW/i);

    const account = { id: 'acc-1', startingBalance: 10000, createdAt: '2026-07-01T00:00:00Z' };
    const trades = [
      { id: 't1', status: 'CLOSED', result: 'WIN', profitLossAmount: 1200, exitTime: '2026-07-05T15:00:00Z' },
      { id: 't2', status: 'CLOSED', result: 'LOSS', profitLossAmount: -200, exitTime: '2026-07-10T15:00:00Z' },
      { id: 't3', status: 'ACTIVE', result: 'OPEN', profitLossAmount: 150, entryTime: '2026-07-12T10:00:00Z' },
    ];
    const txs = [
      { id: 'tx0', type: 'OPENING_BALANCE', direction: 'INFLOW', amount: 10000, signedAmount: 10000, occurredAt: '2026-07-01T00:00:00Z' },
      { id: 'tx1', type: 'DEPOSIT', direction: 'INFLOW', amount: 2000, signedAmount: 2000, occurredAt: '2026-07-06T10:00:00Z' },
      { id: 'tx2', type: 'WITHDRAWAL', direction: 'OUTFLOW', amount: 500, signedAmount: -500, occurredAt: '2026-07-07T10:00:00Z' },
      { id: 'tx3', type: 'PAYOUT', direction: 'OUTFLOW', amount: 300, signedAmount: -300, occurredAt: '2026-07-08T10:00:00Z' },
      { id: 'tx4', type: 'FEE', direction: 'OUTFLOW', amount: 25, signedAmount: -25, occurredAt: '2026-07-09T10:00:00Z' },
      { id: 'tx5', type: 'ADJUSTMENT', direction: 'INFLOW', amount: 75, signedAmount: 75, occurredAt: '2026-07-11T10:00:00Z' },
      { id: 'tx6', type: 'ADJUSTMENT', direction: 'OUTFLOW', amount: 50, signedAmount: -50, occurredAt: '2026-07-11T12:00:00Z' },
      { id: 'txArch', type: 'DEPOSIT', direction: 'INFLOW', amount: 99999, signedAmount: 99999, occurredAt: '2026-07-11T14:00:00Z', archivedAt: '2026-07-11T15:00:00Z' },
    ];

    const summary = calculateAccountLedgerSummary({ account, trades, transactions: txs });
    assert.equal(summary.openingBalance, 10000);
    assert.equal(summary.realisedTradingPnl, 1000);
    assert.equal(summary.unrealisedPnl, 150);
    assert.equal(summary.deposits, 2000);
    assert.equal(summary.withdrawals, 500);
    assert.equal(summary.payouts, 300);
    assert.equal(summary.fees, 25);
    assert.equal(summary.adjustments, 25); // +75 - 50
    assert.equal(summary.netCashFlow, 1200); // 2000 - 500 - 300 - 25 + 25
    assert.equal(summary.accountBalance, 12200); // 10000 + 1000 + 1200
    assert.equal(summary.equity, 12350); // 12200 + 150
    assert.equal(summary.netAccountChange, 2200); // 1000 + 1200

    const timeline = attachResultingBalances({ account, trades, transactions: txs });
    const byId = Object.fromEntries(timeline.map((item) => [item.id, item]));
    assert.equal(byId.tx0.resultingBalance, 10000);
    // t1 (+1200) -> 11200, then tx1 (+2000) -> 13200
    assert.equal(byId.tx1.resultingBalance, 13200);
    assert.equal(byId.tx2.resultingBalance, 12700);
    assert.equal(byId.tx3.resultingBalance, 12400);
    assert.equal(byId.tx4.resultingBalance, 12375);
    // t2 (-200) -> 12175, then tx5 (+75) -> 12250, tx6 (-50) -> 12200
    assert.equal(byId.tx5.resultingBalance, 12250);
    assert.equal(byId.tx6.resultingBalance, 12200);
    assert.equal(byId.txArch.resultingBalance, null);

    // TWR check: Deposit right before zero additional trades does NOT dilute or inflate 10% trading return
    const curveBeforeDeposit = buildPerformanceCurve({
      accounts: [{ id: 'a', name: 'A', startingBalance: 10000, currentBalance: 11000, createdAt: '2026-07-01T00:00:00Z' }],
      trades: [{ id: 'tw', tradingAccountId: 'a', status: 'CLOSED', result: 'WIN', profitLossAmount: 1000, exitTime: '2026-07-02T12:00:00Z' }],
      fundingEvents: [{ id: 'ob', tradingAccountId: 'a', type: 'OPENING_BALANCE', direction: 'INFLOW', amount: 10000, signedAmount: 10000, occurredAt: '2026-07-01T00:00:00Z' }],
    });
    const curveAfterDeposit = buildPerformanceCurve({
      accounts: [{ id: 'a', name: 'A', startingBalance: 10000, currentBalance: 21000, createdAt: '2026-07-01T00:00:00Z' }],
      trades: [{ id: 'tw', tradingAccountId: 'a', status: 'CLOSED', result: 'WIN', profitLossAmount: 1000, exitTime: '2026-07-02T12:00:00Z' }],
      fundingEvents: [
        { id: 'ob', tradingAccountId: 'a', type: 'OPENING_BALANCE', direction: 'INFLOW', amount: 10000, signedAmount: 10000, occurredAt: '2026-07-01T00:00:00Z' },
        { id: 'dp', tradingAccountId: 'a', type: 'DEPOSIT', direction: 'INFLOW', amount: 10000, signedAmount: 10000, occurredAt: '2026-07-03T12:00:00Z' },
      ],
    });
    assert.equal(curveBeforeDeposit.summary.netTradingPnl, 1000);
    assert.equal(curveAfterDeposit.summary.netTradingPnl, 1000);
    assert.equal(curveBeforeDeposit.summary.tradingReturnPercentage, 10);
    assert.equal(curveAfterDeposit.summary.timeWeightedReturnPercentage, 10);
    assert.equal(curveAfterDeposit.summary.tradingReturnPercentage, 10);

    // Drawdown calculated on pure closed trades is completely unaffected by withdrawal/deposit
    const ddTrades = calculateDrawdown(calculateEquityCurve([
      { id: 't1', status: 'CLOSED', result: 'WIN', profitLossAmount: 1000, exitTime: new Date('2026-07-02T12:00:00Z') },
      { id: 't2', status: 'CLOSED', result: 'LOSS', profitLossAmount: -400, exitTime: new Date('2026-07-03T12:00:00Z') },
    ], 10000), 10000);
    assert.equal(ddTrades.maximumDrawdown, 400);
    assert.equal(roundMoney(-0), 0);
    const cfWindow = summarizeCashFlowTransactions(txs);
    assert.equal(cfWindow.transactionCount, 6);
  });

  await t.test('2. Schema validation enforces positive amount and unambiguous Adjustment direction', () => {
    assert.equal(createAccountTransactionSchema.safeParse({ type: 'DEPOSIT', amount: 100 }).success, true);
    assert.equal(createAccountTransactionSchema.safeParse({ type: 'WITHDRAWAL', amount: -50 }).success, false);
    assert.equal(createAccountTransactionSchema.safeParse({ type: 'ADJUSTMENT', amount: 100 }).success, false);
    assert.equal(createAccountTransactionSchema.safeParse({ type: 'ADJUSTMENT', amount: 100, direction: 'INFLOW' }).success, true);
    assert.equal(createAccountTransactionSchema.safeParse({ type: 'OPENING_BALANCE', amount: 100 }).success, false);
    assert.equal(updateAccountTransactionSchema.safeParse({}).success, false);
    assert.equal(updateAccountTransactionSchema.safeParse({ note: 'Corrected ref #42' }).success, true);
  });

  await t.test('3. End-to-End Local DB & Supertest API Verification (All 12 Required Scenarios)', async () => {
    const app = buildTestApp();
    const ts = Date.now();
    const createdUserIds = [];
    let origFlag = process.env.ACCOUNT_TRANSACTIONS_ENABLED;

    try {
      process.env.ACCOUNT_TRANSACTIONS_ENABLED = 'true';

      const userA = await prisma.user.create({
        data: {
          email: `acct_tx_a_${ts}@jahzjournal.test`,
          name: 'Ledger Trader A',
          passwordHash: 'test_hash_only',
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          role: 'TRADER',
        },
      });
      const userB = await prisma.user.create({
        data: {
          email: `acct_tx_b_${ts}@jahzjournal.test`,
          name: 'Intruder Trader B',
          passwordHash: 'test_hash_only',
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          role: 'TRADER',
        },
      });
      createdUserIds.push(userA.id, userB.id);

      const tokenA = signTokenForUser(userA);
      const tokenB = signTokenForUser(userB);

      // Create regular account via real API
      const createAccRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Ledger Regular USD',
          accountType: 'PERSONAL_LIVE',
          startingBalance: 10000,
          currency: 'USD',
        });
      assert.equal(createAccRes.status, 201);
      const accountId = createAccRes.body.id;

      // Verify initial OPENING_BALANCE baseline created cleanly
      const openingRow = await prisma.accountTransaction.findFirst({
        where: { tradingAccountId: accountId, type: 'OPENING_BALANCE' },
      });
      assert.ok(openingRow, 'Creating account creates OPENING_BALANCE ledger baseline');
      assert.equal(Number(openingRow.signedAmount), 10000);

      // Log manual trade (+450 closed WIN) via API
      const tradeDate = new Date('2026-11-20T14:00:00.000Z');
      const tradeRes = await request(app)
        .post('/api/trades')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          tradingAccountId: accountId,
          pair: 'EURUSD',
          direction: 'BUY',
          entryPrice: 1.0800,
          exitPrice: 1.0845,
          stopLoss: 1.0780,
          takeProfit: 1.0850,
          lotSize: 1.0,
          profitLossAmount: 450,
          status: 'CLOSED',
          result: 'WIN',
          entryTime: '2026-11-20T12:00:00.000Z',
          exitTime: tradeDate.toISOString(),
        });
      assert.equal(tradeRes.status, 201);
      const manualTradeId = tradeRes.body.id;

      // Baseline dashboard check before cash flows
      const dashBefore = await request(app)
        .get('/api/analytics/dashboard')
        .query({ accountId })
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(dashBefore.status, 200);
      assert.equal(dashBefore.body.summary.netProfitLoss, 450);
      assert.equal(dashBefore.body.cashFlowSummary.currentBalance, 10450);

      // Scenario 1 & 2: Deposit (+500), Withdrawal (-200), Payout (-150), Fee (-25), +Adjustment (+75), -Adjustment (-50)
      const payloads = [
        { type: 'DEPOSIT', amount: 500, occurredAt: '2026-11-21T10:00:00.000Z', note: 'Top up bank transfer', key: `idemp_dep_${ts}` },
        { type: 'WITHDRAWAL', amount: 200, occurredAt: '2026-11-21T11:00:00.000Z', note: 'ATM withdrawal' },
        { type: 'PAYOUT', amount: 150, occurredAt: '2026-11-21T12:00:00.000Z', note: 'Profit extraction' },
        { type: 'FEE', amount: 25, occurredAt: '2026-11-21T13:00:00.000Z', note: 'Wire fee' },
        { type: 'ADJUSTMENT', direction: 'INFLOW', amount: 75, occurredAt: '2026-11-21T14:00:00.000Z', note: 'Broker rebate credit' },
        { type: 'ADJUSTMENT', direction: 'OUTFLOW', amount: 50, occurredAt: '2026-11-21T15:00:00.000Z', note: 'Data feed debit' },
      ];

      let adjDebitId = null;
      for (const item of payloads) {
        const res = await request(app)
          .post(`/api/accounts/${accountId}/transactions`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('X-Idempotency-Key', item.key || `idemp_${item.type}_${item.direction || ''}_${ts}`)
          .send(item);
        assert.equal(res.status, 201, `Expected 201 for ${item.type}, got ${res.status}: ${JSON.stringify(res.body)}`);
        if (item.type === 'ADJUSTMENT' && item.direction === 'OUTFLOW') {
          adjDebitId = res.body.transaction.id;
        }
      }

      // Idempotency replay check on Deposit
      const replayRes = await request(app)
        .post(`/api/accounts/${accountId}/transactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Idempotency-Key', `idemp_dep_${ts}`)
        .send(payloads[0]);
      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.idempotentReplay, true);

      // Expected net cash flow = +500 - 200 - 150 - 25 + 75 - 50 = +150
      // Expected balance = 10000 + 450 + 150 = 10600
      const accAfterRes = await request(app)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(accAfterRes.status, 200);
      assert.equal(accAfterRes.body.currentBalance, 10600);
      assert.equal(accAfterRes.body.ledgerSummary.openingBalance, 10000);
      assert.equal(accAfterRes.body.ledgerSummary.realisedTradingPnl, 450);
      assert.equal(accAfterRes.body.ledgerSummary.netCashFlow, 150);
      assert.equal(accAfterRes.body.ledgerSummary.netAccountChange, 600);

      // Scenario 3, 4 & 5: Trading P&L & Drawdown invariant, Net Account Change updates, chart events separated
      const dashAfter = await request(app)
        .get('/api/analytics/dashboard')
        .query({ accountId })
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(dashAfter.status, 200);
      assert.equal(dashAfter.body.summary.netProfitLoss, 450, 'Trading P&L must remain identical after cash flows');
      assert.equal(dashAfter.body.summary.maximumDrawdown, dashBefore.body.summary.maximumDrawdown, 'Drawdown unchanged by cash flow');
      assert.equal(dashAfter.body.cashFlowSummary.netCashFlow, 150);
      assert.equal(dashAfter.body.cashFlowSummary.netAccountChange, 600);
      assert.equal(dashAfter.body.cashFlowSummary.currentBalance, 10600);

      const curveEvents = dashAfter.body.performanceCurve.accountBalance.map((pt) => pt.eventType);
      assert.ok(curveEvents.includes('opening_balance'));
      assert.ok(curveEvents.includes('deposit'));
      assert.ok(curveEvents.includes('withdrawal'));
      assert.ok(curveEvents.includes('payout'));
      assert.ok(curveEvents.includes('fee'));
      assert.ok(curveEvents.includes('balance_adjustment'));
      assert.ok(curveEvents.includes('trade_win'));

      const eqRes = await request(app)
        .get('/api/analytics/equity-curve')
        .query({ accountId })
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(eqRes.status, 200);
      assert.equal(eqRes.body.metrics.tradingPnl, 450);
      assert.equal(eqRes.body.metrics.netCashFlow, 150);
      assert.equal(eqRes.body.metrics.currentAccountBalance, 10600);

      // Direct currentBalance overwrite rejected
      const directOverwriteRes = await request(app)
        .put(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Ledger Regular USD', currentBalance: 999999 });
      assert.equal(directOverwriteRes.status, 400);

      // StartingBalance overwrite once activity exists rejected
      const startingOverwriteRes = await request(app)
        .put(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Ledger Regular USD', startingBalance: 50000 });
      assert.equal(startingOverwriteRes.status, 400);

      // Cross-user isolation checks (User B vs User A)
      const listB = await request(app)
        .get(`/api/accounts/${accountId}/transactions`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(listB.status, 404);
      const postB = await request(app)
        .post(`/api/accounts/${accountId}/transactions`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ type: 'DEPOSIT', amount: 100 });
      assert.equal(postB.status, 404);
      const editB = await request(app)
        .put(`/api/accounts/${accountId}/transactions/${adjDebitId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ note: 'Tampered' });
      assert.equal(editB.status, 404);
      const archiveB = await request(app)
        .post(`/api/accounts/${accountId}/transactions/${adjDebitId}/archive`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({});
      assert.equal(archiveB.status, 404);

      // Scenario 12 (edit & archive audit trail + balance recalculation)
      const editRes = await request(app)
        .put(`/api/accounts/${accountId}/transactions/${adjDebitId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 25, direction: 'OUTFLOW', note: 'Reduced feed debit to $25' });
      assert.equal(editRes.status, 200);
      assert.ok(editRes.body.transaction.editedAt);
      assert.equal(editRes.body.transaction.editHistory.length, 1);
      // Net cash flow changed from +150 to +175 -> balance = 10625
      assert.equal(editRes.body.account.currentBalance, 10625);

      const archiveRes = await request(app)
        .post(`/api/accounts/${accountId}/transactions/${adjDebitId}/archive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ reason: 'Fee waived by broker' });
      assert.equal(archiveRes.status, 200);
      assert.ok(archiveRes.body.transaction.archivedAt);
      assert.equal(archiveRes.body.transaction.editHistory.length, 2);
      // Net cash flow now +200 -> balance = 10650
      assert.equal(archiveRes.body.account.currentBalance, 10650);

      // Daily & Weekly Review separation
      const dailySummary = await getDailyReviewSummary({
        userId: userA.id,
        date: '2026-11-21',
        accountId,
        timezone: 'UTC',
      });
      assert.equal(dailySummary.metrics.netProfitLoss, 0, 'Cash flow day must NOT appear as winning/losing trading day');
      assert.equal(dailySummary.metrics.totalTrades, 0);
      assert.equal(dailySummary.cashFlow.netCashFlow, 200);
      assert.equal(dailySummary.cashFlow.deposits, 500);
      assert.equal(dailySummary.cashFlow.payouts, 150);

      const weeklyRes = await request(app)
        .post('/api/weekly-reviews/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ accountId, weekStartDate: '2026-11-16' });
      assert.equal(weeklyRes.status, 201);
      assert.equal(weeklyRes.body.data.netProfitLoss, 450);
      assert.equal(weeklyRes.body.data.cashFlow.netCashFlow, 200);

      // Manual trade update & delete still reconcile cleanly alongside active cash flows (+200)
      const editTradeRes = await request(app)
        .put(`/api/trades/${manualTradeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ profitLossAmount: 550 });
      assert.equal(editTradeRes.status, 200);
      const afterTradeEditAcc = await prisma.tradingAccount.findUnique({ where: { id: accountId } });
      assert.equal(afterTradeEditAcc.currentBalance, 10750); // 10000 + 550 + 200

      // Prop-firm Payout & Trailing Drawdown Accuracy Check
      const propAcc = await prisma.tradingAccount.create({
        data: {
          userId: userA.id,
          name: 'Apex Funded 100K',
          accountCategory: 'PROP_FIRM',
          isPropFirmAccount: true,
          startingBalance: 100000,
          currentBalance: 108000,
          currency: 'USD',
          propFirmAccount: {
            create: {
              firmName: 'Apex Trader Funding',
              programmeName: '100K Funded',
              marketType: 'FUTURES',
              evaluationType: 'ALREADY_FUNDED',
              accountStatus: 'FUNDED',
              drawdownType: 'TRAILING',
              maximumLossAmount: 3000,
              dailyLossAmount: 1500,
              profitSplitPercent: 80,
            },
          },
          trades: {
            create: {
              pair: 'NQ1!',
              direction: 'BUY',
              entryPrice: 20000,
              exitPrice: 20400,
              profitLossAmount: 8000,
              status: 'CLOSED',
              result: 'WIN',
              entryTime: new Date('2026-11-18T14:00:00Z'),
              exitTime: new Date('2026-11-18T16:00:00Z'),
            },
          },
        },
        include: { propFirmAccount: true },
      });

      const payoutReq = await propFirmPayoutService.requestPayout(propAcc.id, userA.id, {
        amountRequested: 5000,
        paymentMethod: 'CRYPTO_USDT',
        notes: 'Funded payout #1',
      });
      await propFirmPayoutService.updatePayout(payoutReq.id, userA.id, {
        status: 'PAID',
        processedDate: new Date('2026-11-22T12:00:00Z').toISOString(),
      });

      const compliance = await getPropFirmComplianceReport(userA.id, propAcc.id);
      assert.equal(compliance.currentBalance, 103000, 'Cash balance reduced by paid payout');
      assert.equal(compliance.tradingPerformanceBalance, 108000, 'Trading balance excludes payout');
      assert.equal(compliance.currentTotalProfit, 8000, 'Trading profit stays 8000 (payout NOT treated as loss)');
      assert.equal(compliance.overallDrawdown.drawdownUsed, 0, 'Payout must NOT trigger false trailing drawdown');
      assert.equal(compliance.overallDrawdown.status, 'SAFE');
      assert.equal(compliance.cashFlowSummary.payouts, 5000);
      assert.equal(compliance.cashFlowSummary.availableProfitForPayout, 3000);

      // JAHZ AI Chat V2 cash-flow tool & support knowledge verification
      const aiCashFlow = await getAccountCashFlowSummary({ userId: userA.id, tradingAccountId: accountId });
      assert.equal(aiCashFlow.summary.realisedTradingPnl, 550);
      assert.equal(aiCashFlow.summary.netCashFlow, 200);
      assert.equal(aiCashFlow.summary.accountBalance, 10750);
      const aiOtherUserDenied = await getAccountCashFlowSummary({ userId: userB.id, tradingAccountId: accountId });
      assert.equal(aiOtherUserDenied.error, true);

      const supportDocs = searchProductKnowledge('can you help me record deposits and withdrawals');
      assert.equal(supportDocs.matched, true);
      assert.ok(supportDocs.docs.some((d) => d.id === 'account-transactions-and-cash-flow'));

      // MetaTrader DEAL_TYPE_BALANCE extraction, idempotent read-only import, and payout confirmation
      const extractedDeals = extractBalanceDealsFromRawDeals([
        { id: 'MT_D0', type: 'DEAL_TYPE_BALANCE', profit: 10000, time: '2026-11-01T08:00:00Z', comment: 'Initial Funding' },
        { id: 'MT_T1', type: 'DEAL_TYPE_BUY', symbol: 'EURUSD', entryType: 'DEAL_ENTRY_IN', profit: 0, time: '2026-11-02T09:00:00Z' },
        { id: 'MT_D1', type: 'DEAL_TYPE_BALANCE', profit: 2500, commission: -5, time: '2026-11-05T10:00:00Z', comment: 'Top-up wire' },
        { id: 'MT_D2', type: 'DEAL_TYPE_BALANCE', profit: -800, time: '2026-11-08T10:00:00Z', comment: 'Client withdrawal' },
        { id: 'MT_ZERO', type: 'DEAL_TYPE_BALANCE', profit: 0, time: '2026-11-09T10:00:00Z' },
      ]);
      assert.equal(extractedDeals.length, 3);
      assert.deepEqual(extractedDeals.map((d) => d.dealId), ['MT_D0', 'MT_D1', 'MT_D2']);
      assert.equal(extractedDeals[1].amount, 2495);
      assert.equal(extractedDeals[2].amount, -800);

      const mtRegularAcc = await prisma.tradingAccount.create({
        data: {
          userId: userA.id,
          name: 'IC Markets MT5 Sync',
          startingBalance: 10000,
          currentBalance: 10000,
          currency: 'USD',
          platform: 'MT5',
          cloudSyncEnabled: true,
          cloudSyncStatus: 'CONNECTED',
          cloudAccountId: 'cloud-reg-test-1',
          trades: {
            create: {
              pair: 'EURUSD',
              direction: 'BUY',
              entryPrice: 1.08,
              exitPrice: 1.085,
              profitLossAmount: 500,
              status: 'CLOSED',
              result: 'WIN',
              entryTime: new Date('2026-11-03T10:00:00Z'),
              exitTime: new Date('2026-11-03T12:00:00Z'),
            },
          },
        },
      });

      const regularDeals = [
        { dealId: 'REG_D0', amount: 10000, time: '2026-11-01T08:00:00Z', comment: 'Initial wire' },
        { dealId: 'REG_D1', amount: 1500, time: '2026-11-04T10:00:00Z', comment: 'Additional capital' },
        { dealId: 'REG_D2', amount: -400, time: '2026-11-06T12:00:00Z', comment: 'Partial cash out' },
      ];
      const regSync1 = await syncMetaTraderBalanceDeals({
        accountId: mtRegularAcc.id,
        balanceDeals: regularDeals,
        liveBalance: 11600,
      });
      assert.equal(regSync1.importedCount, 2, 'Initial funding aligns with opening baseline without double-count');

      // Re-sync is completely idempotent
      const regSync2 = await syncMetaTraderBalanceDeals({
        accountId: mtRegularAcc.id,
        balanceDeals: regularDeals,
        liveBalance: 11600,
      });
      assert.equal(regSync2.importedCount, 0);
      assert.equal(regSync2.skippedCount, 3);

      const regListRes = await request(app)
        .get(`/api/accounts/${mtRegularAcc.id}/transactions`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(regListRes.status, 200);
      assert.equal(regListRes.body.summary.accountBalance, 11600);
      assert.equal(regListRes.body.summary.deposits, 1500);
      assert.equal(regListRes.body.summary.withdrawals, 400);

      const regDeposit = regListRes.body.transactions.find((item) => item.externalDealId === 'REG_D1');
      const regWithdrawal = regListRes.body.transactions.find((item) => item.externalDealId === 'REG_D2');
      assert.equal(regDeposit.type, 'DEPOSIT');
      assert.equal(regDeposit.source, 'MT_CLOUD_SYNC');
      assert.equal(regDeposit.sourceLabel, 'MetaTrader Sync');
      assert.equal(regDeposit.isReadOnly, true);
      assert.match(regDeposit.note, /MetaTrader Sync \(#REG_D1\)/);
      assert.equal(regWithdrawal.type, 'WITHDRAWAL');
      assert.equal(regWithdrawal.canConfirmAsPayout, false);

      // Synced rows are strictly read-only against manual edit or archive
      const blockedEditRes = await request(app)
        .put(`/api/accounts/${mtRegularAcc.id}/transactions/${regDeposit.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ note: 'Attempt overwrite' });
      assert.equal(blockedEditRes.status, 403);
      assert.equal(blockedEditRes.body.error, 'MT_SYNC_TRANSACTION_READ_ONLY');

      const blockedArchiveRes = await request(app)
        .post(`/api/accounts/${mtRegularAcc.id}/transactions/${regDeposit.id}/archive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      assert.equal(blockedArchiveRes.status, 403);

      // Regular account withdrawals cannot be confirmed as prop-firm payouts
      const nonPropConfirmRes = await request(app)
        .post(`/api/accounts/${mtRegularAcc.id}/transactions/${regWithdrawal.id}/confirm-payout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      assert.equal(nonPropConfirmRes.status, 400);

      // Prop-firm MT sync requires verified payout match OR explicit user confirmation before PAYOUT classification
      const mtPropAcc = await prisma.tradingAccount.create({
        data: {
          userId: userA.id,
          name: 'FTMO MT5 Funded',
          accountCategory: 'PROP_FIRM',
          isPropFirmAccount: true,
          startingBalance: 50000,
          currentBalance: 54000,
          currency: 'USD',
          platform: 'MT5',
          cloudSyncEnabled: true,
          cloudSyncStatus: 'CONNECTED',
          cloudAccountId: 'cloud-prop-test-1',
          propFirmAccount: {
            create: {
              firmName: 'FTMO',
              programmeName: '50K Funded',
              marketType: 'FOREX_CFD',
              evaluationType: 'ALREADY_FUNDED',
              accountStatus: 'FUNDED',
              drawdownType: 'STATIC',
              maximumLossAmount: 5000,
              dailyLossAmount: 2500,
              profitSplitPercent: 80,
              payouts: {
                create: {
                  amountRequested: 1500,
                  profitSplitPercent: 80,
                  netTraderPayout: 1200,
                  status: 'APPROVED',
                  transactionReference: 'PAYOUT-REF-99',
                  requestDate: new Date('2026-11-09T10:00:00Z'),
                },
              },
            },
          },
          trades: {
            create: {
              pair: 'XAUUSD',
              direction: 'BUY',
              entryPrice: 2600,
              exitPrice: 2640,
              profitLossAmount: 4000,
              status: 'CLOSED',
              result: 'WIN',
              entryTime: new Date('2026-11-04T10:00:00Z'),
              exitTime: new Date('2026-11-04T12:00:00Z'),
            },
          },
        },
        include: { propFirmAccount: true },
      });

      const propDeals = [
        { dealId: 'PROP_D0', amount: 50000, time: '2026-11-01T08:00:00Z', comment: 'Challenge capital' },
        { dealId: 'PROP_W_VERIFIED', amount: -1500, time: '2026-11-10T10:00:00Z', comment: 'Wire PAYOUT-REF-99' },
        { dealId: 'PROP_W_UNVERIFIED', amount: -700, time: '2026-11-12T10:00:00Z', comment: 'Profit split release' },
      ];
      const propSyncRes = await syncMetaTraderBalanceDeals({
        accountId: mtPropAcc.id,
        balanceDeals: propDeals,
        liveBalance: 51800,
      });
      assert.equal(propSyncRes.importedCount, 2);

      const propListRes = await request(app)
        .get(`/api/accounts/${mtPropAcc.id}/transactions`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(propListRes.status, 200);

      const verifiedTx = propListRes.body.transactions.find((item) => item.externalDealId === 'PROP_W_VERIFIED');
      const unverifiedTx = propListRes.body.transactions.find((item) => item.externalDealId === 'PROP_W_UNVERIFIED');
      assert.equal(verifiedTx.type, 'PAYOUT');
      assert.equal(verifiedTx.payoutClassificationStatus, 'VERIFIED_PAYOUT_MATCH');
      assert.equal(verifiedTx.canConfirmAsPayout, false);

      assert.equal(unverifiedTx.type, 'WITHDRAWAL', 'Unverified MT outflow must not be auto-classified as Payout');
      assert.equal(unverifiedTx.payoutClassificationStatus, 'REQUIRES_USER_CONFIRMATION');
      assert.equal(unverifiedTx.canConfirmAsPayout, true);

      // User B cannot confirm payouts on User A's account
      const otherUserConfirmRes = await request(app)
        .post(`/api/accounts/${mtPropAcc.id}/transactions/${unverifiedTx.id}/confirm-payout`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({});
      assert.equal(otherUserConfirmRes.status, 404);

      // User A confirms unverified outflow as a prop-firm payout
      const confirmRes = await request(app)
        .post(`/api/accounts/${mtPropAcc.id}/transactions/${unverifiedTx.id}/confirm-payout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      assert.equal(confirmRes.status, 200);
      assert.equal(confirmRes.body.transaction.type, 'PAYOUT');
      assert.equal(confirmRes.body.transaction.payoutClassificationStatus, 'USER_CONFIRMED_PAYOUT');
      assert.equal(confirmRes.body.transaction.isReadOnly, true);
      assert.equal(confirmRes.body.transaction.canConfirmAsPayout, false);
      assert.equal(confirmRes.body.summary.payouts, 2200);
      assert.equal(confirmRes.body.summary.withdrawals, 0);

      // Re-syncing preserves user-confirmed PAYOUT classification without overwriting or duplicating
      const propReSync = await syncMetaTraderBalanceDeals({
        accountId: mtPropAcc.id,
        balanceDeals: propDeals,
        liveBalance: 51800,
      });
      assert.equal(propReSync.importedCount, 0);
      assert.equal(propReSync.skippedCount, 3);

      const propComplianceAfterSync = await getPropFirmComplianceReport(userA.id, mtPropAcc.id);
      assert.equal(propComplianceAfterSync.currentBalance, 51800);
      assert.equal(propComplianceAfterSync.currentTotalProfit, 4000);
      assert.equal(propComplianceAfterSync.overallDrawdown.drawdownUsed, 0);

      // Feature flag rollback test preserves persisted transaction rows
      process.env.ACCOUNT_TRANSACTIONS_ENABLED = 'false';
      assert.equal(isAccountTransactionsEnabled(userA), false);
      assert.equal(getAccountTransactionsFlagMode(), 'DISABLED');
      const disabledRes = await request(app)
        .get(`/api/accounts/${accountId}/transactions`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(disabledRes.status, 503);
      const persistedCount = await prisma.accountTransaction.count({ where: { tradingAccountId: accountId } });
      assert.ok(persistedCount >= 6, 'Persisted transactions remain safe when feature flag is turned off');
    } finally {
      if (origFlag === undefined) {
        delete process.env.ACCOUNT_TRANSACTIONS_ENABLED;
      } else {
        process.env.ACCOUNT_TRANSACTIONS_ENABLED = origFlag;
      }

      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      await prisma.$disconnect();
    }
  });
});
