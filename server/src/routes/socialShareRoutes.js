const express = require('express');
const router = express.Router();
const socialShareController = require('../controllers/socialShareController');

// Public Unauthenticated Sharing Endpoints
router.get('/trade/:shareToken', socialShareController.getPublicSharedTrade);
router.get('/daily-review/:shareToken', socialShareController.getPublicSharedDailyReview);

module.exports = router;
