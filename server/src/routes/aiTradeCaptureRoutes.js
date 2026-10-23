const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { aiFeaturesLimiter } = require('../middleware/rateLimitMiddleware');
const {
  handleChatTradeCapture,
  handleScreenshotTradeCapture,
  handleCheckDuplicate,
  handleConfirmSave,
  handleJournalAssist,
} = require('../controllers/aiTradeCaptureController');

router.post('/chat', protect, aiFeaturesLimiter, upload.array('images', 10), handleChatTradeCapture);
router.post('/upload-screenshot', protect, aiFeaturesLimiter, upload.array('images', 10), handleScreenshotTradeCapture);
router.post('/check-duplicate', protect, handleCheckDuplicate);
router.post('/confirm-save', protect, handleConfirmSave);
router.post('/journal-assist', protect, aiFeaturesLimiter, handleJournalAssist);

module.exports = router;
