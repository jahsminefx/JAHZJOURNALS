const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_example';
const PLAN_MAPPINGS = {
  STARTER: { amount: 1000, planCode: process.env.PAYSTACK_STARTER_PLAN },
  PRO: { amount: 2500, planCode: process.env.PAYSTACK_PRO_PLAN },
  MENTOR: { amount: 5000, planCode: process.env.PAYSTACK_MENTOR_PLAN },
};

const initializeSubscription = async (req, res) => {
  try {
    const { plan, email } = req.body;
    if (!PLAN_MAPPINGS[plan]) {
      return res.status(400).json({ message: 'Invalid subscription plan selected.' });
    }

    const reference = `JAHZ_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // Normally we'd POST to Paystack api.paystack.co/transaction/initialize here and return the auth URL.
    // Assuming native Node fetch exists (Node >= 18)
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || req.user.email,
        amount: PLAN_MAPPINGS[plan].amount * 100, // Paystack requires kobo/cents
        plan: PLAN_MAPPINGS[plan].planCode,
        reference,
        metadata: {
          userId: req.user.id,
          requestedPlan: plan,
        },
      }),
    });

    const data = await response.json();
    if (!data.status) {
      return res.status(400).json({ message: data.message || 'Failed to initialize payment gateway.' });
    }

    res.json({ success: true, authorization_url: data.data.authorization_url, reference });
  } catch (error) {
    console.error('Subscription Init Error:', error);
    res.status(500).json({ message: 'Unable to initialize subscription at this time.' });
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
        
        await prisma.$transaction([
          prisma.payment.create({
            data: {
              userId: metadata.userId,
              amount: amount / 100,
              provider: 'PAYSTACK',
              reference,
              status: 'SUCCESS',
              paidAt: new Date(),
            }
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
  cancelSubscription,
  handlePaystackWebhook,
};
