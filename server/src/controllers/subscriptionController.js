const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { determineActivationMethod } = require('../services/subscriptionService');
const { sendSubscriptionConfirmationEmail } = require('../services/emailService');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PLAN_MAPPINGS = {
  STARTER: { amountInKobo: 300000, planCode: process.env.PAYSTACK_STARTER_PLAN },
  PRO: { amountInKobo: 800000, planCode: process.env.PAYSTACK_PRO_PLAN },
  MENTOR: { amountInKobo: 2500000, planCode: process.env.PAYSTACK_MENTOR_PLAN },
};

const initializeSubscription = async (req, res) => {
  try {
    const { plan, email } = req.body;
    const planConfig = PLAN_MAPPINGS[plan];
    if (!planConfig) {
      return res.status(400).json({ message: 'Invalid subscription plan selected.' });
    }

    const activation = await determineActivationMethod(req.user, plan);
    
    if (activation.method === 'PROMOTION') {
      return res.json({ success: true, authorization_url: null, message: activation.message });
    } else if (activation.method === 'ALREADY_ACTIVE') {
      return res.status(400).json({ message: activation.message });
    } else {
      const userEmail = email || req.user.email;
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      
      if (PAYSTACK_SECRET && PAYSTACK_SECRET !== 'sk_test_example') {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            amount: planConfig.amountInKobo,
            plan: planConfig.planCode || undefined,
            callback_url: `${clientUrl}/pricing?payment=success`,
            metadata: {
              userId: req.user.id,
              requestedPlan: plan,
            },
          }),
        });

        const data = await response.json();
        if (data.status && data.data?.authorization_url) {
          return res.json({
            success: true,
            authorization_url: data.data.authorization_url,
            reference: data.data.reference,
            message: 'Paystack checkout initialized successfully.',
          });
        } else {
          console.warn('Paystack Initialize API Error Response:', data);
        }
      }

      // Safe fallback for testing/development when test keys are used
      const authorization_url = `https://checkout.paystack.com/mock-url-${plan.toLowerCase()}`;
      return res.json({ success: true, authorization_url, message: activation.message || 'Proceed to payment gateway' });
    }
  } catch (error) {
    console.error('Subscription Init Error:', error);
    res.status(500).json({ message: 'Unable to initialize subscription at this time.' });
  }
};

const verifySubscription = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) {
      return res.status(400).json({ message: 'Transaction reference is required.' });
    }

    if (PAYSTACK_SECRET && PAYSTACK_SECRET !== 'sk_test_example') {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      });

      const data = await response.json();
      if (data.status && data.data && data.data.status === 'success') {
        const { metadata, amount } = data.data;
        const userId = metadata?.userId || req.user.id;
        const requestedPlan = metadata?.requestedPlan || 'PRO';

        const [paymentRecord, updatedUser] = await prisma.$transaction([
          prisma.payment.upsert({
            where: { reference },
            update: { status: 'SUCCESS', paidAt: new Date() },
            create: {
              userId,
              amount: amount / 100,
              provider: 'PAYSTACK',
              reference,
              status: 'SUCCESS',
              paidAt: new Date(),
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionPlan: requestedPlan,
              subscriptionStatus: 'ACTIVE',
            },
          }),
        ]);

        // Dispatch confirmation email asynchronously without blocking transaction response
        sendSubscriptionConfirmationEmail(updatedUser, requestedPlan).catch(err => {
          console.warn('Subscription confirmation email warning:', err?.message || err);
        });

        return res.json({
          success: true,
          plan: requestedPlan,
          message: `Payment verified successfully! Your account has been upgraded to ${requestedPlan}.`,
        });
      }
    }

    return res.status(400).json({ message: 'Transaction verification failed or payment was not successful.' });
  } catch (error) {
    console.error('Subscription Verification Error:', error);
    res.status(500).json({ message: 'Unable to verify transaction at this time.' });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { subscriptionStatus: true, subscriptionPlan: true }
    });

    if (user.subscriptionPlan === 'FREE') {
      return res.status(400).json({ message: 'You are currently on the Free plan.' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        subscriptionStatus: 'CANCELLED',
      }
    });

    res.json({ message: 'Your subscription has been cancelled. It will remain active until the end of your billing cycle.' });
  } catch (error) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ message: 'Failed to cancel subscription.' });
  }
};

const handlePaystackWebhook = async (req, res) => {
  try {
    // Cryptographic webhook verification
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.rawBody || JSON.stringify(req.body)).digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { metadata, reference, amount } = event.data;
      if (metadata && metadata.userId) {
        
        const [paymentRecord, updatedUser] = await prisma.$transaction([
          prisma.payment.upsert({
            where: { reference },
            update: { status: 'SUCCESS', paidAt: new Date() },
            create: {
              userId: metadata.userId,
              amount: amount / 100,
              provider: 'PAYSTACK',
              reference,
              status: 'SUCCESS',
              paidAt: new Date(),
            },
          }),
          prisma.user.update({
            where: { id: metadata.userId },
            data: {
              subscriptionPlan: metadata.requestedPlan,
              subscriptionStatus: 'ACTIVE',
            }
          })
        ]);
        
        console.log(`Payment confirmed and account upgraded for user ${metadata.userId}`);

        // Dispatch confirmation email asynchronously
        sendSubscriptionConfirmationEmail(updatedUser, metadata.requestedPlan).catch(err => {
          console.warn('Subscription webhook confirmation email warning:', err?.message || err);
        });
      }
    }

    res.status(200).send('Webhook Processed Successfully');
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).send('Webhook Processing Error');
  }
};

module.exports = {
  initializeSubscription,
  verifySubscription,
  cancelSubscription,
  handlePaystackWebhook,
};
