const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTradeFromText,
  parseTradeFromImage,
  parseBatchImages,
} = require('../src/services/aiTradeCaptureService');
const { OUTCOMES, EVIDENCE_STATUS, EVIDENCE_SOURCES } = require('../src/services/tradeClassificationService');

describe('AI Trade Capture Service Suite', () => {
  const mockAccounts = [
    { id: 'acc-uuid-1', name: 'FTMO 100K Funded', currency: 'USD' },
    { id: 'acc-uuid-2', name: 'IC Markets Raw', currency: 'EUR' },
  ];

  it('1. Natural language: Complete trade description extracts all fields correctly', async () => {
    // "I bought GBPUSD at 1.26350 and closed at 1.26700. My stop loss was 1.26100 and take profit was 1.26800. I used 0.5 lots on FTMO, risked 1%, and moved my stop to break-even before price came back."
    const mockExtraction = {
      instrument: 'GBPUSD',
      direction: 'BUY',
      entryPrice: 1.26350,
      exitPrice: 1.26700,
      stopLoss: 1.26100,
      takeProfit: 1.26800,
      volume: 0.5,
      grossProfit: 175.0,
      commission: -3.5,
      swap: 0.0,
      accountName: 'FTMO',
      strategyName: 'Liquidity Grab',
      setupType: 'London Open Breakout',
      breakEvenMentioned: true,
      trailingStopMentioned: true,
      status: 'CLOSED',
      assistantReply: 'Captured your GBPUSD BUY trade on FTMO. Since you moved your stop to break-even, I have flagged BE protection.',
      missingFields: [],
      confidenceScore: 0.95,
    };

    const result = await parseTradeFromText({
      text: 'I bought GBPUSD at 1.26350 and closed at 1.26700...',
      currentDraft: {},
      userAccounts: mockAccounts,
      mockExtraction,
    });

    assert.equal(result.updatedDraft.pair, 'GBPUSD');
    assert.equal(result.updatedDraft.direction, 'BUY');
    assert.equal(result.updatedDraft.entryPrice, 1.26350);
    assert.equal(result.updatedDraft.exitPrice, 1.26700);
    assert.equal(result.updatedDraft.lotSize, 0.5);
    assert.equal(result.updatedDraft.tradingAccountId, 'acc-uuid-1');
    assert.equal(result.updatedDraft.accountName, 'FTMO 100K Funded');
    assert.equal(result.updatedDraft.breakEvenActivated, true);
    assert.equal(result.updatedDraft.breakEvenEvidenceStatus, EVIDENCE_STATUS.USER_CONFIRMED);
    assert.equal(result.isReadyToSave, true);
  });

  it('2. Natural language: Partial description does NOT invent missing volume or account', async () => {
    // "I sold gold at 2745 and closed at 2730."
    const mockExtraction = {
      instrument: 'XAUUSD',
      direction: 'SELL',
      entryPrice: 2745.0,
      exitPrice: 2730.0,
      stopLoss: null,
      takeProfit: null,
      volume: null,
      grossProfit: null,
      accountName: null,
      status: 'CLOSED',
      assistantReply: 'I recorded a SELL on XAUUSD (Gold) from 2745.00 to 2730.00. What lot size did you use, and which account should this be logged to?',
      missingFields: ['volume', 'tradingAccount'],
      confidenceScore: 0.90,
    };

    const result = await parseTradeFromText({
      text: 'I sold gold at 2745 and closed at 2730.',
      currentDraft: {},
      userAccounts: mockAccounts, // has 2 accounts, so ambiguous
      mockExtraction,
    });

    assert.equal(result.updatedDraft.pair, 'XAUUSD');
    assert.equal(result.updatedDraft.direction, 'SELL');
    assert.equal(result.updatedDraft.entryPrice, 2745.0);
    assert.equal(result.updatedDraft.exitPrice, 2730.0);
    assert.equal(result.updatedDraft.lotSize, null, 'Volume must not be hallucinated');
    assert.equal(result.updatedDraft.tradingAccountId, null, 'Account must not be chosen arbitrarily when ambiguous');
    assert.equal(result.isReadyToSave, false, 'Should not be ready to save without required fields');
    assert.ok(result.missingFields.includes('Trading Account'));
  });

  it('3. Natural language: User correction updates draft without discarding confirmed fields', async () => {
    const existingDraft = {
      pair: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.08500,
      exitPrice: 1.08900,
      lotSize: 1.0,
      tradingAccountId: 'acc-uuid-1',
      accountName: 'FTMO 100K Funded',
      status: 'CLOSED',
    };

    // User says: "Actually my volume was 2.0 lots and stop loss was 1.08200"
    const mockExtraction = {
      instrument: null,
      direction: null,
      entryPrice: null,
      exitPrice: null,
      stopLoss: 1.08200,
      volume: 2.0,
      assistantReply: 'Updated your lot size to 2.0 lots and stop loss to 1.08200.',
      missingFields: [],
    };

    const result = await parseTradeFromText({
      text: 'Actually my volume was 2.0 lots and stop loss was 1.08200',
      currentDraft: existingDraft,
      userAccounts: mockAccounts,
      mockExtraction,
    });

    assert.equal(result.updatedDraft.pair, 'EURUSD', 'Preserves instrument');
    assert.equal(result.updatedDraft.direction, 'BUY', 'Preserves direction');
    assert.equal(result.updatedDraft.entryPrice, 1.08500, 'Preserves entry price');
    assert.equal(result.updatedDraft.exitPrice, 1.08900, 'Preserves exit price');
    assert.equal(result.updatedDraft.lotSize, 2.0, 'Updates volume to corrected value');
    assert.equal(result.updatedDraft.stopLoss, 1.08200, 'Sets stop loss');
    assert.equal(result.updatedDraft.tradingAccountId, 'acc-uuid-1');
  });

  it('4. Screenshot: Broker receipt extraction with gross/net profit and fee preservation', async () => {
    const mockExtraction = {
      screenshotType: 'BROKER_RECEIPT',
      instrument: { value: 'EURUSD', status: 'CONFIRMED' },
      direction: { value: 'SELL', status: 'CONFIRMED' },
      volume: { value: 1.5, status: 'CONFIRMED' },
      entryPrice: { value: 1.09500, status: 'CONFIRMED' },
      exitPrice: { value: 1.09100, status: 'CONFIRMED' },
      stopLoss: { value: 1.09700, status: 'CONFIRMED' },
      takeProfit: { value: 1.09000, status: 'CONFIRMED' },
      grossProfit: { value: 600.00, status: 'CONFIRMED' },
      commission: { value: -9.00, status: 'CONFIRMED' },
      swap: { value: -2.50, status: 'CONFIRMED' },
      fees: { value: 0, status: 'CONFIRMED' },
      ticket: { value: '7891234', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-22T09:00:00Z', status: 'CONFIRMED' },
      exitTime: { value: '2026-10-22T13:30:00Z', status: 'CONFIRMED' },
      accountCurrency: { value: 'USD', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: false,
        requiresUserConfirmation: false,
        candidateEvidenceSource: 'UNKNOWN',
      },
      confidenceScore: 0.98,
    };

    const result = await parseTradeFromImage({
      mockExtraction,
      userAccounts: [{ id: 'single-acc', name: 'Main Account' }],
    });

    assert.equal(result.candidateTrade.pair, 'EURUSD');
    assert.equal(result.candidateTrade.direction, 'SELL');
    assert.equal(result.candidateTrade.status, 'CLOSED');
    assert.equal(result.candidateTrade.result, OUTCOMES.WIN);
    assert.equal(result.candidateTrade.grossProfit, 600.00);
    assert.equal(result.candidateTrade.commission, -9.00);
    assert.equal(result.candidateTrade.swap, -2.50);
    assert.equal(result.candidateTrade.profitLossAmount, 588.50, 'Net profit = 600 - 9 - 2.50 = 588.50');
    assert.equal(result.candidateTrade.externalId, '7891234');
    assert.equal(result.candidateTrade.tradingAccountId, 'single-acc');
  });

  it('5. Screenshot: Open position defaults status to ACTIVE and exitPrice to null', async () => {
    const mockExtraction = {
      screenshotType: 'OPEN_POSITION',
      instrument: { value: 'US30', status: 'CONFIRMED' },
      direction: { value: 'BUY', status: 'CONFIRMED' },
      volume: { value: 0.1, status: 'CONFIRMED' },
      entryPrice: { value: 43200.0, status: 'CONFIRMED' },
      exitPrice: { value: null, status: 'MISSING' },
      stopLoss: { value: 43205.0, status: 'CONFIRMED' }, // stop moved 5 pts in profit (BE protect)
      takeProfit: { value: 43500.0, status: 'CONFIRMED' },
      grossProfit: { value: 12.50, status: 'CONFIRMED', note: 'Floating PnL' },
      commission: { value: -1.0, status: 'CONFIRMED' },
      swap: { value: 0, status: 'CONFIRMED' },
      ticket: { value: '556677', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-23T08:00:00Z', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: true,
        rationale: 'Stop loss was moved above entry (43205 > 43200)',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'MT_SL_TO_ENTRY',
      },
      confidenceScore: 0.92,
    };

    const result = await parseTradeFromImage({ mockExtraction });

    assert.equal(result.candidateTrade.status, 'ACTIVE');
    assert.equal(result.candidateTrade.result, OUTCOMES.OPEN);
    assert.equal(result.candidateTrade.exitPrice, null);
    assert.equal(result.candidateTrade.profitLossAmount, null, 'Active trade must not record realized PnL');
    assert.equal(result.candidateTrade.breakEvenActivated, true);
    assert.equal(result.candidateTrade.breakEvenPrice, 43205.0);
  });

  it('6. Screenshot: Annotated chart setup defaults status to PLANNED (never closed)', async () => {
    const mockExtraction = {
      screenshotType: 'CHART_SETUP',
      instrument: { value: 'NAS100', status: 'CONFIRMED' },
      direction: { value: 'SELL', status: 'CONFIRMED' },
      volume: { value: null, status: 'MISSING' },
      entryPrice: { value: 20150.0, status: 'CONFIRMED', note: 'Planned entry level' },
      exitPrice: { value: null, status: 'MISSING' },
      stopLoss: { value: 20220.0, status: 'CONFIRMED' },
      takeProfit: { value: 19950.0, status: 'CONFIRMED' },
      timeframe: { value: '15m', status: 'CONFIRMED' },
      setupDescription: { value: 'Bearish breaker block retest during London session', status: 'CONFIRMED' },
      grossProfit: { value: null, status: 'MISSING' },
      breakEvenCandidate: {
        isBreakEvenCandidate: false,
        requiresUserConfirmation: false,
      },
      confidenceScore: 0.88,
    };

    const result = await parseTradeFromImage({ mockExtraction });

    assert.equal(result.candidateTrade.status, 'PLANNED', 'Chart setups must be marked PLANNED, never false closed trades');
    assert.equal(result.candidateTrade.result, OUTCOMES.OPEN);
    assert.equal(result.candidateTrade.entryReason, 'Bearish breaker block retest during London session');
    assert.equal(result.candidateTrade.timeframe, '15m');
  });

  it('7. Representative BTCUSD trade scenario: Trailing stop BE protection & deterministic tolerance', async () => {
    // Representative fixture from project specification:
    // BTCUSD BUY: Entry 82,351.75, Exit 82,361.97, Vol 0.22, SL 82,370.08, TP 83,174.00, Gross 2.25, Comm -0.66, Swap 0.00
    const mockExtraction = {
      screenshotType: 'BROKER_RECEIPT',
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
      ticket: { value: '43789391', status: 'CONFIRMED' },
      entryTime: { value: '2026-10-19T11:40:16Z', status: 'CONFIRMED' },
      exitTime: { value: '2026-10-19T14:35:16Z', status: 'CONFIRMED' },
      breakEvenCandidate: {
        isBreakEvenCandidate: true,
        rationale: 'Stop loss 82,370.08 is placed above entry 82,351.75, representing trailing stop / BE protection.',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'MT_TRAILING_STOP',
      },
      confidenceScore: 0.95,
    };

    const result = await parseTradeFromImage({
      mockExtraction,
      userThresholdAmount: 2.50,
    });

    // Deterministic validation:
    // Net profit = 2.25 - 0.66 = 1.59
    assert.equal(result.candidateTrade.profitLossAmount, 1.59);
    // Since |1.59| <= 2.50, result is BREAKEVEN
    assert.equal(result.candidateTrade.result, OUTCOMES.BREAKEVEN);
    assert.equal(result.candidateTrade.breakEvenActivated, true);
    assert.equal(result.candidateTrade.breakEvenPrice, 82370.08);
    assert.equal(result.candidateTrade.badgeLabel, 'Break-Even (BE protected)');
    assert.equal(result.requiresUserConfirmation, true);
  });
});
