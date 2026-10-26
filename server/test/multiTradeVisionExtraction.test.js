const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTradeFromImage,
  processSingleExtractedTrade,
  SingleTradeCaptureSchema,
} = require('../src/services/aiTradeCaptureService');

describe('JAHZJOURNALS — Multi-Trade Vision Extraction & Anti-Hallucination Suite', () => {
  describe('1. Multi-trade parsing from single image response', () => {
    it('1.1. Successfully parses 3 trades from a single MT5 history screenshot response', async () => {
      // Mock openRouterCompletion returning 3 trades like in user's MT5 history screenshot:
      // Trade 1: #43037693 BUY 0.20 BTCUSD 83529.61 -> 83455.91, SL 83466.13, TP 83930.81, Profit -14.74, Comm -0.60
      // Trade 2: #43052666 BUY 0.22 BTCUSD 83469.67 -> 83382.16, SL 83384.18, TP 84385.02, Profit -19.25, Comm -0.66
      // Trade 3: #43504300 BUY 0.22 BTCUSD 82070.32 -> 82068.63, SL 82072.66, TP 82616.42, Profit -0.37, Comm -0.66
      const mockModelResponse = {
        trades: [
          {
            ticket: '43037693',
            instrument: { value: 'BTCUSD', confidence: 0.98, status: 'CONFIRMED' },
            direction: { value: 'BUY', confidence: 0.99, status: 'CONFIRMED' },
            lotSize: { value: 0.20, confidence: 0.95, status: 'CONFIRMED' },
            entryPrice: { value: 83529.61, confidence: 0.99, status: 'CONFIRMED' },
            exitPrice: { value: 83455.91, confidence: 0.99, status: 'CONFIRMED' },
            stopLoss: { value: 83466.13, confidence: 0.95, status: 'CONFIRMED' },
            takeProfit: { value: 83930.81, confidence: 0.95, status: 'CONFIRMED' },
            grossProfit: { value: -14.74, confidence: 0.99, status: 'CONFIRMED' },
            commission: { value: -0.60, confidence: 0.90, status: 'CONFIRMED' },
            swap: { value: 0.0, confidence: 0.90, status: 'CONFIRMED' },
            entryTime: { value: '2026.04.14 09:12:00', confidence: 0.95, status: 'CONFIRMED' },
            exitTime: { value: '2026.04.14 09:15:30', confidence: 0.95, status: 'CONFIRMED' },
            screenshotType: 'HISTORY_LIST',
            breakEvenCandidate: {
              // Intentionally simulated hallucination from model
              isBreakEvenCandidate: true,
              rationale: 'Hallucinated break even',
              confidence: 0.9
            }
          },
          {
            ticket: '43052666',
            instrument: { value: 'BTCUSD', confidence: 0.98, status: 'CONFIRMED' },
            direction: { value: 'BUY', confidence: 0.99, status: 'CONFIRMED' },
            lotSize: { value: 0.22, confidence: 0.95, status: 'CONFIRMED' },
            entryPrice: { value: 83469.67, confidence: 0.99, status: 'CONFIRMED' },
            exitPrice: { value: 83382.16, confidence: 0.99, status: 'CONFIRMED' },
            stopLoss: { value: 83384.18, confidence: 0.95, status: 'CONFIRMED' },
            takeProfit: { value: 84385.02, confidence: 0.95, status: 'CONFIRMED' },
            grossProfit: { value: -19.25, confidence: 0.99, status: 'CONFIRMED' },
            commission: { value: -0.66, confidence: 0.90, status: 'CONFIRMED' },
            swap: { value: 0.0, confidence: 0.90, status: 'CONFIRMED' },
            entryTime: { value: '2026.04.14 10:00:00', confidence: 0.95, status: 'CONFIRMED' },
            exitTime: { value: '2026.04.14 10:05:00', confidence: 0.95, status: 'CONFIRMED' },
            screenshotType: 'HISTORY_LIST',
            breakEvenCandidate: {
              isBreakEvenCandidate: false,
              rationale: 'Stop loss was below entry',
              confidence: 0.95
            }
          },
          {
            ticket: '43504300',
            instrument: { value: 'BTCUSD', confidence: 0.98, status: 'CONFIRMED' },
            direction: { value: 'BUY', confidence: 0.99, status: 'CONFIRMED' },
            lotSize: { value: 0.22, confidence: 0.95, status: 'CONFIRMED' },
            entryPrice: { value: 82070.32, confidence: 0.99, status: 'CONFIRMED' },
            exitPrice: { value: 82068.63, confidence: 0.99, status: 'CONFIRMED' },
            stopLoss: { value: 82072.66, confidence: 0.95, status: 'CONFIRMED' }, // SL > Entry (trailed)
            takeProfit: { value: 82616.42, confidence: 0.95, status: 'CONFIRMED' },
            grossProfit: { value: -0.37, confidence: 0.99, status: 'CONFIRMED' },
            commission: { value: -0.66, confidence: 0.90, status: 'CONFIRMED' },
            swap: { value: 0.0, confidence: 0.90, status: 'CONFIRMED' },
            entryTime: { value: '2026.04.15 08:30:00', confidence: 0.95, status: 'CONFIRMED' },
            exitTime: { value: '2026.04.15 08:35:00', confidence: 0.95, status: 'CONFIRMED' },
            screenshotType: 'HISTORY_LIST',
            breakEvenCandidate: {
              isBreakEvenCandidate: true,
              rationale: 'Stop loss was trailed above entry price (82072.66 > 82070.32)',
              confidence: 0.95
            }
          }
        ]
      };

      const parsed = await parseTradeFromImage({
        imageBuffer: Buffer.from('dummy'),
        mimeType: 'image/png',
        mockExtraction: mockModelResponse,
      });

      assert.equal(parsed.isMultiTrade, true);
      assert.equal(parsed.detectedTradeCount, 3);
      assert.equal(parsed.candidateTrades.length, 3);

      // Verify Trade 1:
      const t1 = parsed.candidateTrades[0].candidateTrade;
      assert.equal(t1.externalId, '43037693');
      assert.equal(t1.status, 'CLOSED');
      assert.equal(t1.direction, 'BUY');
      assert.equal(t1.entryPrice, 83529.61);
      assert.equal(t1.exitPrice, 83455.91);
      assert.equal(t1.grossProfit, -14.74);
      assert.equal(t1.commission, -0.60);
      assert.equal(t1.profitLossAmount, -15.34);
      assert.equal(t1.result, 'LOSS');
      assert.equal(t1.session, 'LONDON', '09:12 UTC is London Session');
      assert.equal(t1.riskRewardRatio, 6.32, 'Target R:R calculated from SL and TP');
      assert.equal(t1.pips, -73.7, 'Pips accurately calculated for BTCUSD');
      // BE Anti-Hallucination check: SL 83466.13 is BELOW entry 83529.61 on a BUY trade!
      // Must NOT be marked break-even candidate despite model returning true
      assert.equal(t1.breakEvenActivated, false, 'Trade 1 must NOT be breakEvenActivated because SL was below entry');

      // Verify Trade 2:
      const t2 = parsed.candidateTrades[1].candidateTrade;
      assert.equal(t2.externalId, '43052666');
      assert.equal(t2.status, 'CLOSED');
      assert.equal(t2.profitLossAmount, -19.91);
      assert.equal(t2.result, 'LOSS');
      assert.equal(t2.breakEvenActivated, false);

      // Verify Trade 3:
      const t3 = parsed.candidateTrades[2].candidateTrade;
      assert.equal(t3.externalId, '43504300');
      assert.equal(t3.status, 'CLOSED');
      assert.equal(t3.profitLossAmount, -1.03);
      // SL 82072.66 > Entry 82070.32 on BUY -> trailed stop
      assert.equal(t3.breakEvenActivated, true, 'Trade 3 should have breakEvenActivated = true due to trailed stop');
      assert.equal(t3.result, 'LOSS', 'Financially it was net -$1.03 loss due to commission');
      assert.equal(t3.badgeLabel, 'Small loss · BE protected');
    });
  });

  describe('2. Anti-hallucination & Trade Status Guarantees', () => {
    it('2.1. Closed loss trade with missing exitPrice is never marked ACTIVE with $0 P/L', async () => {
      // Test when OCR saw grossProfit = -15.34 and exitTime, but missed exitPrice
      const rawExtracted = {
        instrument: { value: 'BTCUSD', status: 'CONFIRMED' },
        direction: { value: 'BUY', status: 'CONFIRMED' },
        lotSize: { value: 0.22, status: 'CONFIRMED' },
        entryPrice: { value: 83529.61, status: 'CONFIRMED' },
        exitPrice: { value: null, status: 'MISSING' },
        grossProfit: { value: -15.34, status: 'CONFIRMED' },
        commission: { value: -0.60, status: 'CONFIRMED' },
        exitTime: { value: '2026.04.14 09:15:30', status: 'CONFIRMED' },
        screenshotType: 'HISTORY_LIST'
      };

      const extraction = SingleTradeCaptureSchema.parse(rawExtracted);
      const res = await processSingleExtractedTrade({ extraction });
      const processed = res.candidateTrade;

      assert.equal(processed.status, 'CLOSED', 'Should be CLOSED because grossProfit & exitTime indicate realized closed trade');
      assert.equal(processed.profitLossAmount, -15.94);
      assert.equal(processed.breakEvenActivated, false);
      assert.equal(processed.result, 'LOSS');
    });

    it('2.2. SELL trade BE validation: SL above entry is NOT break even', async () => {
      // For SELL: entry 1.1000, stopLoss 1.1050 (above entry = normal loss stop)
      const rawExtracted = {
        instrument: { value: 'EURUSD', status: 'CONFIRMED' },
        direction: { value: 'SELL', status: 'CONFIRMED' },
        lotSize: { value: 1.0, status: 'CONFIRMED' },
        entryPrice: { value: 1.1000, status: 'CONFIRMED' },
        exitPrice: { value: 1.1050, status: 'CONFIRMED' },
        stopLoss: { value: 1.1050, status: 'CONFIRMED' },
        grossProfit: { value: -500.0, status: 'CONFIRMED' },
        screenshotType: 'HISTORY_LIST',
        breakEvenCandidate: {
          isBreakEvenCandidate: true, // Model hallucinates true
          rationale: 'Claimed BE'
        }
      };

      const extraction = SingleTradeCaptureSchema.parse(rawExtracted);
      const res = await processSingleExtractedTrade({ extraction });
      const processed = res.candidateTrade;

      assert.equal(processed.status, 'CLOSED');
      assert.equal(processed.breakEvenActivated, false, 'For SELL, SL > Entry cannot be BE');
      assert.equal(processed.result, 'LOSS');
    });

    it('2.3. SELL trade BE validation: SL below or at entry IS break even', async () => {
      // For SELL: entry 1.1000, stopLoss 1.0990 (below entry = trailed into profit/BE)
      const rawExtracted = {
        instrument: { value: 'EURUSD', status: 'CONFIRMED' },
        direction: { value: 'SELL', status: 'CONFIRMED' },
        lotSize: { value: 1.0, status: 'CONFIRMED' },
        entryPrice: { value: 1.1000, status: 'CONFIRMED' },
        exitPrice: { value: 1.0990, status: 'CONFIRMED' },
        stopLoss: { value: 1.0990, status: 'CONFIRMED' },
        grossProfit: { value: 100.0, status: 'CONFIRMED' },
        screenshotType: 'HISTORY_LIST'
      };

      const extraction = SingleTradeCaptureSchema.parse(rawExtracted);
      const res = await processSingleExtractedTrade({ extraction });
      const processed = res.candidateTrade;

      assert.equal(processed.status, 'CLOSED');
      assert.equal(processed.breakEvenActivated, true);
      assert.equal(processed.result, 'WIN');
      assert.equal(processed.badgeLabel, 'Win · BE protected');
    });

    it('2.4. Closed loss trade with contradictory/OCR-misread SL above entry NEVER activates BE', async () => {
      // Exact scenario from user's screenshot:
      // BUY BTCUSD: entry 83469.67, exit 83382.16, grossProfit -19.25, comm -0.66
      // Vision model OCR misread SL as 83484.18 (instead of 83384.18) and claimed isBreakEvenCandidate: true
      const rawExtracted = {
        instrument: { value: 'BTCUSD', status: 'CONFIRMED' },
        direction: { value: 'BUY', status: 'CONFIRMED' },
        lotSize: { value: 0.22, status: 'CONFIRMED' },
        entryPrice: { value: 83469.67, status: 'CONFIRMED' },
        exitPrice: { value: 83382.16, status: 'CONFIRMED' },
        stopLoss: { value: 83484.18, status: 'CONFIRMED' }, // Higher than entry!
        grossProfit: { value: -19.25, status: 'CONFIRMED' },
        commission: { value: -0.66, status: 'CONFIRMED' },
        screenshotType: 'HISTORY_LIST',
        breakEvenCandidate: {
          isBreakEvenCandidate: true,
          rationale: 'Stop was supposedly above entry'
        }
      };

      const extraction = SingleTradeCaptureSchema.parse(rawExtracted);
      const res = await processSingleExtractedTrade({ extraction });
      const processed = res.candidateTrade;

      assert.equal(processed.status, 'CLOSED');
      assert.equal(processed.result, 'LOSS');
      assert.equal(processed.profitLossAmount, -19.91);
      assert.equal(processed.breakEvenActivated, false, 'Must NOT activate BE when BUY trade closed 87 points below entry in a loss');
      assert.equal(processed.badgeLabel, 'Loss', 'Badge must simply be Loss, not Loss · BE');
    });
  });
});
