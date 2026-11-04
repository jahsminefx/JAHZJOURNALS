const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCalendarEvents,
  getUpcomingEvents,
  checkTradeNews,
  getAlertPreferences,
  updateAlertPreferences,
  toggleAlerts,
  getAlertHistory,
  getSupportedPairs,
  getSupportedCurrencies,
} = require('../controllers/calendarController');

// All calendar endpoints require authenticated user
router.get('/', protect, getCalendarEvents);
router.get('/upcoming', protect, getUpcomingEvents);
router.post('/check-trade-news', protect, checkTradeNews);

// Personal Economic News Alert Endpoints (V1.1)
router.get('/alerts/preferences', protect, getAlertPreferences);
router.put('/alerts/preferences', protect, updateAlertPreferences);
router.patch('/alerts/toggle', protect, toggleAlerts);
router.get('/alerts/history', protect, getAlertHistory);
router.get('/alerts/supported-pairs', protect, getSupportedPairs);
router.get('/alerts/supported-currencies', protect, getSupportedCurrencies);

module.exports = router;
