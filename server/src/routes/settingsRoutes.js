const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateTradingPreferences,
  updateRiskSettings,
  updateJournalPreferences,
  updateNotifications,
  updateAppearance,
  updateDataPrivacy,
} = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getSettings);
router.put('/trading', updateTradingPreferences);
router.put('/risk', updateRiskSettings);
router.put('/journal', updateJournalPreferences);
router.put('/notifications', updateNotifications);
router.put('/appearance', updateAppearance);
router.put('/data-privacy', updateDataPrivacy);

module.exports = router;
