const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireProFeature } = require('../middleware/subscriptionGate');
const upload = require('../middleware/uploadMiddleware');
const { aiFeaturesLimiter } = require('../middleware/rateLimitMiddleware');
const {
  handleChatTradeCapture,
  handleScreenshotTradeCapture,
  handleCheckDuplicate,
  handleConfirmSave,
  handleJournalAssist,
} = require('../controllers/aiTradeCaptureController');

// All AI trade capture endpoints require authentication and an active Pro or Mentor subscription
router.use(protect, requireProFeature('ai_trade_capture'));

router.post('/chat', aiFeaturesLimiter, upload.array('images', 10), handleChatTradeCapture);
router.post('/upload-screenshot', aiFeaturesLimiter, upload.array('images', 10), handleScreenshotTradeCapture);
router.post('/check-duplicate', handleCheckDuplicate);
router.post('/confirm-save', handleConfirmSave);
router.post('/journal-assist', aiFeaturesLimiter, handleJournalAssist);

module.exports = router;
