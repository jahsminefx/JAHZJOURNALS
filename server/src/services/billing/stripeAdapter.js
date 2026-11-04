/**
 * Stripe Payment Gateway Adapter for JAHZJOURNALS
 * Implements normalized gateway operations for International (USD / GBP / EUR) markets.
 * Built with native Node.js crypto and fetch for lightweight, dependency-free execution.
 */

const crypto = require('crypto');
const { isInternationalCheckoutEnabled } = require('../../config/pricingCatalogue');

const getStripeSecretKey = () => (process.env.STRIPE_SECRET_KEY || '').trim();
const getStripeWebhookSecret = () => (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

class StripeAdapter {
  constructor() {
    this.name = 'STRIPE';
  }

  isConfigured() {
    const key = getStripeSecretKey();
    return Boolean(key && key.startsWith('sk_') && key !== 'sk_test_example');
  }

  /**
   * Initializes a Stripe Checkout Session
   */
  async createCheckoutSession({ user, priceRecord, planKey, clientUrl, metadata = {}, promo = null }) {
    if (!isInternationalCheckoutEnabled()) {
      throw new Error('International USD checkout is currently disabled. Active subscriptions are processed in Nigerian Naira (NGN) via Paystack.');
    }

    if (!this.isConfigured()) {
      throw new Error('Stripe payment provider is not configured in this environment.');
    }

    const secretKey = getStripeSecretKey();
    let amountInCents = priceRecord.amountInMinor;

    if (promo && promo.discountPercent && promo.discountPercent > 0) {
      amountInCents = Math.round(amountInCents * (1 - promo.discountPercent / 100));
    }

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('customer_email', user.email);
    params.append('client_reference_id', user.id);
    params.append('success_url', `${clientUrl}/pricing?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${clientUrl}/pricing?payment=cancelled`);

    params.append('payment_method_types[0]', 'card');

    // Line items
    params.append('line_items[0][price_data][currency]', (priceRecord.currency || 'USD').toLowerCase());
    params.append('line_items[0][price_data][product_data][name]', `JAHZJOURNALS — ${priceRecord.amountFormatted.split('/')[0].trim()} (${planKey})`);
    params.append('line_items[0][price_data][product_data][description]', priceRecord.description || 'Forex Trading Journal & Analytics Platform');
    params.append('line_items[0][price_data][unit_amount]', String(amountInCents));
    params.append('line_items[0][price_data][recurring][interval]', 'month');
    params.append('line_items[0][quantity]', '1');

    // Metadata
    params.append('metadata[userId]', user.id);
    params.append('metadata[userEmail]', user.email);
    params.append('metadata[plan]', planKey);
    params.append('metadata[priceId]', priceRecord.id);
    params.append('metadata[gateway]', 'STRIPE');

    for (const [k, v] of Object.entries(metadata)) {
      if (v !== undefined && v !== null) {
        params.append(`metadata[${k}]`, String(v));
      }
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();
    if (session.id && session.url) {
      return {
        success: true,
        provider: 'STRIPE',
        authorizationUrl: session.url,
        reference: session.id,
        amountInMinor: amountInCents,
        currency: priceRecord.currency || 'USD',
      };
    }

    throw new Error(session.error?.message || 'Stripe checkout session initialization failed.');
  }

  /**
   * Verifies a completed checkout session or payment intent
   */
  async verifyPayment(sessionId) {
    const secretKey = getStripeSecretKey();
    if (!sessionId) {
      throw new Error('Stripe session ID is required');
    }

    if (this.isConfigured()) {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      const session = await response.json();
      if (session.id) {
        const isPaid = session.payment_status === 'paid';
        return {
          success: isPaid,
          status: isPaid ? 'SUCCESS' : (session.payment_status || 'PENDING').toUpperCase(),
          amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : 0,
          amountInMinor: session.amount_total || 0,
          currency: (session.currency || 'USD').toUpperCase(),
          reference: session.id,
          paidAt: new Date(),
          customerEmail: session.customer_details?.email || session.customer_email || null,
          metadata: session.metadata || {},
          providerSubscriptionId: session.subscription || null,
          providerCustomerId: session.customer || null,
          rawData: session,
        };
      }

      return {
        success: false,
        status: 'FAILED',
        reference: sessionId,
        message: session.error?.message || 'Stripe session lookup failed.',
      };
    }

    return {
      success: false,
      status: 'UNCONFIGURED',
      reference: sessionId,
      message: 'Stripe is not configured or international checkout is disabled.',
    };
  }

  /**
   * Verifies incoming Stripe webhook signature header using official HMAC-SHA256 scheme
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    const webhookSecret = getStripeWebhookSecret();
    if (!webhookSecret || !signatureHeader) return false;

    try {
      const items = signatureHeader.split(',');
      let timestamp = null;
      let signature = null;

      for (const item of items) {
        const [k, v] = item.split('=');
        if (k === 't') timestamp = v;
        if (k === 'v1') signature = v;
      }

      if (!timestamp || !signature) return false;

      // Tolerance check (5 minutes = 300 seconds)
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSeconds - parseInt(timestamp, 10)) > 300) {
        return false;
      }

      const signedPayload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature, 'utf-8'), Buffer.from(expectedSignature, 'utf-8'));
    } catch (_) {
      return false;
    }
  }

  /**
   * Normalizes incoming Stripe webhook event
   */
  parseWebhookEvent(body) {
    const eventId = body?.id || `stripe_evt_${Date.now()}`;
    const eventType = body?.type || 'unknown';
    const dataObj = body?.data?.object || {};

    let reference = dataObj.id || null;
    let amount = 0;
    let amountInMinor = 0;
    let currency = (dataObj.currency || 'USD').toUpperCase();
    let metadata = dataObj.metadata || {};
    let customerEmail = dataObj.customer_email || dataObj.customer_details?.email || null;

    if (typeof dataObj.amount_total === 'number') {
      amountInMinor = dataObj.amount_total;
      amount = amountInMinor / 100;
    } else if (typeof dataObj.amount_paid === 'number') {
      amountInMinor = dataObj.amount_paid;
      amount = amountInMinor / 100;
    }

    return {
      provider: 'STRIPE',
      eventId,
      eventType,
      reference,
      amount,
      amountInMinor,
      currency,
      paidAt: dataObj.created ? new Date(dataObj.created * 1000) : new Date(),
      customerEmail,
      metadata,
      providerSubscriptionId: dataObj.subscription || (eventType.startsWith('customer.subscription') ? dataObj.id : null),
      providerCustomerId: dataObj.customer || null,
      rawData: dataObj,
    };
  }
}

module.exports = new StripeAdapter();
