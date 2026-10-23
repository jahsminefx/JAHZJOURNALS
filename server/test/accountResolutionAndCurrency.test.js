const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  findMatchingAccount,
  resolveAccountHierarchy,
  detectCurrencyConflict,
  disambiguateMonetaryValue,
} = require('../src/services/accountResolutionService');

describe('JAHZJOURNALS — Intelligent Trading Account Resolution & Currency Context', () => {
  const sampleAccounts = [
    {
      id: 'acc_usd_personal',
      name: 'Personal Live Account',
      currency: 'USD',
      brokerName: 'IC Markets',
      mtAccountNumber: '12345678',
      currentBalance: 10540.25,
    },
    {
      id: 'acc_eur_ftmo',
      name: 'FTMO Challenge 100k',
      currency: 'EUR',
      propFirmName: 'FTMO',
      brokerName: 'FTMO Global',
      mtAccountNumber: '87654321',
      currentBalance: 98450.00,
    },
    {
      id: 'acc_gbp_funded',
      name: 'Alpha Capital Funded',
      currency: 'GBP',
      propFirmName: 'Alpha Capital Group',
      mtAccountNumber: '99887766',
      currentBalance: 50200.50,
    },
  ];

  describe('1. findMatchingAccount', () => {
    it('matches by exact account ID', () => {
      const match = findMatchingAccount('acc_eur_ftmo', sampleAccounts);
      assert.ok(match);
      assert.equal(match.id, 'acc_eur_ftmo');
      assert.equal(match.currency, 'EUR');
    });

    it('matches by MT account number or cloud login', () => {
      const match = findMatchingAccount('87654321', sampleAccounts);
      assert.ok(match);
      assert.equal(match.id, 'acc_eur_ftmo');
    });

    it('matches by exact account name (case-insensitive)', () => {
      const match = findMatchingAccount('ftmo challenge 100k', sampleAccounts);
      assert.ok(match);
      assert.equal(match.id, 'acc_eur_ftmo');
    });

    it('matches by account name substring', () => {
      const match = findMatchingAccount('Alpha Capital', sampleAccounts);
      assert.ok(match);
      assert.equal(match.id, 'acc_gbp_funded');
    });

    it('matches by broker or prop firm name', () => {
      const matchBroker = findMatchingAccount('IC Markets', sampleAccounts);
      assert.ok(matchBroker);
      assert.equal(matchBroker.id, 'acc_usd_personal');

      const matchProp = findMatchingAccount('FTMO', sampleAccounts);
      assert.ok(matchProp);
      assert.equal(matchProp.id, 'acc_eur_ftmo');
    });

    it('returns null if no account matches', () => {
      const match = findMatchingAccount('NonExistent Broker XYZ', sampleAccounts);
      assert.equal(match, null);
    });

    it('returns null for empty or invalid inputs', () => {
      assert.equal(findMatchingAccount('', sampleAccounts), null);
      assert.equal(findMatchingAccount(null, sampleAccounts), null);
      assert.equal(findMatchingAccount('acc_usd_personal', []), null);
    });
  });

  describe('2. resolveAccountHierarchy', () => {
    it('returns NO_ACCOUNTS if user has no trading accounts', () => {
      const res = resolveAccountHierarchy({ userAccounts: [] });
      assert.equal(res.status, 'NO_ACCOUNTS');
      assert.equal(res.resolvedAccount, null);
      assert.equal(res.isAmbiguous, true);
    });

    it('resolves directly to single account for single-account user (convenient default)', () => {
      const singleAccount = [sampleAccounts[0]];
      const res = resolveAccountHierarchy({ userAccounts: singleAccount });
      assert.equal(res.status, 'RESOLVED');
      assert.equal(res.resolvedAccount.id, 'acc_usd_personal');
      assert.equal(res.authoritativeCurrency, 'USD');
      assert.equal(res.isSingleAccountDefault, true);
    });

    it('resolves to explicitly selected account (Step 1)', () => {
      const res = resolveAccountHierarchy({
        currentAccountId: 'acc_eur_ftmo',
        userAccounts: sampleAccounts,
      });
      assert.equal(res.status, 'RESOLVED');
      assert.equal(res.resolvedAccount.id, 'acc_eur_ftmo');
      assert.equal(res.authoritativeCurrency, 'EUR');
      assert.equal(res.requiresConfirmation, false);
    });

    it('triggers CONFIRMATION_REQUIRED if user message explicitly identifies a different account (Step 2 conflict)', () => {
      const res = resolveAccountHierarchy({
        currentAccountId: 'acc_usd_personal',
        requestedAccountName: 'FTMO Challenge 100k',
        userAccounts: sampleAccounts,
      });
      assert.equal(res.status, 'CONFIRMATION_REQUIRED');
      assert.equal(res.requiresConfirmation, true);
      assert.equal(res.conflictType, 'USER_MESSAGE_CONFLICT');
      assert.equal(res.resolvedAccount.id, 'acc_usd_personal');
      assert.equal(res.suggestedAccount.id, 'acc_eur_ftmo');
      assert.equal(res.authoritativeCurrency, 'USD');
    });

    it('triggers CONFIRMATION_REQUIRED if screenshot metadata identifies a different account (Step 3 conflict)', () => {
      const res = resolveAccountHierarchy({
        currentAccountId: 'acc_usd_personal',
        screenshotAccountInfo: { accountNumber: '87654321', brokerName: 'FTMO' },
        userAccounts: sampleAccounts,
      });
      assert.equal(res.status, 'CONFIRMATION_REQUIRED');
      assert.equal(res.requiresConfirmation, true);
      assert.equal(res.conflictType, 'SCREENSHOT_METADATA_CONFLICT');
      assert.equal(res.resolvedAccount.id, 'acc_usd_personal');
      assert.equal(res.suggestedAccount.id, 'acc_eur_ftmo');
    });

    it('resolves from message when no account was initially selected', () => {
      const res = resolveAccountHierarchy({
        requestedAccountName: 'Alpha Capital',
        userAccounts: sampleAccounts,
      });
      assert.equal(res.status, 'RESOLVED');
      assert.equal(res.resolvedAccount.id, 'acc_gbp_funded');
      assert.equal(res.authoritativeCurrency, 'GBP');
    });

    it('resolves from screenshot when no account was initially selected', () => {
      const res = resolveAccountHierarchy({
        screenshotAccountInfo: { accountNumber: '99887766' },
        userAccounts: sampleAccounts,
      });
      assert.equal(res.status, 'RESOLVED');
      assert.equal(res.resolvedAccount.id, 'acc_gbp_funded');
      assert.equal(res.authoritativeCurrency, 'GBP');
    });

    it('flags as AMBIGUOUS if multiple accounts exist and none is selected or matched (Step 4)', () => {
      const res = resolveAccountHierarchy({
        userAccounts: sampleAccounts,
      });
      assert.equal(res.status, 'AMBIGUOUS');
      assert.equal(res.resolvedAccount, null);
      assert.equal(res.isAmbiguous, true);
      assert.equal(res.candidateAccounts.length, 3);
      assert.equal(res.message, 'Which trading account should this trade belong to?');
    });
  });

  describe('3. detectCurrencyConflict', () => {
    it('detects no conflict when screenshot currency matches account currency', () => {
      const res = detectCurrencyConflict({
        account: sampleAccounts[0], // USD
        screenshotCurrency: 'USD',
      });
      assert.equal(res.hasCurrencyConflict, false);
      assert.equal(res.warning, null);
    });

    it('detects no conflict when screenshot currency is in lowercase (case-insensitive)', () => {
      const res = detectCurrencyConflict({
        account: sampleAccounts[1], // EUR
        screenshotCurrency: 'eur',
      });
      assert.equal(res.hasCurrencyConflict, false);
    });

    it('flags currency conflict when screenshot indicates EUR but account is USD', () => {
      const res = detectCurrencyConflict({
        account: sampleAccounts[0], // USD
        screenshotCurrency: 'EUR',
      });
      assert.equal(res.hasCurrencyConflict, true);
      assert.equal(res.accountCurrency, 'USD');
      assert.equal(res.screenshotCurrency, 'EUR');
      assert.ok(res.warning.includes('Currency mismatch'));
    });

    it('flags currency conflict when screenshot indicates GBP but account is EUR', () => {
      const res = detectCurrencyConflict({
        account: sampleAccounts[1], // EUR
        screenshotCurrency: 'GBP',
      });
      assert.equal(res.hasCurrencyConflict, true);
      assert.equal(res.accountCurrency, 'EUR');
      assert.equal(res.screenshotCurrency, 'GBP');
    });

    it('handles missing screenshot currency gracefully without false conflict', () => {
      const res = detectCurrencyConflict({
        account: sampleAccounts[2], // GBP
        screenshotCurrency: null,
      });
      assert.equal(res.hasCurrencyConflict, false);
      assert.equal(res.accountCurrency, 'GBP');
    });
  });

  describe('4. disambiguateMonetaryValue', () => {
    it('correctly classifies pips as non-monetary', () => {
      const res = disambiguateMonetaryValue({ candidateValue: 22.5, labelContext: 'Pips gained' });
      assert.equal(res.metricType, 'PIPS');
      assert.equal(res.isMonetary, false);
      assert.equal(res.value, 22.5);
    });

    it('correctly classifies volume/lots as non-monetary', () => {
      const res = disambiguateMonetaryValue({ candidateValue: 0.22, labelContext: 'Lots' });
      assert.equal(res.metricType, 'VOLUME');
      assert.equal(res.isMonetary, false);
      assert.equal(res.value, 0.22);
    });

    it('correctly classifies price as non-monetary', () => {
      const res = disambiguateMonetaryValue({ candidateValue: 82351.75, labelContext: 'Close Price' });
      assert.equal(res.metricType, 'PRICE');
      assert.equal(res.isMonetary, false);
    });

    it('correctly classifies net profit as monetary', () => {
      const res = disambiguateMonetaryValue({ candidateValue: 1.59, labelContext: 'Net Profit' });
      assert.equal(res.metricType, 'NET_PROFIT');
      assert.equal(res.isMonetary, true);
      assert.equal(res.value, 1.59);
    });

    it('correctly classifies commission as monetary', () => {
      const res = disambiguateMonetaryValue({ candidateValue: -0.66, labelContext: 'Commission' });
      assert.equal(res.metricType, 'COMMISSION');
      assert.equal(res.isMonetary, true);
      assert.equal(res.value, -0.66);
    });

    it('distinguishes BTC 2.25 pips/profit from 82,351 entry price heuristic', () => {
      const res = disambiguateMonetaryValue({
        candidateValue: 2.25,
        entryPrice: 82351.75,
        labelContext: '',
      });
      // 2.25 is not within 5% of 82351, so it is NOT a price heuristic
      assert.notEqual(res.metricType, 'PRICE_HEURISTIC');
      assert.equal(res.isMonetary, true);
    });
  });

  describe('5. Integration: Multi-Currency Account Boundary & Database Persistence', () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const { handleConfirmSave } = require('../src/controllers/aiTradeCaptureController');
    const { parseTradeFromText } = require('../src/services/aiTradeCaptureService');

    let userA, userB;
    let accUsd, accEur;

    before(async () => {
      userA = await prisma.user.create({
        data: {
          name: 'Account Context Tester A',
          email: `acc_test_a_${Date.now()}@example.com`,
          passwordHash: 'dummy',
          role: 'TRADER',
        },
      });

      userB = await prisma.user.create({
        data: {
          name: 'Account Context Tester B',
          email: `acc_test_b_${Date.now()}@example.com`,
          passwordHash: 'dummy',
          role: 'TRADER',
        },
      });

      accUsd = await prisma.tradingAccount.create({
        data: {
          userId: userA.id,
          name: 'Live Scalping USD',
          currency: 'USD',
          brokerName: 'Pepperstone',
          startingBalance: 10000.0,
          currentBalance: 10000.0,
        },
      });

      accEur = await prisma.tradingAccount.create({
        data: {
          userId: userA.id,
          name: 'FTMO Challenge EUR',
          currency: 'EUR',
          propFirmName: 'FTMO',
          startingBalance: 100000.0,
          currentBalance: 100000.0,
        },
      });
    });

    after(async () => {
      await prisma.trade.deleteMany({
        where: { tradingAccountId: { in: [accUsd.id, accEur.id] } },
      });
      await prisma.tradingAccount.deleteMany({
        where: { id: { in: [accUsd.id, accEur.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, userB.id] } },
      });
      await prisma.$disconnect();
    });

    it('parseTradeFromText resolves account and authoritative currency when mentioned in message', async () => {
      const mockExtraction = {
        instrument: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.08500,
        exitPrice: 1.08700,
        volume: 1.0,
        grossProfit: 200.0,
        commission: -5.0,
        accountName: 'FTMO Challenge EUR',
        status: 'CLOSED',
      };

      const parsed = await parseTradeFromText({
        text: 'Bought 1 lot EURUSD at 1.08500 on my FTMO Challenge account and closed at 1.08700 for +200 profit.',
        userAccounts: [accUsd, accEur],
        mockExtraction,
      });

      assert.ok(parsed.updatedDraft);
      assert.equal(parsed.updatedDraft.pair, 'EURUSD');
      assert.equal(parsed.updatedDraft.direction, 'BUY');
      assert.equal(parsed.updatedDraft.tradingAccountId, accEur.id);
      assert.equal(parsed.updatedDraft.accountCurrency, 'EUR');
      assert.equal(parsed.accountResolution.authoritativeCurrency, 'EUR');
      assert.equal(parsed.accountResolution.status, 'RESOLVED');
      assert.equal(parsed.accountResolution.resolvedAccount.id, accEur.id);
    });

    it('strictly isolates account boundaries and updates only the target account currency balance', async () => {
      const fakeReq = {
        user: { id: userA.id },
        headers: {},
        body: {
          trade: {
            tradingAccountId: accEur.id,
            pair: 'EURUSD',
            direction: 'BUY',
            entryPrice: 1.08500,
            exitPrice: 1.08700,
            lotSize: 1.0,
            grossProfit: 200.0,
            commission: -5.0,
            swap: 0.0,
            status: 'CLOSED',
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
      assert.equal(responseStatus, 201);
      assert.equal(responseBody.savedCount, 1);

      // Verify EUR balance updated
      const updatedEurAcc = await prisma.tradingAccount.findUnique({
        where: { id: accEur.id },
      });
      assert.equal(updatedEurAcc.currency, 'EUR');
      // 100000 + (200 - 5) = 100195
      assert.equal(Number(updatedEurAcc.currentBalance), 100195.0);

      // Verify USD balance remains completely untouched
      const untouchedUsdAcc = await prisma.tradingAccount.findUnique({
        where: { id: accUsd.id },
      });
      assert.equal(untouchedUsdAcc.currency, 'USD');
      assert.equal(Number(untouchedUsdAcc.currentBalance), 10000.0);
    });

    it('rejects save attempt if user attempts to log trade to another users account', async () => {
      const fakeReq = {
        user: { id: userB.id }, // User B attempting to save to User A's accEur
        headers: {},
        body: {
          trade: {
            tradingAccountId: accEur.id,
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
      assert.ok(responseBody.failedTrades[0].error.includes('unauthorized'));
    });
  });
});
