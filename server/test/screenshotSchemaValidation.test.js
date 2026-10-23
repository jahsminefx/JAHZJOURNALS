const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ImageTradeCaptureSchema,
  normalizeVisionTradeResponse,
  parseTradeFromImage,
} = require('../src/services/aiTradeCaptureService');
const { cleanJsonContent, validateStructuredOutput } = require('../src/ai/utils/validateStructuredOutput');
const { OUTCOMES, EVIDENCE_SOURCES, EVIDENCE_STATUS } = require('../src/services/tradeClassificationService');

describe('JAHZJOURNALS — Vision AI Screenshot Extraction & Schema Validation Regression Suite', () => {

  describe('1. Outermost Envelope & Code-Fence Stripping (cleanJsonContent)', () => {
    it('1.1. Cleans standard markdown ```json code fences', () => {
      const raw = '```json\n{\n  "instrument": "BTCUSD",\n  "grossProfit": 2.25\n}\n```';
      const cleaned = cleanJsonContent(raw);
      const parsed = JSON.parse(cleaned);
      assert.equal(parsed.instrument, 'BTCUSD');
      assert.equal(parsed.grossProfit, 2.25);
    });

    it('1.2. Extracts JSON when accompanied by conversational prefix or suffix text', () => {
      const raw = 'Certainly! Here is the extracted trade ticket:\n\n{\n  "instrument": "EURUSD",\n  "volume": 0.5\n}\n\nHope this helps!';
      const cleaned = cleanJsonContent(raw);
      const parsed = JSON.parse(cleaned);
      assert.equal(parsed.instrument, 'EURUSD');
      assert.equal(parsed.volume, 0.5);
    });
  });

  describe('2. Response Normalization & Envelope Unwrapping (normalizeVisionTradeResponse)', () => {
    it('2.1. Unwraps nested { trade: { ... } } envelope seamlessly', () => {
      const payload = {
        screenshotType: 'BROKER_RECEIPT',
        trade: {
          symbol: 'BTCUSD',
          type: 'BUY',
          openPrice: 82351.75,
          closePrice: 82361.97,
          size: 0.22,
          profit: 2.25,
          commission: -0.66,
          swap: 0.00,
        },
      };

      const normalized = normalizeVisionTradeResponse(payload);
      assert.equal(normalized.instrument, 'BTCUSD');
      assert.equal(normalized.direction, 'BUY');
      assert.equal(normalized.entryPrice, 82351.75);
      assert.equal(normalized.exitPrice, 82361.97);
      assert.equal(normalized.volume, 0.22);
      assert.equal(normalized.grossProfit, 2.25);
      assert.equal(normalized.commission, -0.66);
      assert.equal(normalized.swap, 0.00);
      assert.equal(normalized.screenshotType, 'BROKER_RECEIPT');
    });

    it('2.2. Unwraps nested { trades: [ { ... } ] } array envelope and records detected count', () => {
      const payload = {
        trades: [
          { symbol: 'XAUUSD', type: 'SELL', lots: 1.0, profit: 500.0 },
          { symbol: 'GBPUSD', type: 'BUY', lots: 0.5, profit: 150.0 },
        ],
      };

      const normalized = normalizeVisionTradeResponse(payload);
      assert.equal(normalized.instrument, 'XAUUSD');
      assert.equal(normalized.direction, 'SELL');
      assert.equal(normalized.volume, 1.0);
      assert.equal(normalized.grossProfit, 500.0);
      assert.equal(normalized.detectedTradeCount, 2);
    });

    it('2.3. Maps standard broker aliases into canonical keys', () => {
      const payload = {
        ticker: 'NAS100',
        cmd: 'buy',
        contracts: 2.5,
        entry_price: 20100.0,
        exit_price: 20180.0,
        sl: 20050.0,
        tp: 20250.0,
        pnl: 200.0,
        comm: -3.0,
        orderId: '88991122',
        depositCurrency: 'USD',
      };

      const normalized = normalizeVisionTradeResponse(payload);
      assert.equal(normalized.instrument, 'NAS100');
      assert.equal(normalized.direction, 'buy');
      assert.equal(normalized.volume, 2.5);
      assert.equal(normalized.entryPrice, 20100.0);
      assert.equal(normalized.exitPrice, 20180.0);
      assert.equal(normalized.stopLoss, 20050.0);
      assert.equal(normalized.takeProfit, 20250.0);
      assert.equal(normalized.grossProfit, 200.0);
      assert.equal(normalized.commission, -3.0);
      assert.equal(normalized.ticket, '88991122');
      assert.equal(normalized.accountCurrency, 'USD');
    });
  });

  describe('3. Canonical Schema Validation (ImageTradeCaptureSchema)', () => {
    it('3.1. Validates standard canonical structured object without errors', () => {
      const structured = {
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
        fees: { value: 0.00, status: 'CONFIRMED' },
        ticket: { value: '43789391', status: 'CONFIRMED' },
        entryTime: { value: '2026-10-19T08:30:00Z', status: 'CONFIRMED' },
        exitTime: { value: '2026-10-19T14:45:00Z', status: 'CONFIRMED' },
        accountCurrency: { value: 'USD', status: 'CONFIRMED' },
        breakEvenCandidate: {
          isBreakEvenCandidate: true,
          rationale: 'Stop loss was moved above entry',
          requiresUserConfirmation: true,
          candidateEvidenceSource: 'MT_TRAILING_STOP',
        },
        confidenceScore: 0.95,
      };

      const result = ImageTradeCaptureSchema.parse(structured);
      assert.equal(result.instrument.value, 'BTCUSD');
      assert.equal(result.instrument.status, 'CONFIRMED');
      assert.equal(result.breakEvenCandidate.isBreakEvenCandidate, true);
      assert.equal(result.swap.value, 0.00);
      assert.equal(result.swap.status, 'CONFIRMED');
    });

    it('3.2. Accepts plain flat primitives and coerces to { value, status: "CONFIRMED" }', () => {
      const flat = {
        screenshotType: 'BROKER_RECEIPT',
        instrument: 'US30',
        direction: 'SELL',
        volume: 0.1,
        entryPrice: 43200.0,
        exitPrice: 43100.0,
        grossProfit: 100.0,
        commission: -2.0,
        swap: 0.00,
      };

      const result = ImageTradeCaptureSchema.parse(flat);
      assert.equal(result.instrument.value, 'US30');
      assert.equal(result.instrument.status, 'CONFIRMED');
      assert.equal(result.direction.value, 'SELL');
      assert.equal(result.volume.value, 0.1);
      assert.equal(result.grossProfit.value, 100.0);
      assert.equal(result.swap.value, 0.00);
      assert.equal(result.swap.status, 'CONFIRMED', 'Explicit 0.00 must not be treated as MISSING');
      assert.equal(result.timeframe.value, null);
      assert.equal(result.timeframe.status, 'MISSING', 'Omitted timeframe must default to MISSING');
    });

    it('3.3. Missing optional fields do NOT cause a validation error', () => {
      // Minimal object with only instrument and grossProfit
      const minimal = {
        instrument: 'EURUSD',
        grossProfit: 50.0,
      };

      const result = ImageTradeCaptureSchema.parse(minimal);
      assert.equal(result.instrument.value, 'EURUSD');
      assert.equal(result.grossProfit.value, 50.0);
      assert.equal(result.direction.value, null);
      assert.equal(result.direction.status, 'MISSING');
      assert.equal(result.brokerName.value, null);
      assert.equal(result.brokerName.status, 'MISSING');
      assert.equal(result.accountCurrency.value, null);
      assert.equal(result.accountCurrency.status, 'MISSING');
      assert.equal(result.breakEvenCandidate.isBreakEvenCandidate, false);
    });

    it('3.4. Completely empty object {} validates cleanly with all fields set to MISSING', () => {
      const result = ImageTradeCaptureSchema.parse({});
      assert.equal(result.screenshotType, 'UNKNOWN');
      assert.equal(result.instrument.value, null);
      assert.equal(result.instrument.status, 'MISSING');
      assert.equal(result.grossProfit.value, null);
      assert.equal(result.grossProfit.status, 'MISSING');
      assert.equal(result.breakEvenCandidate.isBreakEvenCandidate, false);
      assert.equal(result.confidenceScore, 0.5);
    });

    it('3.5. Preserves explicit zero values for swap, commission, and fees', () => {
      const withZeros = {
        instrument: 'GBPUSD',
        swap: 0.0,
        commission: 0.0,
        fees: 0.0,
      };

      const result = ImageTradeCaptureSchema.parse(withZeros);
      assert.equal(result.swap.value, 0.0);
      assert.equal(result.swap.status, 'CONFIRMED');
      assert.equal(result.commission.value, 0.0);
      assert.equal(result.commission.status, 'CONFIRMED');
      assert.equal(result.fees.value, 0.0);
      assert.equal(result.fees.status, 'CONFIRMED');
    });
  });

  describe('4. Full Vision Extraction Pipeline (parseTradeFromImage)', () => {
    it('4.1. Successfully parses model response wrapped in { trade: { ... } } without throwing', async () => {
      const mockExtraction = {
        trade: {
          symbol: 'BTCUSD',
          type: 'buy',
          lots: 0.22,
          openPrice: 82351.75,
          closePrice: 82361.97,
          sl: 82370.08,
          tp: 83174.00,
          profit: 2.25,
          comm: -0.66,
          swap: 0.00,
          ticket: '43789391',
        },
      };

      const result = await parseTradeFromImage({
        mockExtraction,
        userAccounts: [{ id: 'acc_1', name: 'Personal Alpha', currency: 'USD' }],
      });

      assert.ok(result);
      assert.equal(result.candidateTrade.pair, 'BTCUSD');
      assert.equal(result.candidateTrade.direction, 'BUY');
      assert.equal(result.candidateTrade.lotSize, 0.22);
      assert.equal(result.candidateTrade.entryPrice, 82351.75);
      assert.equal(result.candidateTrade.exitPrice, 82361.97);
      assert.equal(result.candidateTrade.stopLoss, 82370.08);
      assert.equal(result.candidateTrade.grossProfit, 2.25);
      assert.equal(result.candidateTrade.commission, -0.66);
      assert.equal(result.candidateTrade.swap, 0.00);
      // Net profit = 2.25 - 0.66 = 1.59
      assert.equal(result.candidateTrade.profitLossAmount, 1.59);
      // Since SL is placed at 82370.08 (> entry 82351.75 on a BUY), stop is past entry -> BE protected
      assert.equal(result.candidateTrade.breakEvenActivated, true);
      assert.equal(result.candidateTrade.result, OUTCOMES.WIN, 'With default 0.00 tolerance, +1.59 net is WIN with BE protection');
      assert.equal(result.fieldStatuses.instrument, 'CONFIRMED');
      assert.equal(result.fieldStatuses.entryPrice, 'CONFIRMED');
      assert.equal(result.fieldStatuses.exitPrice, 'CONFIRMED');
      assert.equal(result.fieldStatuses.commission, 'CONFIRMED');
      assert.equal(result.fieldStatuses.swap, 'CONFIRMED');
    });

    it('4.2. Successfully parses partial screenshot with missing optional metadata', async () => {
      // Partial screenshot: visible symbol, direction, entry, grossProfit, but NO exitPrice, NO timeframe, NO currency
      const mockExtraction = {
        screenshotType: 'OPEN_POSITION',
        instrument: 'XAUUSD',
        direction: 'BUY',
        entryPrice: 2740.50,
        volume: 0.5,
        grossProfit: 120.0, // floating pnl
      };

      const result = await parseTradeFromImage({
        mockExtraction,
        userAccounts: [{ id: 'acc_1', name: 'Personal Alpha', currency: 'USD' }],
      });

      assert.ok(result);
      assert.equal(result.candidateTrade.pair, 'XAUUSD');
      assert.equal(result.candidateTrade.direction, 'BUY');
      assert.equal(result.candidateTrade.status, 'ACTIVE');
      assert.equal(result.candidateTrade.result, OUTCOMES.OPEN);
      assert.equal(result.candidateTrade.exitPrice, null);
      assert.equal(result.candidateTrade.profitLossAmount, null, 'Active trade must not record realized profit');
      assert.equal(result.fieldStatuses.exitPrice, 'MISSING');
      assert.equal(result.fieldStatuses.brokerName, 'MISSING');
    });
  });

  describe('5. validateStructuredOutput Error Handling & Retries', () => {
    it('5.1. Repaired JSON through cleanJsonContent when model includes extra markdown', async () => {
      const mockProvider = {
        generateStructuredJSON: async () => ({
          content: '```json\n{\n  "instrument": "USDJPY",\n  "grossProfit": 45.0\n}\n```',
          model: 'gpt-4o',
          provider: 'test',
        }),
      };

      const result = await validateStructuredOutput(
        mockProvider,
        'system prompt',
        'user prompt',
        ImageTradeCaptureSchema,
        1,
        true
      );

      assert.equal(result.success, true);
      assert.equal(result.data.instrument.value, 'USDJPY');
      assert.equal(result.data.grossProfit.value, 45.0);
    });

    it('5.2. Gracefully returns success: false on completely invalid unparseable non-JSON text', async () => {
      const mockProvider = {
        generateStructuredJSON: async () => ({
          content: 'I cannot process this image because it is blurry.',
          model: 'gpt-4o',
          provider: 'test',
        }),
      };

      const result = await validateStructuredOutput(
        mockProvider,
        'system prompt',
        'user prompt',
        ImageTradeCaptureSchema,
        1,
        true
      );

      assert.equal(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('6. Controller Error Handling & Safe User Diagnostics (handleChatTradeCapture)', () => {
    const { handleChatTradeCapture } = require('../src/controllers/aiTradeCaptureController');

    it('6.1. Returns friendly user error message and safe correlation ID on image extraction failure', async () => {
      const mockFile = {
        buffer: Buffer.from('corrupted'),
        mimetype: 'image/png',
        originalname: 'corrupt.png',
        size: 50,
        // Mock extraction that throws an error
        mockExtraction: null,
      };

      let statusCode = 200;
      let body = null;
      const fakeRes = {
        status: (code) => { statusCode = code; return fakeRes; },
        json: (data) => { body = data; return fakeRes; },
      };

      const fakeReq = {
        user: { id: 'dummy-user-id' },
        files: [mockFile],
        body: {},
        protocol: 'http',
        get: () => 'localhost:5000',
      };

      // Force an extraction error by mocking bad input
      await handleChatTradeCapture(fakeReq, fakeRes);

      assert.equal(statusCode, 422);
      assert.equal(body.success, false);
      assert.equal(body.canRetry, true);
      assert.equal(body.canManualEntry, true);
      assert.ok(body.correlationId.startsWith('ai_err_'));
      assert.equal(
        body.message,
        "We couldn't read this screenshot correctly. Your image has not been saved as a trade. Please try again or enter the trade details manually."
      );
    });
  });
});
