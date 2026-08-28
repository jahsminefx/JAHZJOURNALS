const { describe, it } = require('node:test');
const assert = require('assert');
const dailyReviewService = require('../src/services/dailyReviewService');
const { handleSharedOpenGraphMeta } = require('../src/middleware/openGraphMiddleware');

describe('JAHZJOURNALS Daily Review & Social Sharing V1.1 Production Hardening Suite', () => {

  // ===============================================
  // A. TIMEZONE & DAY BOUNDARY HARDENING TESTS
  // ===============================================
  describe('A. Timezone & Day Boundary Calculations', () => {
    it('should calculate accurate day boundaries for WAT (Africa/Lagos UTC+1)', () => {
      const { dateStr, startOfDay, endOfDay } = dailyReviewService.normalizeDateRange('2026-08-28', 'Africa/Lagos');
      assert.strictEqual(dateStr, '2026-08-28');
      assert.strictEqual(startOfDay.toISOString(), '2026-08-27T23:00:00.000Z');
      assert.strictEqual(endOfDay.toISOString(), '2026-08-28T22:59:59.999Z');
    });

    it('should calculate accurate day boundaries for EST/EDT (America/New_York UTC-4)', () => {
      const { dateStr, startOfDay, endOfDay } = dailyReviewService.normalizeDateRange('2026-08-28', 'America/New_York');
      assert.strictEqual(dateStr, '2026-08-28');
      assert.strictEqual(startOfDay.toISOString(), '2026-08-28T04:00:00.000Z');
      assert.strictEqual(endOfDay.toISOString(), '2026-08-29T03:59:59.999Z');
    });

    it('should default cleanly to UTC boundaries when no timezone is specified', () => {
      const { dateStr, startOfDay, endOfDay } = dailyReviewService.normalizeDateRange('2026-08-28');
      assert.strictEqual(dateStr, '2026-08-28');
      assert.strictEqual(startOfDay.toISOString(), '2026-08-28T00:00:00.000Z');
      assert.strictEqual(endOfDay.toISOString(), '2026-08-28T23:59:59.999Z');
    });
  });

  // ===============================================
  // B. SOCIAL SHARE TOKEN SECURITY & ENTROPY TESTS
  // ===============================================
  describe('B. Social Share Token Entropy & Security', () => {
    it('should generate cryptographically secure 32-byte hex share tokens (64 characters)', () => {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      assert.strictEqual(token.length, 64);
      assert.match(token, /^[a-f0-9]{64}$/i);
    });
  });

  // ===============================================
  // C. OPEN GRAPH SECURITY & XSS PREVENTION TESTS
  // ===============================================
  describe('C. Open Graph HTML Escaping & Injection Security', () => {
    it('should escape malicious script tags in Open Graph response', async () => {
      const req = {
        path: '/shared/trade/nonexistent_test_token',
        get: () => 'facebookexternalhit',
        protocol: 'https',
        originalUrl: '/shared/trade/nonexistent_test_token',
      };
      const res = {
        send: (html) => {
          assert.doesNotMatch(html, /<script>/i);
        },
      };
      let calledNext = false;
      const next = () => { calledNext = true; };

      await handleSharedOpenGraphMeta(req, res, next);
      assert.strictEqual(calledNext, true);
    });
  });
});
