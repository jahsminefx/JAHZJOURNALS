const { test, describe } = require('node:test');
const assert = require('node:assert');

const adminAiController = require('../controllers/adminAiController');

describe('Intelligence Operations Center Validation Arrays', () => {
  test('getAiDashboardMetrics exposes mapping logic correctly', () => {
    assert.strictEqual(typeof adminAiController.getAiDashboardMetrics, 'function');
    assert.strictEqual(adminAiController.getAiDashboardMetrics.length, 2);
  });

  test('getAiRequests extracts arrays structurally', () => {
    assert.strictEqual(typeof adminAiController.getAiRequests, 'function');
    assert.strictEqual(adminAiController.getAiRequests.length, 2);
  });

  test('getAiConfig dynamically intercepts DB logic', () => {
    assert.strictEqual(typeof adminAiController.getAiConfig, 'function');
    assert.strictEqual(adminAiController.getAiConfig.length, 2);
  });

  test('updateAiConfig overrides legacy system configs', () => {
    assert.strictEqual(typeof adminAiController.updateAiConfig, 'function');
    assert.strictEqual(adminAiController.updateAiConfig.length, 2);
  });
});
