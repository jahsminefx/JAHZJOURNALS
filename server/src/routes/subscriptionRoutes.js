const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  initializeSubscription,
  verifySubscription,
  cancelSubscription,
  getBillingHistory,
  handlePaystackWebhook
} = require('../controllers/subscriptionController');

router.post('/initialize', protect, initializeSubscription);
router.get('/verify/:reference', protect, verifySubscription);
router.post('/cancel', protect, cancelSubscription);
router.get('/history', protect, getBillingHistory);
router.post('/webhook', handlePaystackWebhook);
router.post('/paystack-webhook', handlePaystackWebhook);

module.exports = router;
