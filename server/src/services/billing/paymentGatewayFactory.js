/**
 * Payment Gateway Factory for JAHZJOURNALS
 * Resolves the appropriate gateway adapter (Paystack or Stripe) based on provider key or regional price.
 */

const paystackAdapter = require('./paystackAdapter');
const stripeAdapter = require('./stripeAdapter');

class PaymentGatewayFactory {
  constructor() {
    this.adapters = {
      PAYSTACK: paystackAdapter,
      STRIPE: stripeAdapter,
    };
  }

  /**
   * Retrieves adapter by provider key ('PAYSTACK' | 'STRIPE')
   */
  getAdapter(provider = 'PAYSTACK') {
    const key = String(provider).trim().toUpperCase();
    const adapter = this.adapters[key];
    if (!adapter) {
      throw new Error(`Unsupported payment provider: "${provider}". Supported providers are PAYSTACK, STRIPE.`);
    }
    return adapter;
  }

  /**
   * Retrieves adapter corresponding to a price record from the pricing catalogue
   */
  getAdapterForPrice(priceRecord) {
    if (!priceRecord) {
      return paystackAdapter;
    }
    const provider = priceRecord.provider || (priceRecord.region === 'NG' ? 'PAYSTACK' : 'STRIPE');
    return this.getAdapter(provider);
  }
}

module.exports = new PaymentGatewayFactory();
