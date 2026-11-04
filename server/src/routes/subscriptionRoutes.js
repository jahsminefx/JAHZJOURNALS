const express = require('express');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { paymentVerificationLimiter } = require('../middleware/rateLimitMiddleware');
const {
  initializeSubscription,
  verifySubscription,
  cancelSubscription,
  getBillingHistory,
  handlePaystackWebhook,
  handleStripeWebhook,
  getPricingCatalogueEndpoint,
  setUserRegionEndpoint,
  activateMentorFreeTrial,
  getMentorTrialStatus,
  getSubscriptionEntitlements,
} = require('../controllers/subscriptionController');

router.get('/pricing-catalogue', optionalProtect, getPricingCatalogueEndpoint);
router.post('/region', protect, setUserRegionEndpoint);
router.post('/initialize', protect, initializeSubscription);
router.get('/verify/:reference', paymentVerificationLimiter, optionalProtect, verifySubscription);
router.post('/cancel', protect, cancelSubscription);
router.get('/history', protect, getBillingHistory);
router.get('/entitlements', protect, getSubscriptionEntitlements);
router.post('/mentor-trial/activate', protect, activateMentorFreeTrial);
router.get('/mentor-trial/status', protect, getMentorTrialStatus);
router.post('/webhook', handlePaystackWebhook);
router.post('/paystack-webhook', handlePaystackWebhook);
router.post('/stripe-webhook', handleStripeWebhook);

module.exports = router;
