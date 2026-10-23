const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateTradeSimilarity,
  detectBatchDuplicates,
  getIdempotentResult,
  setIdempotentResult,
} = require('../src/services/tradeDuplicateDetectionService');

describe('Trade Duplicate Detection Service Suite', () => {
  it('1. Exact ticket match returns 100 score immediately', () => {
    const candidate = { externalId: '987654321', pair: 'EURUSD', direction: 'BUY' };
    const existing = { externalId: '987654321', pair: 'EURUSD', direction: 'BUY' };

    const result = calculateTradeSimilarity(candidate, existing);
    assert.equal(result.score, 100);
    assert.equal(result.isExactTicketMatch, true);
  });

  it('2. Different ticket IDs mean distinct trades (score 0)', () => {
    const candidate = { externalId: '11111', pair: 'EURUSD', direction: 'BUY', entryPrice: 1.0850 };
    const existing = { externalId: '22222', pair: 'EURUSD', direction: 'BUY', entryPrice: 1.0850 };

    const result = calculateTradeSimilarity(candidate, existing);
    assert.equal(result.score, 0);
    assert.equal(result.isExactTicketMatch, false);
  });

  it('3. High similarity match based on instrument, prices, timestamp, volume, and PnL', () => {
    const now = new Date();
    const candidate = {
      pair: 'BTCUSD',
      direction: 'BUY',
      entryPrice: 82351.75,
      exitPrice: 82361.97,
      lotSize: 0.22,
      profitLossAmount: 1.59,
      entryTime: now.toISOString(),
    };

    const existing = {
      pair: 'BTCUSD',
      direction: 'BUY',
      entryPrice: 82352.00, // within 0.0003%
      exitPrice: 82362.00, // within 0.0003%
      lotSize: 0.22,
      profitLossAmount: 1.59,
      entryTime: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 mins earlier
    };

    const result = calculateTradeSimilarity(candidate, existing);
    assert.ok(result.score >= 75, `Expected score >= 75 for near-identical trade, got ${result.score}`);
  });

  it('4. Different instruments or directions do not trigger duplicates', () => {
    const candidate = { pair: 'GBPUSD', direction: 'BUY', entryPrice: 1.2650 };
    const existing = { pair: 'EURUSD', direction: 'BUY', entryPrice: 1.2650 };

    const result = calculateTradeSimilarity(candidate, existing);
    assert.equal(result.score, 0);

    const diffDir = calculateTradeSimilarity(
      { pair: 'GBPUSD', direction: 'BUY' },
      { pair: 'GBPUSD', direction: 'SELL' }
    );
    assert.equal(diffDir.score, 0);
  });

  it('5. Detects duplicates within an uploaded batch', () => {
    const candidateA = { pair: 'XAUUSD', direction: 'BUY', entryPrice: 2740.50, exitPrice: 2750.00, externalId: '1001' };
    const candidateB = { pair: 'EURUSD', direction: 'SELL', entryPrice: 1.0850, exitPrice: 1.0820, externalId: '1002' };
    const candidateC = { pair: 'XAUUSD', direction: 'BUY', entryPrice: 2740.50, exitPrice: 2750.00, externalId: '1001' }; // duplicate of A

    const batch = detectBatchDuplicates([candidateA, candidateB, candidateC]);
    assert.equal(batch[0].isDuplicateInBatch, false);
    assert.equal(batch[1].isDuplicateInBatch, false);
    assert.equal(batch[2].isDuplicateInBatch, true);
    assert.equal(batch[2].duplicateWithIndex, 0);
  });

  it('6. Idempotency key stores and retrieves results to prevent double-submitting', async () => {
    const key = 'test_req_key_123';
    const mockRes = { success: true, savedCount: 1 };

    assert.equal(await getIdempotentResult(key), null);
    await setIdempotentResult(key, mockRes);
    assert.deepEqual(await getIdempotentResult(key), mockRes);
  });
});
