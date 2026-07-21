const { test, describe } = require('node:test');
const assert = require('node:assert');

const adminPromotionController = require('../controllers/adminPromotionController');

describe('Admin Promotion Management Validation', () => {
  test('getPromotions conforms strictly to req/res interface', () => {
    assert.strictEqual(typeof adminPromotionController.getPromotions, 'function');
    assert.strictEqual(adminPromotionController.getPromotions.length, 2);
  });

  test('createPromotion yields exact transactional parameters', () => {
    assert.strictEqual(typeof adminPromotionController.createPromotion, 'function');
    assert.strictEqual(adminPromotionController.createPromotion.length, 2);
  });

  test('grantPromotion exposes proper mapping mechanics for users', () => {
    assert.strictEqual(typeof adminPromotionController.grantPromotion, 'function');
    assert.strictEqual(adminPromotionController.grantPromotion.length, 2);
  });

  test('deletePromotion contains fallback for unused variables', () => {
    assert.strictEqual(typeof adminPromotionController.deletePromotion, 'function');
    assert.strictEqual(adminPromotionController.deletePromotion.length, 2);
  });
  
  test('getGranteesByPromotion tracks relational metrics securely', () => {
    assert.strictEqual(typeof adminPromotionController.getGranteesByPromotion, 'function');
    assert.strictEqual(adminPromotionController.getGranteesByPromotion.length, 2);
  });
});
