const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const dailyReviewController = require('../controllers/dailyReviewController');
const socialShareController = require('../controllers/socialShareController');

// All daily review routes require authentication
router.use(protect);

router.get('/day', dailyReviewController.getDailyReviewForDay);
router.get('/ai-status/:aiRequestId', dailyReviewController.getAiReviewStatus);
router.get('/:id', dailyReviewController.getDailyReviewById);
router.post('/', dailyReviewController.saveDailyReview);
router.put('/:id', dailyReviewController.updateDailyReview);
router.post('/:id/ai-review', dailyReviewController.triggerAiDailyReview);

// Daily Review Sharing (Protected)
router.post('/:id/share', socialShareController.shareDailyReview);
router.patch('/:id/share', socialShareController.updateDailyReviewShare);
router.delete('/:id/share', socialShareController.revokeDailyReviewShare);

module.exports = router;
