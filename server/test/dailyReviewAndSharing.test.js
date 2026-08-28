const { describe, it } = require('node:test');
const assert = require('assert');
const dailyReviewService = require('../src/services/dailyReviewService');
const socialShareController = require('../src/controllers/socialShareController');
const { processDailyReview } = require('../src/jobs/processors/processDailyReview');

describe('Daily Reviews & Social Sharing Comprehensive Test Suite', () => {
  it('should export dailyReviewService with getDailyReviewSummary function', () => {
    assert.strictEqual(typeof dailyReviewService.getDailyReviewSummary, 'function');
  });

  it('should export socialShareController with sharing handlers', () => {
    assert.strictEqual(typeof socialShareController.shareTrade, 'function');
    assert.strictEqual(typeof socialShareController.getPublicSharedTrade, 'function');
    assert.strictEqual(typeof socialShareController.shareDailyReview, 'function');
    assert.strictEqual(typeof socialShareController.getPublicSharedDailyReview, 'function');
  });

  it('should export processDailyReview for BullMQ AI processing', () => {
    assert.strictEqual(typeof processDailyReview, 'function');
  });

  it('should export normalizeDateRange supporting timezone parameters', () => {
    const { dateStr, startOfDay, endOfDay } = dailyReviewService.normalizeDateRange('2026-08-28', 'Africa/Lagos');
    assert.strictEqual(dateStr, '2026-08-28');
    assert.ok(startOfDay instanceof Date);
    assert.ok(endOfDay instanceof Date);
  });
});
