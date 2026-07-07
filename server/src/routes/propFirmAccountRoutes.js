const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createPropFirm,
  getPropFirm,
  updatePropFirm,
  removePropFirm,
  addPhase,
  getProgress,
  addProgressSnapshot,
} = require('../controllers/propFirmAccountController');

router.route('/')
  .post(protect, createPropFirm);

router.route('/:id')
  .get(protect, getPropFirm)
  .put(protect, updatePropFirm)
  .delete(protect, removePropFirm);

router.route('/:id/phases')
  .post(protect, addPhase);

router.route('/:id/progress')
  .get(protect, getProgress);

router.route('/:id/progress-snapshots')
  .post(protect, addProgressSnapshot);

module.exports = router;
