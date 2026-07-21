const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const {
  getDashboardAnalytics,
  getPerformanceAnalytics,
  getSummaryAnalytics,
  getEquityCurve,
  getDrawdown,
  getRiskReward,
} = require('../controllers/analyticsController');
const { deleteScreenshot } = require('../controllers/screenshotController');
const {
  createContactMessage,
} = require('../controllers/contactController');
const {
  getWeeklyReviews,
  generateWeeklyReview,
  getWeeklyReviewById,
  updateWeeklyReview,
} = require('../controllers/weeklyReviewController');
const {
  getRules,
  createRule,
  createRulesBulk,
  getRuleById,
  updateRule,
  updateRuleStatus,
  deleteRule,
  logEmotion,
  updateEmotion,
  deleteEmotion,
  logViolation,
  updateViolation,
  deleteViolation,
  createAiTradeReview,
  getAiTradeReview,
  createUserFeedback,
} = require('../controllers/miscController');

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many contact submissions. Please try again later.' },
});

router.get('/rules', protect, getRules);
router.post('/rules', protect, createRule);
router.post('/rules/bulk', protect, createRulesBulk);
router.get('/rules/:id', protect, getRuleById);
router.put('/rules/:id', protect, updateRule);
router.delete('/rules/:id', protect, deleteRule);
router.patch('/rules/:id/status', protect, updateRuleStatus);

router.post('/trades/:id/emotions', protect, logEmotion);
router.put('/emotions/:id', protect, updateEmotion);
router.delete('/emotions/:id', protect, deleteEmotion);

router.post('/trades/:id/violations', protect, logViolation);
router.put('/violations/:id', protect, updateViolation);
router.delete('/violations/:id', protect, deleteViolation);

router.delete('/screenshots/:id', protect, deleteScreenshot);

router.get('/analytics/dashboard', protect, getDashboardAnalytics);
router.get('/analytics/performance', protect, getPerformanceAnalytics);
router.get('/analytics/summary', protect, getSummaryAnalytics);
router.get('/analytics/equity-curve', protect, getEquityCurve);
router.get('/analytics/drawdown', protect, getDrawdown);
router.get('/analytics/risk-reward', protect, getRiskReward);

router.get('/weekly-reviews', protect, getWeeklyReviews);
router.post('/weekly-reviews/generate', protect, generateWeeklyReview);
router.get('/weekly-reviews/:id', protect, getWeeklyReviewById);
router.put('/weekly-reviews/:id', protect, updateWeeklyReview);

router.post('/contact-messages', contactLimiter, optionalProtect, createContactMessage);

router.post('/automated/trades/:id/review', protect, createAiTradeReview);
router.get('/automated/trades/:tradeId/review', protect, getAiTradeReview);
router.post('/ai/trades/:id/review', protect, createAiTradeReview);
router.get('/ai/trades/:tradeId/review', protect, getAiTradeReview);

// Phase 10: Pre-Beta Hardening Native Feedback Hooks
router.post('/feedback', protect, createUserFeedback);

router.get('/admin/dashboard', protect, (req, res) => res.json({ status: 'admin panel' }));
router.get('/mentor/dashboard', protect, (req, res) => res.json({ status: 'mentor panel' }));
router.get('/reports', protect, (req, res) => res.json([]));

module.exports = router;
