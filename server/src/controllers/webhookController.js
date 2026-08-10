const { hashRecipient } = require('../services/brevoClient');

/**
 * Handle Brevo Transactional Event Webhooks (sent, delivered, opened, bounce, etc.)
 * POST /api/webhooks/brevo
 */
const handleBrevoWebhook = async (req, res) => {
  try {
    // Optional token header check if configured
    const webhookToken = process.env.BREVO_WEBHOOK_SECRET;
    if (webhookToken) {
      const incomingToken = req.headers['x-brevo-token'] || req.headers['x-webhook-secret'] || req.query.secret;
      if (incomingToken !== webhookToken) {
        return res.status(401).json({ message: 'Unauthorized webhook request.' });
      }
    }

    const payload = req.body;

    // Brevo sends either a single event object or an array of events
    const events = Array.isArray(payload) ? payload : [payload];

    for (const evt of events) {
      const eventType = evt.event || evt['event-type'] || 'unknown';
      const email = evt.email || evt.recipient;
      const messageId = evt['message-id'] || evt.messageId || 'none';
      const reason = evt.reason || evt.error || '';

      console.log(`[Brevo Webhook Event] Event: ${eventType} | Recipient: ${hashRecipient(email)} | MsgID: ${messageId} ${reason ? '| Reason: ' + reason : ''}`);
    }

    return res.status(200).json({ status: 'success', processedEvents: events.length });
  } catch (error) {
    console.error('[Brevo Webhook Processing Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to process webhook event.' });
  }
};

module.exports = {
  handleBrevoWebhook,
};
