const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  generateTradeInsight, 
  generateWeeklyCoach, 
  generateEdgeFinder, 
  getAiRequestStatus,
  generateTradingPlan, 
  generateVisionInsight, 
  getVisionInsight, 
  getVisionInsightsByTrade, 
  generateJournalDraft, 
  getAiOverview,
  getJournalDraft, 
  getAiUsage, 
  clearAiHistory 
} = require('../controllers/aiController');
const { sendMessage } = require('../controllers/chatController');
const { aiFeaturesLimiter } = require('../middleware/rateLimitMiddleware');

router.get('/overview', protect, getAiOverview);
router.get('/requests/:requestId', protect, getAiRequestStatus);

router.post('/trade-insight/:tradeId', protect, aiFeaturesLimiter, generateTradeInsight);
router.post('/weekly-reviews/:reviewId/coach', protect, aiFeaturesLimiter, generateWeeklyCoach);
router.post('/edge-finder', protect, aiFeaturesLimiter, generateEdgeFinder);
router.post('/trading-plan', protect, aiFeaturesLimiter, generateTradingPlan);
router.post('/vision-analysis', protect, aiFeaturesLimiter, generateVisionInsight);
router.get('/vision-analysis/:screenshotId', protect, getVisionInsight);
router.get('/vision-insights/trade/:tradeId', protect, getVisionInsightsByTrade);
router.post('/journal-draft', protect, aiFeaturesLimiter, generateJournalDraft);
router.get('/journal-draft/:requestId', protect, getJournalDraft);
router.post('/chat', protect, aiFeaturesLimiter, sendMessage);
router.get('/usage', protect, getAiUsage);
router.delete('/usage', protect, clearAiHistory);

module.exports = router;
