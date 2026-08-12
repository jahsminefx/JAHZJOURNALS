const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAvailablePromotions,
  getMyRedeemedPromotions,
  getPromotionDetails,
  redeemPromotionById,
  redeemPromotionByCode
} = require('../controllers/traderPromotionController');

// All trader promotion routes require authentication
router.use(protect);

router.get('/available', getAvailablePromotions);
router.get('/my-redemptions', getMyRedeemedPromotions);
router.post('/redeem-code', redeemPromotionByCode);
router.get('/:id', getPromotionDetails);
router.post('/:id/redeem', redeemPromotionById);

module.exports = router;
