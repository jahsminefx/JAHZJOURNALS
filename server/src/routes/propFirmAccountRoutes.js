const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireProFeature, checkAccountLimit } = require('../middleware/subscriptionGate');
const {
  createPropFirm,
  getPropFirm,
  updatePropFirm,
  updatePropFirmAdvancedSettings,
  removePropFirm,
  addPhase,
  getProgress,
  addProgressSnapshot,
  getCompliance,
  advancePhase,
  evaluateTradeRisk,
  getPayouts,
  createPayout,
  updatePayoutStatus,
} = require('../controllers/propFirmAccountController');

// All prop firm routes require authentication
router.use(protect);

// Basic Account Creation & CRUD are allowed within plan account limits
router.route('/')
  .post(checkAccountLimit, createPropFirm);

router.route('/:id')
  .get(getPropFirm)
  .put(updatePropFirm)
  .delete(removePropFirm);

// Advanced evaluation tracking, compliance engine, risk guard, and payouts are strictly Pro features
router.route('/:id/compliance')
  .get(requireProFeature('prop_firm'), getCompliance);

router.route('/:id/advance-phase')
  .post(requireProFeature('prop_firm'), advancePhase);

router.route('/:id/risk-guard')
  .post(requireProFeature('prop_firm'), evaluateTradeRisk);

router.route('/:id/payouts')
  .get(requireProFeature('prop_firm'), getPayouts)
  .post(requireProFeature('prop_firm'), createPayout);

router.route('/:id/payouts/:payoutId')
  .put(requireProFeature('prop_firm'), updatePayoutStatus);

router.route('/:id/advanced-settings')
  .put(updatePropFirmAdvancedSettings);

router.route('/:id/phases')
  .post(addPhase);

router.route('/:id/progress')
  .get(requireProFeature('prop_firm'), getProgress);

router.route('/:id/progress-snapshots')
  .post(requireProFeature('prop_firm'), addProgressSnapshot);

module.exports = router;
