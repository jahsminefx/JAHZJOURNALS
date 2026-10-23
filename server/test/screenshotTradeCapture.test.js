const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractTradeFromScreenshot } = require('../src/jobs/processors/processScreenshotTradeCapture');
const { OUTCOMES, EVIDENCE_SOURCES, EVIDENCE_STATUS } = require('../src/services/tradeClassificationService');

describe('Vision AI Screenshot Trade Capture Suite', () => {
  it('1. Representative BTCUSD trade scenario extraction and deterministic classification', async () => {
    // Representative fixture matching user prompt:
    // BTCUSD BUY trade: Entry 82351.75, Exit 82361.97, Vol 0.22, SL 82370.08, TP 83174.00, Gross 2.25, Comm -0.66, Swap 0.00
    const mockExtraction = {
      instrument: { value: 'BTCUSD', status: 'CONFIRMED' },
      direction: { value: 'BUY', status: 'CONFIRMED' },
      volume: { value: 0.22, status: 'CONFIRMED' },
      entryPrice: { value: 82351.75, status: 'CONFIRMED' },
      exitPrice: { value: 82361.97, status: 'CONFIRMED' },
      stopLoss: { value: 82370.08, status: 'CONFIRMED' },
      takeProfit: { value: 83174.00, status: 'CONFIRMED' },
      grossProfit: { value: 2.25, status: 'CONFIRMED' },
      commission: { value: -0.66, status: 'CONFIRMED' },
      swap: { value: 0.00, status: 'CONFIRMED' },
      fees: { value: 0, status: 'CONFIRMED' },
      ticket: { value: '184920412', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-19T08:30:00Z', status: 'CONFIRMED' },
      exitTime: { value: '2026-10-19T14:45:00Z', status: 'CONFIRMED' },
      accountCurrency: { value: 'USD', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: true,
        rationale: 'Stop loss was trailed above entry price (82,370.08 > 82,351.75) to protect position at break-even.',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'MT_TRAILING_STOP',
      },
      confidenceScore: 0.95,
      rawSummary: 'BTCUSD BUY 0.22 lots closed at 82361.97 with gross +2.25 and commission -0.66.',
    };

    const result = await extractTradeFromScreenshot({
      mockExtraction,
      userThresholdAmount: 2.50,
    });

    // 1. Mandatory rule: AI does NOT invent final net profit or authoritative outcome; deterministic service does.
    assert.equal(result.deterministicTrade.profitLossAmount, 1.59, 'Net profit must be exactly 2.25 - 0.66 = 1.59');
    assert.equal(result.deterministicTrade.result, OUTCOMES.BREAKEVEN, 'Net profit 1.59 within $2.50 tolerance -> BREAKEVEN');
    assert.equal(result.deterministicTrade.breakEvenActivated, true, 'BE protection candidate recognized from trailing stop above entry');
    assert.equal(result.deterministicTrade.breakEvenPrice, 82370.08);
    assert.equal(result.deterministicTrade.badgeLabel, 'Break-Even (BE protected)');

    // 2. Mandatory rule: User confirmation required before saving to database
    assert.equal(result.requiresUserConfirmation, true, 'AI extraction must always require explicit user review');
    assert.equal(result.deterministicTrade.breakEvenEvidenceStatus, EVIDENCE_STATUS.INFERRED);
    assert.equal(result.deterministicTrade.breakEvenEvidenceSource, EVIDENCE_SOURCES.AI_VISION_SUGGESTION);

    // 3. Field level status checks
    assert.equal(result.fieldStatuses.instrument, 'CONFIRMED');
    assert.equal(result.fieldStatuses.entryPrice, 'CONFIRMED');
    assert.equal(result.fieldStatuses.exitPrice, 'CONFIRMED');
    assert.equal(result.fieldStatuses.commission, 'CONFIRMED');
  });

  it('2. Missing or obscured fields are marked MISSING/UNCERTAIN without hallucinated values', async () => {
    const mockExtraction = {
      instrument: { value: 'EURUSD', status: 'CONFIRMED' },
      direction: { value: 'SELL', status: 'CONFIRMED' },
      volume: { value: 1.0, status: 'CONFIRMED' },
      entryPrice: { value: 1.09200, status: 'CONFIRMED' },
      exitPrice: { value: null, status: 'MISSING', note: 'Trade still open' },
      stopLoss: { value: 1.09200, status: 'CONFIRMED' }, // stop at entry
      takeProfit: { value: null, status: 'MISSING' },
      grossProfit: { value: null, status: 'MISSING' },
      commission: { value: -5.00, status: 'CONFIRMED' },
      swap: { value: 0, status: 'CONFIRMED' },
      fees: { value: 0, status: 'CONFIRMED' },
      ticket: { value: '987654', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-20T10:00:00Z', status: 'CONFIRMED' },
      exitTime: { value: null, status: 'MISSING' },
      accountCurrency: { value: 'USD', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: true,
        rationale: 'Stop moved exactly to entry price (1.09200)',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'MT_SL_TO_ENTRY',
      },
      confidenceScore: 0.90,
      rawSummary: 'EURUSD SELL trade with SL moved to entry, currently open.',
    };

    const result = await extractTradeFromScreenshot({ mockExtraction, userThresholdAmount: 2.50 });

    assert.equal(result.deterministicTrade.status, 'ACTIVE');
    assert.equal(result.deterministicTrade.result, OUTCOMES.OPEN);
    assert.equal(result.deterministicTrade.breakEvenActivated, true);
    assert.equal(result.deterministicTrade.breakEvenPrice, 1.09200);
    assert.equal(result.fieldStatuses.exitPrice, 'MISSING');
    assert.equal(result.fieldStatuses.grossProfit, 'MISSING');
  });

  it('3. Conventional win trade without BE behavior is not marked as BE', async () => {
    const mockExtraction = {
      instrument: { value: 'NAS100', status: 'CONFIRMED' },
      direction: { value: 'BUY', status: 'CONFIRMED' },
      volume: { value: 2.0, status: 'CONFIRMED' },
      entryPrice: { value: 20000.0, status: 'CONFIRMED' },
      exitPrice: { value: 20200.0, status: 'CONFIRMED' },
      stopLoss: { value: 19900.0, status: 'CONFIRMED' },
      takeProfit: { value: 20200.0, status: 'CONFIRMED' },
      grossProfit: { value: 400.0, status: 'CONFIRMED' },
      commission: { value: -4.0, status: 'CONFIRMED' },
      swap: { value: 0.0, status: 'CONFIRMED' },
      fees: { value: 0, status: 'CONFIRMED' },
      ticket: { value: '456789', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-21T13:30:00Z', status: 'CONFIRMED' },
      exitTime: { value: '2026-10-21T15:30:00Z', status: 'CONFIRMED' },
      accountCurrency: { value: 'USD', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: false,
        rationale: 'Stop was kept at initial level and hit take profit.',
        requiresUserConfirmation: false,
        candidateEvidenceSource: 'UNKNOWN',
      },
      confidenceScore: 0.98,
      rawSummary: 'NAS100 BUY hit TP for +$396 net.',
    };

    const result = await extractTradeFromScreenshot({ mockExtraction, userThresholdAmount: 2.50 });

    assert.equal(result.deterministicTrade.result, OUTCOMES.WIN);
    assert.equal(result.deterministicTrade.breakEvenActivated, false);
    assert.equal(result.deterministicTrade.profitLossAmount, 396.0);
    assert.equal(result.deterministicTrade.badgeLabel, 'Win');
  });
});
