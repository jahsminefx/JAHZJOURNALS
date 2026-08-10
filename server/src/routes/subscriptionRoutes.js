const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  initializeSubscription,
  verifySubscription,
  cancelSubscription,
  handlePaystackWebhook
} = require('../controllers/subscriptionController');

router.post('/initialize', protect, initializeSubscription);
router.get('/verify/:reference', protect, verifySubscription);
router.post('/cancel', protect, cancelSubscription);
router.post('/webhook', handlePaystackWebhook);
router.post('/paystack-webhook', handlePaystackWebhook);

module.exports = router;
