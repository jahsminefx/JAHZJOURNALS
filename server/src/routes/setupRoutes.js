const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createSetup,
  updateSetup,
  deleteSetup,
  updateChecklist
} = require('../controllers/setupController');

router.use(protect);

router.route('/')
  .post(createSetup);

router.route('/:id')
  .put(updateSetup)
  .delete(deleteSetup);

router.route('/:id/checklist')
  .put(updateChecklist);

module.exports = router;
