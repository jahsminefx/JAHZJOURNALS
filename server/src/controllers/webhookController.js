const crypto = require('crypto');
const { hashRecipient } = require('../services/brevoClient');
const logger = require('../utils/logger');

/**
 * Handle Brevo Transactional Event Webhooks (sent, delivered, opened, bounce, etc.)
 * POST /api/webhooks/brevo
 */
const handleBrevoWebhook = async (req, res) => {
  try {
    const webhookToken = process.env.BREVO_WEBHOOK_SECRET;

    // Fail-closed when webhook secret is unconfigured
    if (!webhookToken || webhookToken.trim() === '') {
      logger.warn('Brevo webhook received but BREVO_WEBHOOK_SECRET is unconfigured');
      return res.status(503).json({ message: 'Brevo webhook processing is not configured' });
    }

    // Strictly extract token from request headers (reject query parameters to avoid URL leakage)
    const incomingToken = req.headers['x-brevo-token'] ||
      req.headers['x-webhook-secret'] ||
      (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7).trim() : null);

    if (!incomingToken) {
      return res.status(401).json({ message: 'Missing webhook authentication token.' });
    }

    // Constant-time token verification
    const expectedBuffer = Buffer.from(webhookToken, 'utf8');
    const incomingBuffer = Buffer.from(String(incomingToken), 'utf8');

    if (expectedBuffer.length !== incomingBuffer.length || !crypto.timingSafeEqual(expectedBuffer, incomingBuffer)) {
      return res.status(401).json({ message: 'Unauthorized webhook request.' });
    }

    const payload = req.body;
    if (!payload || (typeof payload !== 'object')) {
      return res.status(400).json({ message: 'Invalid webhook payload structure.' });
    }

    // Brevo sends either a single event object or an array of events
    const events = Array.isArray(payload) ? payload : [payload];

    for (const evt of events) {
      if (!evt || typeof evt !== 'object') continue;
      const eventType = String(evt.event || evt['event-type'] || 'unknown').slice(0, 50);
      const email = evt.email || evt.recipient;
      const messageId = String(evt['message-id'] || evt.messageId || 'none').slice(0, 100);
      const reason = String(evt.reason || evt.error || '').slice(0, 200);

      logger.info('Brevo webhook event processed', {
        event: eventType,
        recipient: email ? hashRecipient(email) : 'unknown',
        messageId,
        hasReason: Boolean(reason),
      });
    }

    return res.status(200).json({ status: 'success', processedEvents: events.length });
  } catch (error) {
    logger.error('Brevo webhook processing error', { error: error.message });
    return res.status(500).json({ status: 'error', message: 'Failed to process webhook event.' });
  }
};

module.exports = {
  handleBrevoWebhook,
};
