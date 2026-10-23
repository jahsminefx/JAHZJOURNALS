const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyTrade, isStopAtOrPastEntry, OUTCOMES, EVIDENCE_SOURCES, EVIDENCE_STATUS } = require('../src/services/tradeClassificationService');

describe('EA Sync & Import Classification Logic Suite', () => {
  it('1. Webhook payload with gross profit, commission, and swap produces correct net result and BE outcome', () => {
    // Representative case: BTCUSD gross +2.25, commission -0.66, swap 0.00 -> net +1.59
    const item = {
      pair: 'BTCUSD',
      direction: 'BUY',
      entryPrice: 82351.75,
      exitPrice: 82361.97,
      stopLoss: 82370.08,
      lotSize: 0.22,
      grossProfit: 2.25,
      commission: -0.66,
      swap: 0.00,
      fees: 0,
      profitLossAmount: 1.59,
      status: 'CLOSED',
      userThresholdAmount: 2.50,
    };

    const isInitialStopBe = isStopAtOrPastEntry({
      direction: item.direction,
      entryPrice: item.entryPrice,
      stopLoss: item.stopLoss,
      pair: item.pair,
    });

    assert.equal(isInitialStopBe, true, 'Stop loss 82370.08 is above entry 82351.75 for BUY, so BE is protected');

    const result = classifyTrade({
      ...item,
      breakEvenActivated: isInitialStopBe,
      breakEvenPrice: item.stopLoss,
      breakEvenEvidenceSource: EVIDENCE_SOURCES.MT_TRAILING_STOP,
      breakEvenEvidenceStatus: EVIDENCE_STATUS.CONFIRMED,
    });

    assert.equal(result.result, OUTCOMES.BREAKEVEN);
    assert.equal(result.breakEvenActivated, true);
    assert.equal(result.breakEvenPrice, 82370.08);
    assert.equal(result.netProfit, 1.59);
    assert.equal(result.grossProfit, 2.25);
    assert.equal(result.commission, -0.66);
    assert.equal(result.breakEvenEvidenceStatus, EVIDENCE_STATUS.CONFIRMED);
    assert.equal(result.badgeLabel, 'Break-Even (BE protected)');
  });

  it('2. Trailing stop update triggers SL-to-BE detection on modifying active trade', () => {
    const existingTrade = {
      pair: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.08500,
      stopLoss: 1.08200, // initial SL 30 pips below
      status: 'ACTIVE',
    };

    const updatedStopLoss = 1.08505; // moved 0.5 pip above entry (BE protect)

    const isBeNow = isStopAtOrPastEntry({
      direction: existingTrade.direction,
      entryPrice: existingTrade.entryPrice,
      stopLoss: updatedStopLoss,
      pair: existingTrade.pair,
    });

    assert.equal(isBeNow, true, 'Stop moved to entry or past entry should qualify as BE move');

    const classification = classifyTrade({
      status: 'ACTIVE',
      direction: existingTrade.direction,
      pair: existingTrade.pair,
      entryPrice: existingTrade.entryPrice,
      stopLoss: updatedStopLoss,
      breakEvenActivated: isBeNow,
      breakEvenPrice: updatedStopLoss,
      breakEvenEvidenceSource: EVIDENCE_SOURCES.MT_TRAILING_STOP,
      breakEvenEvidenceStatus: EVIDENCE_STATUS.CONFIRMED,
    });

    assert.equal(classification.result, OUTCOMES.OPEN);
    assert.equal(classification.breakEvenActivated, true);
    assert.equal(classification.breakEvenPrice, 1.08505);
    assert.equal(classification.breakEvenEvidenceStatus, EVIDENCE_STATUS.CONFIRMED);
  });

  it('3. CSV row mapping with separate commission and swap calculates net result correctly', () => {
    // CSV row has: gross 25.00, comm -4.00, swap -22.50 -> net -1.50
    const gross = 25.00;
    const comm = -4.00;
    const swap = -22.50;
    const net = gross + comm + swap; // -1.50

    const classification = classifyTrade({
      status: 'CLOSED',
      direction: 'SELL',
      pair: 'GBPUSD',
      entryPrice: 1.3000,
      exitPrice: 1.2975,
      grossProfit: gross,
      commission: comm,
      swap: swap,
      fees: 0,
      profitLossAmount: net,
      userThresholdAmount: 2.50, // default $2.50 threshold
    });

    assert.equal(classification.netProfit, -1.50);
    assert.equal(classification.result, OUTCOMES.BREAKEVEN, 'Within $2.50 tolerance -> BREAKEVEN');
  });

  it('4. User explicit manual override is preserved during MT sync update', () => {
    const existingTrade = {
      pair: 'XAUUSD',
      direction: 'BUY',
      entryPrice: 2650.00,
      exitPrice: 2650.50,
      isManualResultOverride: true,
      result: 'BREAKEVEN',
      breakEvenActivated: true,
      breakEvenEvidenceStatus: EVIDENCE_STATUS.USER_CONFIRMED,
    };

    // Broker reports a +15.00 profit on close
    const brokerNetProfit = 15.00;

    const classification = classifyTrade({
      status: 'CLOSED',
      direction: existingTrade.direction,
      pair: existingTrade.pair,
      entryPrice: existingTrade.entryPrice,
      exitPrice: existingTrade.exitPrice,
      grossProfit: brokerNetProfit,
      profitLossAmount: brokerNetProfit,
      userConfirmedBe: true,
      manualResultOverride: existingTrade.isManualResultOverride ? existingTrade.result : null,
      userThresholdAmount: 2.50,
    });

    assert.equal(classification.result, 'BREAKEVEN', 'Manual override must be preserved over broker win');
    assert.equal(classification.isManualResultOverride, true);
  });
});
