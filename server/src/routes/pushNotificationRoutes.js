const express = require('express');
const router = express.Router();
const pushNotificationController = require('../controllers/pushNotificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Public route to fetch VAPID public key
router.get('/public-key', pushNotificationController.getPublicKey);

// Protected routes for logged-in traders
router.post('/subscribe', protect, pushNotificationController.subscribe);
router.post('/unsubscribe', protect, pushNotificationController.unsubscribe);
router.post('/send-test', protect, pushNotificationController.sendTest);

// Admin-only route to manually trigger daily reminder broadcast
router.post('/trigger-daily-reminders', protect, authorize('SUPER_ADMIN', 'ADMIN'), pushNotificationController.triggerDailyReminders);

module.exports = router;
