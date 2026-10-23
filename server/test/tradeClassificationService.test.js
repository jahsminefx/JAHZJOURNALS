const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyTrade,
  isStopAtOrPastEntry,
  getInstrumentPriceTolerance,
  OUTCOMES,
  EVIDENCE_STATUS,
  EVIDENCE_SOURCES,
} = require('../src/services/tradeClassificationService');

test('Classification Unit Tests Suite', async (t) => {
  await t.test('1. Clearly positive net result -> WIN', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 150.00,
    });
    assert.equal(res.result, OUTCOMES.WIN);
    assert.equal(res.badgeLabel, 'Win');
    assert.equal(res.breakEvenActivated, false);
  });

  await t.test('2. Clearly negative net result -> LOSS', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: -120.00,
    });
    assert.equal(res.result, OUTCOMES.LOSS);
    assert.equal(res.badgeLabel, 'Loss');
    assert.equal(res.breakEvenActivated, false);
  });

  await t.test('3. Net result inside configured tolerance -> BREAKEVEN', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 1.25,
      userThresholdAmount: 2.50,
    });
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
    assert.equal(res.badgeLabel, 'Break-Even');
  });

  await t.test('4. Net result exactly at tolerance boundary', () => {
    // Exactly +2.50 with tolerance 2.50 -> BREAKEVEN
    const resUpper = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 2.50,
      userThresholdAmount: 2.50,
    });
    assert.equal(resUpper.result, OUTCOMES.BREAKEVEN);

    // Exactly -2.50 with tolerance 2.50 -> BREAKEVEN
    const resLower = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: -2.50,
      userThresholdAmount: 2.50,
    });
    assert.equal(resLower.result, OUTCOMES.BREAKEVEN);

    // Just above tolerance -> WIN
    const resAbove = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 2.51,
      userThresholdAmount: 2.50,
    });
    assert.equal(resAbove.result, OUTCOMES.WIN);

    // Just below negative tolerance -> LOSS
    const resBelow = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: -2.51,
      userThresholdAmount: 2.50,
    });
    assert.equal(resBelow.result, OUTCOMES.LOSS);
  });

  await t.test('5. Positive gross result but near-zero net result after costs -> BREAKEVEN', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      grossProfit: 4.50,
      commission: -3.00,
      swap: -0.50,
      fees: -0.20, // Net = 4.50 - 3.70 = +0.80
      userThresholdAmount: 2.00,
    });
    assert.equal(res.netProfit, 0.80);
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
  });

  await t.test('6. Commission and swap turning gross BE-like trade into net loss', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      grossProfit: 0.50,
      commission: -6.00,
      swap: -2.00, // Net = 0.50 - 8.00 = -7.50
      userThresholdAmount: 2.50,
    });
    assert.equal(res.netProfit, -7.50);
    assert.equal(res.result, OUTCOMES.LOSS);
  });

  await t.test('7. Small positive net result with confirmed BE management -> positive financial outcome plus BE-managed label', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 3.50,
      userThresholdAmount: 1.00, // net profit 3.50 > 1.00 -> WIN
      userConfirmedBe: true,
    });
    assert.equal(res.result, OUTCOMES.WIN);
    assert.equal(res.breakEvenActivated, true);
    assert.equal(res.badgeLabel, 'Small win · BE protected');
  });

  await t.test('8. Small negative net result with confirmed BE management -> negative financial outcome plus BE-managed label', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: -3.20,
      userThresholdAmount: 1.00, // -3.20 < -1.00 -> LOSS
      userConfirmedBe: true,
    });
    assert.equal(res.result, OUTCOMES.LOSS);
    assert.equal(res.breakEvenActivated, true);
    assert.equal(res.badgeLabel, 'Small loss · BE protected');
  });

  await t.test('9. BE stop event with no closed trade -> remain OPEN', () => {
    const res = classifyTrade({
      status: 'ACTIVE',
      direction: 'BUY',
      entryPrice: 1.0850,
      stopLoss: 1.0855,
      pair: 'EURUSD',
    });
    assert.equal(res.result, OUTCOMES.OPEN);
    assert.equal(res.breakEvenActivated, true);
    assert.equal(res.badgeLabel, 'Active');
  });

  await t.test('10. Missing financial data -> fallback to BREAKEVEN / safe handling', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: null,
      grossProfit: null,
    });
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
  });

  await t.test('11. Representative BTCUSD trade scenario', () => {
    // BUY 0.22 BTCUSD entry: 82351.75, exit: 82361.97, SL: 82370.08, TP: 83174.00
    // Gross: 2.25, Commission: -0.66, Swap: 0.00 -> Net: +1.59
    // Trailing stop used as break-even protection
    const btcTrade = classifyTrade({
      status: 'CLOSED',
      pair: 'BTCUSD',
      direction: 'BUY',
      lotSize: 0.22,
      entryPrice: 82351.75,
      exitPrice: 82361.97,
      stopLoss: 82370.08,
      grossProfit: 2.25,
      commission: -0.66,
      swap: 0.00,
      userThresholdAmount: 2.50,
      userConfirmedBe: true,
    });

    assert.equal(btcTrade.netProfit, 1.59);
    assert.equal(btcTrade.result, OUTCOMES.BREAKEVEN);
    assert.equal(btcTrade.breakEvenActivated, true);
    assert.equal(btcTrade.badgeLabel, 'Break-Even (BE protected)');
  });

  await t.test('11b. Representative BTCUSD trade with default tolerance (no threshold specified): WIN with BE protection badge', () => {
    const btcTrade = classifyTrade({
      status: 'CLOSED',
      pair: 'BTCUSD',
      direction: 'BUY',
      lotSize: 0.22,
      entryPrice: 82351.75,
      exitPrice: 82361.97,
      stopLoss: 82370.08,
      grossProfit: 2.25,
      commission: -0.66,
      swap: 0.00,
      userConfirmedBe: true,
    });

    assert.equal(btcTrade.netProfit, 1.59);
    assert.equal(btcTrade.result, OUTCOMES.WIN);
    assert.equal(btcTrade.breakEvenActivated, true);
    assert.equal(btcTrade.badgeLabel, 'Small win · BE protected');
  });

  await t.test('12. Different instrument tick sizes and price tolerances', () => {
    // Forex EURUSD (0.0002 tolerance)
    assert.equal(isStopAtOrPastEntry({ direction: 'BUY', entryPrice: 1.08500, stopLoss: 1.08505, pair: 'EURUSD' }), true);
    assert.equal(isStopAtOrPastEntry({ direction: 'BUY', entryPrice: 1.08500, stopLoss: 1.08000, pair: 'EURUSD' }), false);

    // JPY pair (USDJPY)
    assert.equal(isStopAtOrPastEntry({ direction: 'SELL', entryPrice: 154.200, stopLoss: 154.190, pair: 'USDJPY' }), true);
    assert.equal(isStopAtOrPastEntry({ direction: 'SELL', entryPrice: 154.200, stopLoss: 155.000, pair: 'USDJPY' }), false);

    // Gold (XAUUSD)
    assert.equal(isStopAtOrPastEntry({ direction: 'BUY', entryPrice: 2650.00, stopLoss: 2650.15, pair: 'XAUUSD' }), true);

    // BTCUSD (BTC Crypto)
    assert.equal(isStopAtOrPastEntry({ direction: 'BUY', entryPrice: 82351.75, stopLoss: 82370.08, pair: 'BTCUSD' }), true);
  });

  await t.test('13. Decimal precision and rounding boundaries', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      grossProfit: 1.9999,
      commission: -0.0049,
      userThresholdAmount: 2.00,
    });
    // 1.9999 - 0.0049 = 1.995 -> 2.00
    assert.equal(res.netProfit, 2.00);
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
  });

  await t.test('14. Trailing stop in slTpHistory sets confirmed BE management', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      direction: 'SELL',
      entryPrice: 1.27500,
      exitPrice: 1.27480,
      profitLossAmount: 2.00,
      slTpHistory: [
        { timestamp: '2026-10-19T10:00:00Z', stopLoss: 1.28000, note: 'Initial SL' },
        { timestamp: '2026-10-19T10:30:00Z', stopLoss: 1.27500, note: 'Moved Stop Loss to Break Even' }
      ]
    });
    assert.equal(res.breakEvenActivated, true);
    assert.equal(res.breakEvenEvidenceStatus, EVIDENCE_STATUS.CONFIRMED);
    assert.equal(res.breakEvenEvidenceSource, EVIDENCE_SOURCES.MT_TRAILING_STOP);
  });

  await t.test('15. User explicit manual override takes precedence', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 500.00, // normally a massive WIN
      manualResultOverride: 'BREAKEVEN',
    });
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
    assert.equal(res.isManualResultOverride, true);
    assert.equal(res.classificationSource, 'USER_OVERRIDE');
  });

  await t.test('16. AI-inferred BE management requiring confirmation', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 1.50,
      userThresholdAmount: 2.00,
      breakEvenEvidenceSource: EVIDENCE_SOURCES.AI_VISION_SUGGESTION,
      breakEvenEvidenceStatus: EVIDENCE_STATUS.INFERRED,
      breakEvenActivated: true,
    });
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
    assert.equal(res.breakEvenActivated, true);
    assert.equal(res.breakEvenEvidenceStatus, EVIDENCE_STATUS.INFERRED);
  });

  await t.test('17. Malformed or invalid numeric inputs handled safely', () => {
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 'invalid_number',
      entryPrice: 'nan',
      exitPrice: null,
    });
    assert.equal(res.result, OUTCOMES.BREAKEVEN);
    assert.equal(res.breakEvenActivated, false);
  });

  await t.test('18. Initial risk does NOT automatically scale tolerance (strictly defaults to 0.00)', () => {
    // Initial risk must not scale tolerance; without explicit userThresholdAmount, effectiveTolerance is 0.00
    const res = classifyTrade({
      status: 'CLOSED',
      profitLossAmount: 4.50,
      initialRisk: 500.00,
    });
    assert.equal(res.effectiveTolerance, 0.00);
    assert.equal(res.result, OUTCOMES.WIN);
  });
});
