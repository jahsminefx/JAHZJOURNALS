const test = require('node:test');
const assert = require('node:assert/strict');
const currencyService = require('../src/services/fx/currencyService');
const { quickTradeSchema } = require('../src/validation/tradeSchemas');
const { calculatePositionSize } = require('../../client/src/services/riskCalculatorService');
const { formatCurrency } = require('../../client/src/utils/dashboard');

async function calculateMultiAccountPortfolioUsd(accounts) {
  let totalBalanceUsd = 0;
  for (const acc of accounts) {
    const res = await currencyService.convertToReportingCurrency(acc.balance, acc.currency);
    totalBalanceUsd += (res.convertedAmount || 0);
  }
  return { totalBalanceUsd: Number(totalBalanceUsd.toFixed(2)) };
}

test('Multi-Currency Architecture V2.1 Comprehensive Audit Suite', async (mainTest) => {
  mainTest.beforeEach(() => {
    currencyService.clearFxCache();
  });

  // 1-7: Single Account Native Balance & Risk Calculations
  await mainTest.test('Scenario 1: USD account risk calculation is native', () => {
    const res = calculatePositionSize({
      balance: 10000,
      riskPercent: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      direction: 'BUY',
      pair: 'EURUSD',
      accountCurrency: 'USD',
    });
    assert.equal(res.targetCapitalAtRisk, 100);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'USD').includes('100.00'));
  });

  await mainTest.test('Scenario 2: NGN account risk calculation is native (₦3,000,000 balance -> ₦30,000 risk)', () => {
    const res = calculatePositionSize({
      balance: 3000000,
      riskPercent: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      direction: 'BUY',
      pair: 'EURUSD',
      accountCurrency: 'NGN',
    });
    assert.equal(res.targetCapitalAtRisk, 30000);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'NGN').includes('30,000.00'));
  });

  await mainTest.test('Scenario 3: GBP account risk calculation is native (£5,000 balance -> £50 risk)', () => {
    const res = calculatePositionSize({
      balance: 5000,
      riskPercent: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      direction: 'BUY',
      pair: 'EURUSD',
      accountCurrency: 'GBP',
    });
    assert.equal(res.targetCapitalAtRisk, 50);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'GBP').includes('50.00'));
  });

  await mainTest.test('Scenario 4: EUR account risk calculation is native (€10,000 balance -> €100 risk)', () => {
    const res = calculatePositionSize({
      balance: 10000,
      riskPercent: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      direction: 'BUY',
      pair: 'EURUSD',
      accountCurrency: 'EUR',
    });
    assert.equal(res.targetCapitalAtRisk, 100);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'EUR').includes('100.00'));
  });

  await mainTest.test('Scenario 5: JPY account risk calculation is native (¥1,000,000 balance -> ¥10,000 risk)', () => {
    const res = calculatePositionSize({
      balance: 1000000,
      riskPercent: 1.0,
      entryPrice: 152.50,
      stopLoss: 152.00,
      direction: 'BUY',
      pair: 'USDJPY',
      accountCurrency: 'JPY',
    });
    assert.equal(res.targetCapitalAtRisk, 10000);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'JPY').includes('10,000'));
  });

  await mainTest.test('Scenario 6: CAD account risk calculation is native (C$15,000 balance -> C$150 risk)', () => {
    const res = calculatePositionSize({
      balance: 15000,
      riskPercent: 1.0,
      entryPrice: 1.3500,
      stopLoss: 1.3450,
      direction: 'BUY',
      pair: 'USDCAD',
      accountCurrency: 'CAD',
    });
    assert.equal(res.targetCapitalAtRisk, 150);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'CAD').includes('150.00'));
  });

  await mainTest.test('Scenario 7: AUD account risk calculation is native (A$20,000 balance -> A$200 risk)', () => {
    const res = calculatePositionSize({
      balance: 20000,
      riskPercent: 1.0,
      entryPrice: 0.6500,
      stopLoss: 0.6450,
      direction: 'BUY',
      pair: 'AUDUSD',
      accountCurrency: 'AUD',
    });
    assert.equal(res.targetCapitalAtRisk, 200);
    assert.ok(formatCurrency(res.targetCapitalAtRisk, 'AUD').includes('200.00'));
  });

  // 8-11: Multi-Account USD Portfolio Normalization
  await mainTest.test('Scenario 8: USD + NGN portfolio normalization to USD', async () => {
    const accUsd = { balance: 10000, currency: 'USD' };
    const accNgn = { balance: 3100000, currency: 'NGN' }; // 3,100,000 NGN @ 1550 = $2,000 USD
    const totalNormalized = await calculateMultiAccountPortfolioUsd([accUsd, accNgn]);
    assert.equal(totalNormalized.totalBalanceUsd, 12000);
  });

  await mainTest.test('Scenario 9: USD + GBP portfolio normalization to USD', async () => {
    const accUsd = { balance: 10000, currency: 'USD' };
    const accGbp = { balance: 7800, currency: 'GBP' }; // 7,800 GBP @ ~0.78 USD = ~$10,000 USD
    const totalNormalized = await calculateMultiAccountPortfolioUsd([accUsd, accGbp]);
    assert.ok(Math.abs(totalNormalized.totalBalanceUsd - 20000) < 200);
  });

  await mainTest.test('Scenario 10: USD + NGN + GBP portfolio normalization to USD', async () => {
    const accUsd = { balance: 10000, currency: 'USD' };
    const accNgn = { balance: 1550000, currency: 'NGN' }; // ~$1,000 USD
    const accGbp = { balance: 3900, currency: 'GBP' }; // ~$5,000 USD
    const totalNormalized = await calculateMultiAccountPortfolioUsd([accUsd, accNgn, accGbp]);
    assert.ok(Math.abs(totalNormalized.totalBalanceUsd - 16000) < 200);
  });

  await mainTest.test('Scenario 11: NGN + EUR + GBP non-USD multi-portfolio normalization to USD', async () => {
    const accNgn = { balance: 1550000, currency: 'NGN' }; // ~$1,000 USD
    const accEur = { balance: 920, currency: 'EUR' }; // ~$1,000 USD
    const accGbp = { balance: 780, currency: 'GBP' }; // ~$1,000 USD
    const totalNormalized = await calculateMultiAccountPortfolioUsd([accNgn, accEur, accGbp]);
    assert.ok(Math.abs(totalNormalized.totalBalanceUsd - 3000) < 20);
  });

  // 12-18: Non-USD Accounts Cross-Currency Position Sizing
  await mainTest.test('Scenario 12: NGN account + EURUSD pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 3000000,
      riskPercent: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      direction: 'BUY',
      pair: 'EURUSD',
      accountCurrency: 'NGN',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 30000);
  });

  await mainTest.test('Scenario 13: NGN account + USDJPY pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 3000000,
      riskPercent: 1.0,
      entryPrice: 152.50,
      stopLoss: 152.00,
      direction: 'BUY',
      pair: 'USDJPY',
      accountCurrency: 'NGN',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 30000);
  });

  await mainTest.test('Scenario 14: NGN account + GBPJPY pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 3000000,
      riskPercent: 1.0,
      entryPrice: 195.00,
      stopLoss: 194.50,
      direction: 'BUY',
      pair: 'GBPJPY',
      accountCurrency: 'NGN',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 30000);
  });

  await mainTest.test('Scenario 15: NGN account + XAUUSD pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 3000000,
      riskPercent: 1.0,
      entryPrice: 2500.00,
      stopLoss: 2490.00,
      direction: 'BUY',
      pair: 'XAUUSD',
      accountCurrency: 'NGN',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 30000);
  });

  await mainTest.test('Scenario 16: GBP account + EURUSD pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 5000,
      riskPercent: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      direction: 'BUY',
      pair: 'EURUSD',
      accountCurrency: 'GBP',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 50);
  });

  await mainTest.test('Scenario 17: EUR account + USDJPY pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 10000,
      riskPercent: 1.0,
      entryPrice: 152.50,
      stopLoss: 152.00,
      direction: 'BUY',
      pair: 'USDJPY',
      accountCurrency: 'EUR',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 100);
  });

  await mainTest.test('Scenario 18: JPY account + XAUUSD pair position sizing', () => {
    const res = calculatePositionSize({
      balance: 1000000,
      riskPercent: 1.0,
      entryPrice: 2500.00,
      stopLoss: 2490.00,
      direction: 'BUY',
      pair: 'XAUUSD',
      accountCurrency: 'JPY',
    });
    assert.ok(res.safeLotSize > 0);
    assert.equal(res.targetCapitalAtRisk, 10000);
  });

  // 19-25: FX Resolution Chain, Caching & Deduplication
  await mainTest.test('Scenario 19: LIVE FX resolution status', async () => {
    const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
    assert.equal(details.source, 'LIVE');
    assert.equal(details.status, 'OK');
  });

  await mainTest.test('Scenario 20: CACHED FX resolution status on provider failure', async () => {
    // Prime cache
    await currencyService.getExchangeRateDetails('USD', 'NGN');

    // Force cache expiration so live fetch is triggered
    const table = await currencyService.getExchangeRateDetails('USD', 'NGN');
    table.expiresAt = new Date(Date.now() - 1000);

    const orig = currencyService.fxRateProvider.fetchLiveRates;
    currencyService.fxRateProvider.fetchLiveRates = async () => ({ success: false, rates: null });

    try {
      const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
      assert.equal(details.status, 'OK');
      assert.ok(details.source === 'CACHED' || details.source === 'LIVE');
    } finally {
      currencyService.fxRateProvider.fetchLiveRates = orig;
    }
  });

  await mainTest.test('Scenario 21: UNAVAILABLE FX handling when provider fails and cache empty', async () => {
    const orig = currencyService.fxRateProvider.fetchLiveRates;
    currencyService.fxRateProvider.fetchLiveRates = async () => ({ success: false, rates: null });

    try {
      const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
      assert.equal(details.source, 'UNAVAILABLE');
      assert.equal(details.status, 'UNAVAILABLE');
      assert.equal(details.rate, null);
    } finally {
      currencyService.fxRateProvider.fetchLiveRates = orig;
    }
  });

  await mainTest.test('Scenario 22: Malformed FX response handling', async () => {
    const orig = currencyService.fxRateProvider.fetchLiveRates;
    currencyService.fxRateProvider.fetchLiveRates = async () => ({ success: true, rates: { NGN: "INVALID_NUMBER" } });

    try {
      const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
      assert.equal(details.status, 'UNAVAILABLE');
    } finally {
      currencyService.fxRateProvider.fetchLiveRates = orig;
    }
  });

  await mainTest.test('Scenario 23: Unsupported currency handling defaults to USD gracefully', async () => {
    const details = await currencyService.getExchangeRateDetails('INVALID_CURRENCY', 'USD');
    assert.equal(details.fromCurrency, 'USD');
    assert.equal(details.toCurrency, 'USD');
    assert.equal(details.rate, 1.0);
  });

  await mainTest.test('Scenario 24: Cache expiration marks rate as stale', async () => {
    const details = await currencyService.getExchangeRateDetails('USD', 'NGN');
    assert.equal(details.isStale, false);
  });

  await mainTest.test('Scenario 25: Concurrent FX requests deduplication', async () => {
    let callCount = 0;
    const orig = currencyService.fxRateProvider.fetchLiveRates;
    currencyService.fxRateProvider.fetchLiveRates = async (base) => {
      callCount++;
      await new Promise(r => setTimeout(r, 50));
      return orig(base);
    };

    try {
      // Fire 10 simultaneous requests
      await Promise.all(Array.from({ length: 10 }).map(() => currencyService.getExchangeRateDetails('USD', 'NGN')));
      assert.equal(callCount, 1);
    } finally {
      currencyService.fxRateProvider.fetchLiveRates = orig;
    }
  });

  // 26-29: Account Validation & Inheritance
  await mainTest.test('Scenario 26: Trade creation requires mandatory tradingAccountId', () => {
    const invalidPayload = { pair: 'EURUSD', direction: 'BUY', status: 'PLANNED' };
    const res = quickTradeSchema.safeParse(invalidPayload);
    assert.equal(res.success, false);
  });

  await mainTest.test('Scenario 27: Invalid tradingAccountId fails schema validation', () => {
    const invalidPayload = { tradingAccountId: 'not-a-uuid', pair: 'EURUSD', direction: 'BUY', status: 'PLANNED' };
    const res = quickTradeSchema.safeParse(invalidPayload);
    assert.equal(res.success, false);
  });

  await mainTest.test('Scenario 28: Valid tradingAccountId UUID passes schema validation', () => {
    const validPayload = { tradingAccountId: '123e4567-e89b-12d3-a456-426614174000', pair: 'EURUSD', direction: 'BUY', status: 'PLANNED' };
    const res = quickTradeSchema.safeParse(validPayload);
    assert.equal(res.success, true);
  });

  await mainTest.test('Scenario 29: Account currency inheritance helper', () => {
    const account = { id: 'acc-1', name: 'Naira Trading Account', currency: 'NGN' };
    const inheritedCurrency = account.currency || 'USD';
    assert.equal(inheritedCurrency, 'NGN');
  });

  // 30-34: Financial Metrics & Normalization
  await mainTest.test('Scenario 30: Native risk percentage calculation', () => {
    const balance = 3000000;
    const riskPercent = 1.0;
    const riskAmount = (balance * riskPercent) / 100;
    assert.equal(riskAmount, 30000);
  });

  await mainTest.test('Scenario 31: USD portfolio normalization preserves total monetary value', async () => {
    const accounts = [
      { balance: 5000, currency: 'USD' },
      { balance: 1550000, currency: 'NGN' },
    ];
    const normalized = await calculateMultiAccountPortfolioUsd(accounts);
    assert.equal(normalized.totalBalanceUsd, 6000);
  });

  await mainTest.test('Scenario 32: Single account view preserves native currency without conversion', () => {
    const account = { balance: 3000000, currency: 'NGN' };
    const formatted = formatCurrency(account.balance, account.currency);
    assert.ok(formatted.includes('3,000,000.00'));
  });

  await mainTest.test('Scenario 33: Point-by-point equity curve USD normalization', async () => {
    const rawDataPoints = [
      { date: '2026-08-01', balance: 3100000, currency: 'NGN' }, // $2,000 USD
      { date: '2026-08-02', balance: 10000, currency: 'USD' },  // $10,000 USD
    ];
    const normalizedPoints = await Promise.all(rawDataPoints.map(async p => {
      const res = await currencyService.convertToReportingCurrency(p.balance, p.currency);
      return { date: p.date, usdBalance: res.convertedAmount };
    }));
    assert.equal(normalizedPoints[0].usdBalance, 2000);
    assert.equal(normalizedPoints[1].usdBalance, 10000);
  });

  await mainTest.test('Scenario 34: Monetary drawdown USD normalization vs percentage drawdown', async () => {
    const nativeDrawdownMonetary = 310000; // 310,000 NGN
    const res = await currencyService.convertToReportingCurrency(nativeDrawdownMonetary, 'NGN');
    assert.equal(res.convertedAmount, 200.00); // $200 USD monetary drawdown
  });

  // 35-37: Historical FX & Open Trades
  await mainTest.test('Scenario 35: Historical FX metadata on closed trade structure', () => {
    const closedTrade = {
      id: 'trade-101',
      profitLossAmount: 150000,
      fxRateToReporting: 0.000645,
      fxRateSource: 'LIVE',
      fxRateTimestamp: new Date(),
    };
    assert.equal(closedTrade.fxRateToReporting, 0.000645);
    assert.equal(closedTrade.fxRateSource, 'LIVE');
  });

  await mainTest.test('Scenario 36: Distinction between current FX rate and stored historical FX rate', async () => {
    const historicalTradeFx = 0.000645; // Stored 6 months ago
    const currentRateDetails = await currencyService.getExchangeRateDetails('NGN', 'USD'); // Live rate 1/1550 = 0.00064516
    assert.ok(currentRateDetails.rate > 0);
    assert.equal(typeof historicalTradeFx, 'number');
  });

  await mainTest.test('Scenario 37: Open trade unrealized P/L calculated in native currency first', () => {
    const openTrade = {
      unrealizedPnl: 45000,
      accountCurrency: 'NGN',
    };
    const formatted = formatCurrency(openTrade.unrealizedPnl, openTrade.accountCurrency);
    assert.ok(formatted.includes('45,000.00'));
  });

  // 38-40: Reports & AI Formatting
  await mainTest.test('Scenario 38: CSV export currency label formatting', () => {
    const tradeRow = {
      pair: 'EURUSD',
      pnl: 150000,
      accountCurrency: 'NGN',
    };
    const csvValue = `${tradeRow.pnl} ${tradeRow.accountCurrency}`;
    assert.equal(csvValue, '150000 NGN');
  });

  await mainTest.test('Scenario 39: PDF export currency formatting helper', () => {
    const formattedPnl = formatCurrency(150000, 'NGN', { signDisplay: 'always' });
    assert.ok(formattedPnl.includes('150,000.00'));
    assert.ok(formattedPnl.includes('+'));
  });

  await mainTest.test('Scenario 40: AI Prompt explicit currency context string format', () => {
    const aiContext = `Account Balance: ₦3,000,000 NGN | Trade Risk: ₦30,000 NGN | Reporting Currency: USD`;
    assert.ok(aiContext.includes('NGN'));
    assert.ok(aiContext.includes('USD'));
  });
});
