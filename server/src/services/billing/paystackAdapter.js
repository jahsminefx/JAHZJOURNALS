/**
 * Paystack Payment Gateway Adapter for JAHZJOURNALS
 * Implements normalized gateway operations for Nigerian & regional corridors.
 */

const crypto = require('crypto');

const getPaystackSecret = () => (process.env.PAYSTACK_SECRET_KEY || '').trim();

class PaystackAdapter {
  constructor() {
    this.name = 'PAYSTACK';
  }

  isConfigured() {
    const secret = getPaystackSecret();
    return Boolean(secret && secret !== 'sk_test_example');
  }

  /**
   * Initializes a Paystack checkout transaction
   */
  async createCheckoutSession({ user, priceRecord, planKey, clientUrl, metadata = {}, promo = null }) {
    const secret = getPaystackSecret();
    let amountInKobo = priceRecord.amountInMinor;

    // Apply promo discount if applicable
    if (promo && promo.discountPercent && promo.discountPercent > 0) {
      amountInKobo = Math.round(amountInKobo * (1 - promo.discountPercent / 100));
    }

    const payload = {
      email: user.email,
      amount: amountInKobo,
      currency: priceRecord.currency || 'NGN',
      callback_url: `${clientUrl}/pricing?payment=success`,
      metadata: {
        userId: user.id,
        userEmail: user.email,
        plan: planKey,
        priceId: priceRecord.id,
        gateway: 'PAYSTACK',
        ...metadata,
      },
    };

    if (priceRecord.providerPlanCode && (!promo || !promo.discountPercent)) {
      payload.plan = priceRecord.providerPlanCode;
    }

    if (this.isConfigured()) {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.status && data.data?.authorization_url) {
        return {
          success: true,
          provider: 'PAYSTACK',
          authorizationUrl: data.data.authorization_url,
          reference: data.data.reference,
          amountInMinor: amountInKobo,
          currency: priceRecord.currency || 'NGN',
        };
      }

      throw new Error(data.message || 'Paystack initialization failed.');
    }

    // Safe test/mock mode
    const mockReference = `mock_paystack_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      success: true,
      provider: 'PAYSTACK',
      authorizationUrl: `https://checkout.paystack.com/mock-url-${planKey.toLowerCase()}?ref=${mockReference}`,
      reference: mockReference,
      amountInMinor: amountInKobo,
      currency: priceRecord.currency || 'NGN',
      isMock: true,
    };
  }

  /**
   * Verifies transaction with Paystack API
   */
  async verifyPayment(reference) {
    const secret = getPaystackSecret();
    if (!reference) {
      throw new Error('Transaction reference is required');
    }

    if (this.isConfigured()) {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      const data = await response.json();
      if (data.status && data.data) {
        const txStatus = String(data.data.status || '').toLowerCase();
        const isSuccess = txStatus === 'success';

        return {
          success: isSuccess,
          status: isSuccess ? 'SUCCESS' : txStatus.toUpperCase() || 'FAILED',
          amount: typeof data.data.amount === 'number' ? data.data.amount / 100 : 0,
          amountInMinor: data.data.amount || 0,
          currency: (data.data.currency || 'NGN').toUpperCase(),
          reference: data.data.reference,
          paidAt: data.data.paid_at ? new Date(data.data.paid_at) : new Date(),
          customerEmail: data.data.customer?.email || null,
          metadata: data.data.metadata || {},
          rawData: data.data,
        };
      }

      return {
        success: false,
        status: 'FAILED',
        reference,
        message: data.message || 'Paystack verification failed',
      };
    }

    // Simulated test verification for mock references
    if (String(reference).startsWith('mock_paystack_')) {
      return {
        success: true,
        status: 'SUCCESS',
        amount: 8500,
        amountInMinor: 850000,
        currency: 'NGN',
        reference,
        paidAt: new Date(),
        customerEmail: 'test@jahzjournal.com',
        metadata: { plan: 'PRO' },
        isMock: true,
      };
    }

    return {
      success: false,
      status: 'UNCONFIGURED',
      reference,
      message: 'Paystack is not configured in this environment.',
    };
  }

  /**
   * Verifies incoming webhook HMAC-SHA512 signature
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    const secret = getPaystackSecret();
    if (!secret || !signatureHeader) return false;

    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBuffer)
      .digest('hex');

    const expectedBuffer = Buffer.from(hash, 'utf8');
    const actualBuffer = Buffer.from(String(signatureHeader).trim(), 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  /**
   * Parses webhook payload into normalized event representation
   */
  parseWebhookEvent(body) {
    const eventType = body?.event;
    const txData = body?.data || {};
    const reference = txData.reference || null;
    const eventId = reference ? `paystack_${eventType}_${reference}` : `paystack_${Date.now()}_${Math.random()}`;

    return {
      provider: 'PAYSTACK',
      eventId,
      eventType,
      reference,
      amount: typeof txData.amount === 'number' ? txData.amount / 100 : 0,
      amountInMinor: txData.amount || 0,
      currency: (txData.currency || 'NGN').toUpperCase(),
      paidAt: txData.paid_at ? new Date(txData.paid_at) : new Date(),
      customerEmail: txData.customer?.email || null,
      metadata: txData.metadata || {},
      rawData: txData,
    };
  }
}

module.exports = new PaystackAdapter();
