const { test, describe } = require('node:test');
const assert = require('node:assert');

// We test that the controller functions exist and have the correct arity
const adminSubscriptionController = require('../controllers/adminSubscriptionController');

describe('Admin Subscription Management Tests', () => {
  test('getSubscriptions exists and accepts (req, res)', () => {
    assert.strictEqual(typeof adminSubscriptionController.getSubscriptions, 'function');
    assert.strictEqual(adminSubscriptionController.getSubscriptions.length, 2);
  });

  test('getSubscriptionMetrics exists and accepts (req, res)', () => {
    assert.strictEqual(typeof adminSubscriptionController.getSubscriptionMetrics, 'function');
    assert.strictEqual(adminSubscriptionController.getSubscriptionMetrics.length, 2);
  });

  test('getSubscriptionDetails exists and accepts (req, res)', () => {
    assert.strictEqual(typeof adminSubscriptionController.getSubscriptionDetails, 'function');
    assert.strictEqual(adminSubscriptionController.getSubscriptionDetails.length, 2);
  });

  test('updateSubscription exists and accepts (req, res)', () => {
    assert.strictEqual(typeof adminSubscriptionController.updateSubscription, 'function');
    assert.strictEqual(adminSubscriptionController.updateSubscription.length, 2);
  });
  
  test('Audit Log service is structurally sound', () => {
    const auditService = require('../services/auditService');
    assert.strictEqual(typeof auditService.logAudit, 'function');
  });
});
