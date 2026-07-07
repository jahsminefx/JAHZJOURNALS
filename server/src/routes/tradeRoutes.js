const express = require('express');
const router = express.Router();
const {
  getTrades,
  createTrade,
  getTradeById,
  updateTrade,
  deleteTrade
} = require('../controllers/tradeController');
const { protect } = require('../middleware/authMiddleware');
const screenshotRoutes = require('./screenshotRoutes');

router.route('/')
  .get(protect, getTrades)
  .post(protect, createTrade);

router.route('/:id')
  .get(protect, getTradeById)
  .put(protect, updateTrade)
  .delete(protect, deleteTrade);

router.use('/:tradeId/screenshots', screenshotRoutes);

module.exports = router;
