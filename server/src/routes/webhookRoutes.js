const express = require('express');
const router = express.Router();
const { handleBrevoWebhook } = require('../controllers/webhookController');
const { handleMtSyncWebhook } = require('../controllers/mtSyncController');

router.post('/brevo', handleBrevoWebhook);
router.post('/mt-sync', handleMtSyncWebhook);

module.exports = router;
