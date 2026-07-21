const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getStrategies,
  getStrategyById,
  createStrategy,
  updateStrategy,
  deleteStrategy
} = require('../controllers/strategyController');

router.use(protect);

router.route('/')
  .get(getStrategies)
  .post(createStrategy);

router.route('/:id')
  .get(getStrategyById)
  .put(updateStrategy)
  .delete(deleteStrategy);

module.exports = router;
