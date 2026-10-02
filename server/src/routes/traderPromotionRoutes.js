const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getPublicActivePromotion,
  getAvailablePromotions,
  getMyRedeemedPromotions,
  getPromotionDetails,
  redeemPromotionById,
  redeemPromotionByCode
} = require('../controllers/traderPromotionController');

// Public route for Pricing and Landing pages (no authentication required)
router.get('/public-active', getPublicActivePromotion);

// All other trader promotion routes require authentication
router.use(protect);

router.get('/available', getAvailablePromotions);
router.get('/my-redemptions', getMyRedeemedPromotions);
router.post('/redeem-code', redeemPromotionByCode);
router.get('/:id', getPromotionDetails);
router.post('/:id/redeem', redeemPromotionById);

module.exports = router;
