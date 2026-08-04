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
const csvUpload = require('../middleware/csvUploadMiddleware');
const screenshotRoutes = require('./screenshotRoutes');
const { preTradeCheck } = require('../controllers/preTradeController');

router.post('/pre-trade-check', protect, preTradeCheck);

router.route('/')
  .get(protect, getTrades)
  .post(protect, createTrade);

router.get('/export-csv', protect, exportTradesCsv);
router.post('/import', protect, csvUpload.single('file'), importTrades);

router.route('/:id')
  .get(protect, getTradeById)
  .put(protect, updateTrade)
  .delete(protect, deleteTrade);

router.put('/:id/review', protect, updateTradeReview);

router.use('/:tradeId/screenshots', screenshotRoutes);

module.exports = router;
