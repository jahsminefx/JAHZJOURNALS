const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  editPhase,
  removePhase,
} = require('../controllers/propFirmAccountController');

router.route('/:phaseId')
  .put(protect, editPhase)
  .delete(protect, removePhase);

module.exports = router;
