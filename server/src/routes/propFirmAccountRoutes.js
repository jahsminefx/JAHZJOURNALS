const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireProFeature } = require('../middleware/subscriptionGate');
const {
  createPropFirm,
  getPropFirm,
  updatePropFirm,
  updatePropFirmAdvancedSettings,
  removePropFirm,
  addPhase,
  getProgress,
  addProgressSnapshot,
} = require('../controllers/propFirmAccountController');

router.route('/')
  .post(protect, requireProFeature('prop_firm'), createPropFirm);

router.route('/:id')
  .get(protect, getPropFirm)
  .put(protect, updatePropFirm)
  .delete(protect, removePropFirm);

router.route('/:id/advanced-settings')
  .put(protect, updatePropFirmAdvancedSettings);

router.route('/:id/phases')
  .post(protect, addPhase);

router.route('/:id/progress')
  .get(protect, getProgress);

router.route('/:id/progress-snapshots')
  .post(protect, addProgressSnapshot);

module.exports = router;
