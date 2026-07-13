const express = require('express');
const router = express.Router();
const {
  getTrades,
  createTrade,
  getTradeById,
  updateTrade,
  deleteTrade,
  updateTradeReview,
  exportTradesCsv,
} = require('../controllers/tradeController');
const { importTrades } = require('../controllers/importController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const screenshotRoutes = require('./screenshotRoutes');

router.route('/')
  .get(protect, getTrades)
  .post(protect, createTrade);

router.get('/export-csv', protect, exportTradesCsv);
router.post('/import', protect, upload.single('file'), importTrades);

router.route('/:id')
  .get(protect, getTradeById)
  .put(protect, updateTrade)
  .delete(protect, deleteTrade);

router.put('/:id/review', protect, updateTradeReview);

router.use('/:tradeId/screenshots', screenshotRoutes);

module.exports = router;
