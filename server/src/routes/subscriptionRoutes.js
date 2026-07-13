const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  initializeSubscription,
  cancelSubscription,
  handlePaystackWebhook
} = require('../controllers/subscriptionController');

router.post('/initialize', protect, initializeSubscription);
router.post('/cancel', protect, cancelSubscription);
router.post('/webhook', handlePaystackWebhook); // Webhooks are authenticated via HMAC SHA512 signature checking

module.exports = router;
