const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { determineActivationMethod } = require('../services/subscriptionService');
const { sendSubscriptionConfirmationEmail } = require('../services/emailService');

const getPaystackSecret = () => (process.env.PAYSTACK_SECRET_KEY || '').trim();

const getPlanMappings = () => ({
  STARTER: { amountInKobo: 400000, planCode: process.env.PAYSTACK_STARTER_PLAN },
  PRO: { amountInKobo: 800000, planCode: process.env.PAYSTACK_PRO_PLAN },
  MENTOR: { amountInKobo: 2500000, planCode: process.env.PAYSTACK_MENTOR_PLAN },
});

const PLAN_RANK = {
  FREE: 1,
  STARTER: 2,
  PRO: 3,
  MENTOR: 4,
};

const VALID_PLANS = new Set(['FREE', 'STARTER', 'PRO', 'MENTOR']);

const resolveClientUrl = (req) => {
  const configured = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const origin = req?.get?.('origin');
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('jahzjournal.com') || origin.includes('169.58.9.55'))) {
    return origin.replace(/\/$/, '');
  }
  const referer = req?.get?.('referer');
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (refOrigin.includes('localhost') || refOrigin.includes('127.0.0.1') || refOrigin.includes('jahzjournal.com') || refOrigin.includes('169.58.9.55')) {
        return refOrigin.replace(/\/$/, '');
      }
    } catch (_) {
      // ignore invalid referer URL
    }
  }
  if (configured === 'http://jahzjournal.com') {
    return 'https://jahzjournal.com';
  }
  return configured.replace(/\/$/, '');
};

const normalizeGmailAddress = (email) => {
  if (!email || typeof email !== 'string') return '';
  const lower = email.trim().toLowerCase();
  const [local, domain] = lower.split('@');
  if (!domain) return lower;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.replace(/\./g, '')}@gmail.com`;
  }
  return lower;
};

const findUserForPaystackTransaction = async (txData, fallbackUserId = null) => {
  const metadata = txData?.metadata && typeof txData.metadata === 'object' ? txData.metadata : {};
  const metaUserId = metadata.userId;

  if (metaUserId) {
    const user = await prisma.user.findUnique({ where: { id: metaUserId } });
    if (user) return user;
  }

  if (fallbackUserId) {
    const user = await prisma.user.findUnique({ where: { id: fallbackUserId } });
    if (user) return user;
  }

  if (txData?.reference) {
    const existingPayment = await prisma.payment.findUnique({
      where: { reference: txData.reference },
      include: { user: true },
    });
    if (existingPayment?.user) return existingPayment.user;
  }

  const customerEmail = txData?.customer?.email;
  if (customerEmail) {
    const directUser = await prisma.user.findFirst({
      where: { email: { equals: customerEmail.trim(), mode: 'insensitive' } },
    });
    if (directUser) return directUser;

    // Fallback for Gmail dot variations (e.g. anintajahsmine@gmail.com vs aninta.jahsmine@gmail.com)
    const normalizedTarget = normalizeGmailAddress(customerEmail);
    if (normalizedTarget.endsWith('@gmail.com')) {
      const gmailUsers = await prisma.user.findMany({
        where: { email: { endsWith: '@gmail.com', mode: 'insensitive' } },
      });
      const matched = gmailUsers.find((u) => normalizeGmailAddress(u.email) === normalizedTarget);
      if (matched) return matched;
    }
  }

  return null;
};

const inferPlanFromTransaction = (txData) => {
  const metadata = txData?.metadata && typeof txData.metadata === 'object' ? txData.metadata : {};
  if (metadata.requestedPlan && VALID_PLANS.has(String(metadata.requestedPlan).toUpperCase())) {
    return String(metadata.requestedPlan).toUpperCase();
  }
  const planObjName = txData?.plan_object?.name ? String(txData.plan_object.name).toUpperCase() : '';
  if (VALID_PLANS.has(planObjName)) {
    return planObjName;
  }
  const amountNgn = (txData?.amount || 0) / 100;
  if (metadata.studentCount || amountNgn >= 10000) return 'MENTOR';
  if (amountNgn >= 6000) return 'PRO';
  return 'STARTER';
};

/**
 * Idempotently records a successful Paystack transaction across:
 * 1) prisma.payment
 * 2) prisma.user (subscriptionPlan & subscriptionStatus)
 * 3) prisma.subscription (ACTIVE record with source='PAYMENT', paymentReference, expiresAt)
 * 4) prisma.subscriptionHistory (audit trail with reason='PAYMENT_COMPLETED')
 */
const fulfillPaystackTransaction = async (txData, options = {}) => {
  const { fallbackUserId = null, isHistoricalSync = false } = options;
  const reference = txData?.reference;
  if (!reference) {
    throw new Error('Missing transaction reference in Paystack payload');
  }

  const user = await findUserForPaystackTransaction(txData, fallbackUserId);
  if (!user) {
    return { fulfilled: false, reason: 'USER_NOT_FOUND', reference };
  }

  const requestedPlan = inferPlanFromTransaction(txData);
  const amount = typeof txData.amount === 'number' ? txData.amount / 100 : 0;
  const currency = (txData.currency || 'NGN').toUpperCase();
  const paidAt = txData.paid_at || txData.paidAt ? new Date(txData.paid_at || txData.paidAt) : new Date();
  const channel = txData.channel || 'card';
  const metadata = txData?.metadata && typeof txData.metadata === 'object' ? txData.metadata : {};
  const rawPromotionId = metadata.promotionId || null;

  let validPromotionId = null;
  if (rawPromotionId) {
    const promoExists = await prisma.promotion.findUnique({ where: { id: rawPromotionId }, select: { id: true } });
    if (promoExists) validPromotionId = promoExists.id;
  }

  const existingPayment = await prisma.payment.findUnique({ where: { reference } });
  const wasAlreadySuccess = existingPayment?.status === 'SUCCESS';

  // 1. Upsert Payment record with accurate currency & status
  const paymentRecord = await prisma.payment.upsert({
    where: { reference },
    update: {
      amount: amount > 0 ? amount : existingPayment?.amount || 0,
      currency,
      provider: 'PAYSTACK',
      status: 'SUCCESS',
      paidAt,
    },
    create: {
      userId: user.id,
      amount,
      currency,
      provider: 'PAYSTACK',
      reference,
      status: 'SUCCESS',
      paidAt,
      createdAt: txData.created_at ? new Date(txData.created_at) : paidAt,
    },
  });

  // 2. Check active subscription state to determine if user plan should be updated
  const currentSub = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  const expiresAt = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isCycleStillValid = expiresAt > new Date();

  const currentRank = PLAN_RANK[user.subscriptionPlan] || 1;
  const targetRank = PLAN_RANK[requestedPlan] || 1;
  const effectivePlan = (currentRank > targetRank && user.subscriptionStatus === 'ACTIVE')
    ? user.subscriptionPlan
    : requestedPlan;

  let shouldUpdateActivePlan = true;
  if (!isCycleStillValid) {
    shouldUpdateActivePlan = false;
  } else if (isHistoricalSync) {
    if (currentRank > targetRank) {
      shouldUpdateActivePlan = false;
    } else if (currentSub && currentSub.updatedAt > paidAt && currentSub.plan !== 'FREE') {
      shouldUpdateActivePlan = false;
    }
  }

  let updatedUser = user;
  if (shouldUpdateActivePlan) {
    const updateData = {
      subscriptionPlan: effectivePlan,
      subscriptionStatus: 'ACTIVE',
    };

    if (effectivePlan === 'MENTOR') {
      const tierKey = metadata.mentorTier || (amount >= 65000 ? 'MEGA' : amount >= 25000 ? 'GROWTH' : 'PRIVATE_COHORT');
      updateData.role = 'MENTOR';
      updateData.mentorTier = tierKey;
      updateData.mentorMaxStudents = tierKey === 'MEGA' ? 1000 : tierKey === 'GROWTH' ? 150 : 50;
      updateData.mentorMaxCohorts = tierKey === 'MEGA' ? 100 : tierKey === 'GROWTH' ? 5 : 2;
    }

    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (currentSub) {
      await prisma.subscription.update({
        where: { id: currentSub.id },
        data: {
          plan: effectivePlan,
          status: 'ACTIVE',
          source: 'PAYMENT',
          autoRenew: true,
          paymentReference: reference,
          promotionId: validPromotionId,
          startedAt: paidAt,
          expiresAt,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: effectivePlan,
          status: 'ACTIVE',
          source: 'PAYMENT',
          autoRenew: true,
          paymentReference: reference,
          promotionId: validPromotionId,
          startedAt: paidAt,
          expiresAt,
        },
      });
    }
  } else if (currentSub && !currentSub.paymentReference && currentSub.source === 'PAYMENT') {
    await prisma.subscription.update({
      where: { id: currentSub.id },
      data: { paymentReference: reference },
    });
  }

  // 3. Ensure SubscriptionHistory record exists for this paymentReference
  const existingHistory = await prisma.subscriptionHistory.findFirst({
    where: { userId: user.id, paymentReference: reference },
  });

  if (!existingHistory) {
    const studentNote = metadata.studentCount ? ` [${metadata.studentCount} Students Capacity]` : '';
    const discountNote = metadata.discountPercent ? ` [${metadata.discountPercent}% Promo Discount]` : '';
    await prisma.subscriptionHistory.create({
      data: {
        userId: user.id,
        previousPlan: user.subscriptionPlan || 'FREE',
        newPlan: requestedPlan,
        source: 'PAYMENT',
        reason: 'PAYMENT_COMPLETED',
        promotionId: validPromotionId,
        paymentReference: reference,
        changedBy: 'USER',
        notes: `Paystack payment of ${currency} ${amount.toLocaleString()} verified via ${channel} (Ref: ${reference})${studentNote}${discountNote}`,
        createdAt: paidAt,
      },
    });

    if (!wasAlreadySuccess && validPromotionId) {
      await prisma.promotion.update({
        where: { id: validPromotionId },
        data: { currentRedemptions: { increment: 1 } },
      }).catch((err) => console.warn('Failed incrementing promo redemptions:', err?.message || err));
    }
  }

  return {
    fulfilled: true,
    wasAlreadySuccess,
    plan: requestedPlan,
    payment: paymentRecord,
    user: updatedUser,
  };
};

/**
 * Synchronizes recent Paystack transactions from Paystack API into prisma.payment
 * so that bank transfers, abandoned checkouts, and localhost test payments are always visible.
 */
const syncPaystackTransactions = async (options = {}) => {
  const secret = getPaystackSecret();
  if (!secret || secret === 'sk_test_example') {
    return { synced: 0, mode: 'UNCONFIGURED' };
  }

  const mode = secret.startsWith('sk_live_') ? 'LIVE' : 'TEST';

  try {
    const response = await fetch('https://api.paystack.co/transaction?perPage=50', {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });

    const data = await response.json();
    if (!data?.status || !Array.isArray(data.data)) {
      return { synced: 0, mode, error: data?.message || 'Paystack list failed' };
    }

    let syncedCount = 0;

    for (const tx of data.data) {
      if (!tx?.reference) continue;

      const txStatus = String(tx.status || '').toLowerCase();
      if (txStatus === 'success') {
        const res = await fulfillPaystackTransaction(tx, {
          fallbackUserId: options.userId || null,
          isHistoricalSync: true,
        });
        if (res.fulfilled) syncedCount++;
      } else {
        // Record abandoned / failed / pending attempts for full transparency
        const user = await findUserForPaystackTransaction(tx, options.userId || null);
        if (user) {
          const existing = await prisma.payment.findUnique({ where: { reference: tx.reference } });
          if (!existing) {
            await prisma.payment.create({
              data: {
                userId: user.id,
                amount: typeof tx.amount === 'number' ? tx.amount / 100 : 0,
                currency: (tx.currency || 'NGN').toUpperCase(),
                provider: 'PAYSTACK',
                reference: tx.reference,
                status: txStatus.toUpperCase() || 'ABANDONED',
                paidAt: tx.paid_at ? new Date(tx.paid_at) : null,
                createdAt: tx.created_at ? new Date(tx.created_at) : new Date(),
              },
            });
            syncedCount++;
          } else if (existing.status !== 'SUCCESS' && existing.status !== txStatus.toUpperCase()) {
            await prisma.payment.update({
              where: { reference: tx.reference },
              data: {
                status: txStatus.toUpperCase(),
                currency: (tx.currency || existing.currency || 'NGN').toUpperCase(),
              },
            });
            syncedCount++;
          }
        }
      }
    }

    return { synced: syncedCount, mode, totalChecked: data.data.length };
  } catch (error) {
    console.warn('Paystack sync warning:', error?.message || error);
    return { synced: 0, mode, error: error?.message };
  }
};

const initializeSubscription = async (req, res) => {
  try {
    const { plan, email, promoCode, studentCount } = req.body;
    const planMappings = getPlanMappings();
    const planConfig = planMappings[plan];
    if (!planConfig) {
      return res.status(400).json({ message: 'Invalid subscription plan selected.' });
    }

    let appliedPromo = null;
    let amountInKobo = planConfig.amountInKobo;
    let mentorStudentCount = null;

    let selectedMentorTier = null;
    if (plan === 'MENTOR') {
      const { tier } = req.body;
      const parsed = parseInt(studentCount, 10);
      if (tier === 'GROWTH' || (!tier && parsed > 50 && parsed <= 150)) {
        selectedMentorTier = 'GROWTH';
        amountInKobo = 25000 * 100;
        mentorStudentCount = 150;
      } else if (tier === 'MEGA' || (!tier && parsed > 150)) {
        selectedMentorTier = 'MEGA';
        amountInKobo = 65000 * 100;
        mentorStudentCount = 1000;
      } else {
        selectedMentorTier = 'PRIVATE_COHORT';
        amountInKobo = 8000 * 100;
        mentorStudentCount = 50;
      }
    }

    if (promoCode && promoCode.trim()) {
      const cleanCode = promoCode.toLowerCase().trim();
      const promo = await prisma.promotion.findFirst({
        where: {
          OR: [{ slug: cleanCode }, { id: promoCode.trim() }],
          isActive: true,
        },
      });

      if (promo) {
        const now = new Date();
        const isNotExpired = !promo.endsAt || new Date(promo.endsAt) >= now;
        const isStarted = !promo.startsAt || new Date(promo.startsAt) <= now;
        const hasRedemptions = !promo.maxRedemptions || promo.currentRedemptions < promo.maxRedemptions;
        const promoPlans = promo.applicablePlans && promo.applicablePlans.length > 0 ? promo.applicablePlans : [promo.planGranted];
        const isPlanApplicable = promoPlans.includes(plan);

        if (isNotExpired && isStarted && hasRedemptions && isPlanApplicable) {
          if (promo.discountType === 'PERCENTAGE_DISCOUNT' || (promo.discountPercent && promo.discountPercent > 0 && promo.discountPercent < 100)) {
            const percent = promo.discountPercent || 50;
            amountInKobo = Math.round(amountInKobo * (1 - percent / 100));
            appliedPromo = promo;
          }
        }
      }
    }

    const activation = await determineActivationMethod(req.user, plan);

    if (!appliedPromo && activation.method === 'PROMOTION') {
      return res.json({ success: true, authorization_url: null, message: activation.message });
    }
    if (activation.method === 'ALREADY_ACTIVE' && (!appliedPromo || req.user.subscriptionPlan === plan)) {
      return res.status(400).json({ message: activation.message });
    }

    const userEmail = email || req.user.email;
    const clientUrl = resolveClientUrl(req);
    const secret = getPaystackSecret();

    if (secret && secret !== 'sk_test_example') {
      const buildInitPayload = (includePlanCode) => ({
        email: userEmail,
        amount: amountInKobo,
        currency: 'NGN',
        plan: includePlanCode && !appliedPromo && plan !== 'MENTOR' ? (planConfig.planCode || undefined) : undefined,
        callback_url: `${clientUrl}/pricing?payment=success`,
        metadata: {
          userId: req.user.id,
          userEmail: req.user.email,
          requestedPlan: plan,
          mentorTier: selectedMentorTier || undefined,
          studentCount: mentorStudentCount || undefined,
          calculatedAmountNgn: Math.round(amountInKobo / 100),
          promotionId: appliedPromo ? appliedPromo.id : undefined,
          discountPercent: appliedPromo ? appliedPromo.discountPercent : undefined,
        },
      });

      let response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildInitPayload(true)),
      });

      let data = await response.json();

      // If planCode failed (e.g. switching from test keys to live keys where test PLN_ code doesn't exist), retry with direct amount
      if (!data.status && !appliedPromo && planConfig.planCode) {
        console.warn(`Paystack plan code ${planConfig.planCode} rejected (${data.message}). Retrying with direct amount...`);
        response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildInitPayload(false)),
        });
        data = await response.json();
      }

      if (data.status && data.data?.authorization_url) {
        // Record PENDING transaction immediately so it is tracked even before redirect
        if (data.data.reference) {
          await prisma.payment.upsert({
            where: { reference: data.data.reference },
            update: {
              amount: amountInKobo / 100,
              currency: 'NGN',
            },
            create: {
              userId: req.user.id,
              amount: amountInKobo / 100,
              currency: 'NGN',
              provider: 'PAYSTACK',
              reference: data.data.reference,
              status: 'PENDING',
            },
          }).catch((err) => console.warn('Failed creating initial pending payment:', err?.message || err));
        }

        return res.json({
          success: true,
          authorization_url: data.data.authorization_url,
          reference: data.data.reference,
          message: appliedPromo
            ? `Paystack checkout initialized with ${appliedPromo.discountPercent}% discount!`
            : 'Paystack checkout initialized successfully.',
        });
      }

      console.error('Paystack Initialize API Error Response:', data);
      return res.status(400).json({
        message: data.message || 'Paystack could not initialize checkout. Please check your payment configuration.',
      });
    }

    // Safe fallback ONLY when PAYSTACK_SECRET_KEY is not configured or is 'sk_test_example' (unit tests)
    const authorization_url = `https://checkout.paystack.com/mock-url-${plan.toLowerCase()}`;
    return res.json({
      success: true,
      authorization_url,
      message: appliedPromo
        ? `Proceed to payment gateway (${appliedPromo.discountPercent || 50}% discount applied)`
        : (activation.message || 'Proceed to payment gateway'),
    });
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

    const secret = getPaystackSecret();

    if (secret && secret !== 'sk_test_example') {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      const data = await response.json();
      if (data.status && data.data) {
        const txStatus = String(data.data.status || '').toLowerCase();

        if (txStatus === 'success') {
          const result = await fulfillPaystackTransaction(data.data, {
            fallbackUserId: req.user?.id || null,
            isHistoricalSync: false,
          });

          if (!result.fulfilled) {
            return res.status(404).json({ message: 'Payment verified on Paystack, but matching user account was not found.' });
          }

          if (!result.wasAlreadySuccess && result.user) {
            sendSubscriptionConfirmationEmail(result.user, result.plan).catch((err) => {
              console.warn('Subscription confirmation email warning:', err?.message || err);
            });
          }

          return res.json({
            success: true,
            plan: result.plan,
            payment: result.payment,
            message: `Payment verified successfully! Your account has been upgraded to ${result.plan}.`,
          });
        }

        // Update payment status if it was abandoned/failed/pending
        const user = await findUserForPaystackTransaction(data.data, req.user?.id || null);
        if (user) {
          await prisma.payment.upsert({
            where: { reference },
            update: {
              status: txStatus.toUpperCase() || 'FAILED',
              currency: (data.data.currency || 'NGN').toUpperCase(),
            },
            create: {
              userId: user.id,
              amount: typeof data.data.amount === 'number' ? data.data.amount / 100 : 0,
              currency: (data.data.currency || 'NGN').toUpperCase(),
              provider: 'PAYSTACK',
              reference,
              status: txStatus.toUpperCase() || 'FAILED',
            },
          }).catch(() => {});
        }

        return res.status(400).json({
          message: `Transaction status on Paystack is "${data.data.status}". ${data.data.gateway_response || ''}`.trim(),
          status: txStatus.toUpperCase(),
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
      select: { subscriptionStatus: true, subscriptionPlan: true },
    });

    if (user.subscriptionPlan === 'FREE') {
      return res.status(400).json({ message: 'You are currently on the Free plan.' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          subscriptionStatus: 'CANCELLED',
        },
      }),
      prisma.subscription.updateMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          autoRenew: false,
        },
      }),
    ]);

    res.json({ message: 'Your subscription has been cancelled. It will remain active until the end of your billing cycle.' });
  } catch (error) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ message: 'Failed to cancel subscription.' });
  }
};

const getBillingHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Automatically reconcile recent Paystack transactions so test/live payments always appear immediately
    const syncInfo = await syncPaystackTransactions({ userId });

    const [payments, histories, activeSubscription] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.subscriptionHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { promotion: { select: { name: true, slug: true } } },
        take: 50,
      }),
      prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        include: { promotion: { select: { name: true, slug: true } } },
      }),
    ]);

    res.json({
      payments,
      histories,
      activeSubscription,
      paystackMode: syncInfo.mode,
    });
  } catch (error) {
    console.error('Get Billing History Error:', error);
    res.status(500).json({ message: 'Failed to retrieve billing history.' });
  }
};

const handlePaystackWebhook = async (req, res) => {
  try {
    const secret = getPaystackSecret();
    const hash = crypto
      .createHmac('sha512', secret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success' && event.data) {
      const metadata = event.data.metadata || {};

      if (metadata.paymentType === 'COHORT_ENROLLMENT' && metadata.groupId && metadata.studentId) {
        const reference = String(event.data.reference || '');
        const paidAmount = Number(event.data.amount || 0) / 100;
        const feePercent = 1.5;
        const platformFeeAmount = paidAmount * (feePercent / 100);
        const mentorPayoutAmount = paidAmount - platformFeeAmount;
        const currency = String(event.data.currency || 'NGN').toUpperCase();

        await prisma.payment.upsert({
          where: { reference },
          update: {
            amount: paidAmount,
            currency,
            provider: 'PAYSTACK',
            status: 'SUCCESS',
            paidAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
          },
          create: {
            userId: metadata.studentId,
            amount: paidAmount,
            currency,
            provider: 'PAYSTACK',
            reference,
            status: 'SUCCESS',
            paidAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
          },
        }).catch(() => {});

        await prisma.userSettings.upsert({
          where: { userId: metadata.studentId },
          update: { shareTradesWithMentor: true },
          create: { userId: metadata.studentId, shareTradesWithMentor: true },
        }).catch(() => {});

        await prisma.mentorStudent.upsert({
          where: {
            mentorGroupId_studentId: {
              mentorGroupId: metadata.groupId,
              studentId: metadata.studentId,
            },
          },
          update: {
            status: 'ACTIVE',
            paidAmount,
            currency,
            platformFeeAmount,
            mentorPayoutAmount,
            paymentReference: reference,
            paidAt: new Date(),
          },
          create: {
            mentorGroupId: metadata.groupId,
            studentId: metadata.studentId,
            status: 'ACTIVE',
            paidAmount,
            currency,
            platformFeeAmount,
            mentorPayoutAmount,
            paymentReference: reference,
            paidAt: new Date(),
          },
        }).catch((err) => console.warn('Cohort webhook fulfillment warning:', err?.message));
      } else {
        const result = await fulfillPaystackTransaction(event.data, {
          isHistoricalSync: false,
        });

        if (result.fulfilled) {
          console.log(`Payment confirmed and account upgraded for user ${result.user.id} (${result.plan})`);
          if (!result.wasAlreadySuccess && result.user) {
            sendSubscriptionConfirmationEmail(result.user, result.plan).catch((err) => {
              console.warn('Subscription webhook confirmation email warning:', err?.message || err);
            });
          }
        }
      }
    }

    res.status(200).send('Webhook Processed Successfully');
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).send('Webhook Processing Error');
  }
};

// @desc    Activate 14-day free trial for Mentor/Academy account
// @route   POST /api/subscriptions/mentor-trial/activate
// @access  Private (Authenticated users)
const activateMentorFreeTrial = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: { where: { status: 'ACTIVE' } }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // 1. Check if user already has an active full paid mentor subscription
    if (user.role === 'MENTOR' && user.subscriptionStatus === 'ACTIVE' && !user.mentorTrialExpiresAt) {
      return res.status(400).json({ message: 'You already have an active paid Mentor/Academy account.' });
    }

    // 2. Strict single-use protection: has user ever claimed or used the mentor free trial?
    let alreadyClaimed = Boolean(user.hasUsedMentorTrial || user.mentorTrialExpiresAt);

    if (!alreadyClaimed) {
      // Check historical subscriptions for any prior trial / promotional mentor records
      const priorTrialSub = await prisma.subscription.findFirst({
        where: {
          userId,
          plan: 'MENTOR',
          source: 'PROMOTION'
        }
      });
      if (priorTrialSub) alreadyClaimed = true;
    }

    if (!alreadyClaimed) {
      // Check audit history for previous redemption records
      const priorTrialHistory = await prisma.subscriptionHistory.findFirst({
        where: {
          userId,
          OR: [
            { notes: { contains: 'Trial', mode: 'insensitive' } },
            { reason: 'PROMOTION_REDEEMED', newPlan: 'MENTOR' }
          ]
        }
      });
      if (priorTrialHistory) alreadyClaimed = true;
    }

    if (alreadyClaimed) {
      if (!user.hasUsedMentorTrial) {
        await prisma.user.update({
          where: { id: userId },
          data: { hasUsedMentorTrial: true }
        }).catch(() => {});
      }
      return res.status(403).json({
        message: 'You have already used your 14-day Mentor free trial. Each user is strictly limited to one free trial.',
        code: 'TRIAL_ALREADY_USED',
        upgradePath: '/pricing/mentor'
      });
    }

    // 3. Exactly 14 days (two weeks) + 12 hours grace buffer
    const TRIAL_DAYS = 14;
    const GRACE_PERIOD_HOURS = 12;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const graceExpiresAt = new Date(expiresAt.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Cancel previous active subscriptions
      await tx.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'CANCELLED' }
      });

      // Create new trial subscription
      await tx.subscription.create({
        data: {
          userId,
          plan: 'MENTOR',
          status: 'ACTIVE',
          source: 'PROMOTION',
          startedAt: now,
          expiresAt: expiresAt,
          autoRenew: false,
        }
      });

      // Record subscription history
      await tx.subscriptionHistory.create({
        data: {
          userId,
          previousPlan: user.subscriptionPlan,
          newPlan: 'MENTOR',
          source: 'PROMOTION',
          reason: 'PROMOTION_REDEEMED',
          notes: '14-Day Free Mentor/Academy Trial activated (with 12-hour grace period)',
          changedBy: 'USER'
        }
      });

      // Upgrade user to MENTOR role and Private Cohort tier
      await tx.user.update({
        where: { id: userId },
        data: {
          role: 'MENTOR',
          subscriptionPlan: 'MENTOR',
          subscriptionStatus: 'ACTIVE',
          mentorTier: 'PRIVATE_COHORT',
          mentorMaxStudents: 50,
          mentorMaxCohorts: 2,
          hasUsedMentorTrial: true,
          mentorTrialExpiresAt: expiresAt,
        }
      });

      // Create in-app welcome notification
      const notif = await tx.notification.create({
        data: {
          type: 'SUBSCRIPTION',
          category: 'SUCCESS',
          title: '🎉 14-Day Mentor Free Trial Activated',
          message: `Welcome to the Mentor Workspace! You have 14 days of complimentary Private Cohort access (up to 50 students, 2 cohorts, and Strategy Risk Guards) ending on ${expiresAt.toLocaleDateString()}, plus a 12-hour grace buffer.`,
          actionUrl: '/mentor-workspace',
          senderId: 'SYSTEM'
        }
      });

      await tx.notificationRecipient.create({
        data: {
          notificationId: notif.id,
          userId,
          status: 'UNREAD'
        }
      });
    });

    res.json({
      success: true,
      message: 'Your 14-day Mentor Free Trial is now active! You can now create cohorts and invite students.',
      trialDays: TRIAL_DAYS,
      gracePeriodHours: GRACE_PERIOD_HOURS,
      expiresAt,
      graceExpiresAt,
      mentorTier: 'PRIVATE_COHORT',
      maxStudents: 50,
      maxCohorts: 2,
    });
  } catch (error) {
    console.error('activateMentorFreeTrial error:', error);
    res.status(500).json({ message: 'Failed to activate Mentor Free Trial.' });
  }
};

// @desc    Get mentor free trial status
// @route   GET /api/subscriptions/mentor-trial/status
// @access  Private
const getMentorTrialStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        hasUsedMentorTrial: true,
        mentorTrialExpiresAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const now = new Date();
    const GRACE_PERIOD_HOURS = 12;
    const GRACE_PERIOD_MS = GRACE_PERIOD_HOURS * 60 * 60 * 1000;

    let isTrialActive = false;
    let isInGracePeriod = false;
    let daysRemaining = 0;
    let graceHoursRemaining = 0;
    let graceExpiresAt = null;

    if (user.hasUsedMentorTrial && user.mentorTrialExpiresAt) {
      const trialExpiresAt = new Date(user.mentorTrialExpiresAt);
      graceExpiresAt = new Date(trialExpiresAt.getTime() + GRACE_PERIOD_MS);

      if (user.role === 'MENTOR' && user.subscriptionStatus === 'ACTIVE') {
        if (now < trialExpiresAt) {
          isTrialActive = true;
          daysRemaining = Math.max(0, Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
        } else if (now < graceExpiresAt) {
          isInGracePeriod = true;
          graceHoursRemaining = Math.max(0, Math.ceil((graceExpiresAt.getTime() - now.getTime()) / (60 * 60 * 1000)));
        }
      }
    }

    const canActivateTrial = !user.hasUsedMentorTrial && !user.mentorTrialExpiresAt && user.role !== 'MENTOR';

    res.json({
      hasUsedMentorTrial: user.hasUsedMentorTrial,
      isTrialActive,
      isInGracePeriod,
      mentorTrialExpiresAt: user.mentorTrialExpiresAt,
      graceExpiresAt,
      daysRemaining,
      graceHoursRemaining,
      gracePeriodHours: GRACE_PERIOD_HOURS,
      canActivateTrial,
    });
  } catch (error) {
    console.error('getMentorTrialStatus error:', error);
    res.status(500).json({ message: 'Failed to check trial status.' });
  }
};

module.exports = {
  initializeSubscription,
  verifySubscription,
  cancelSubscription,
  getBillingHistory,
  handlePaystackWebhook,
  fulfillPaystackTransaction,
  syncPaystackTransactions,
  getPaystackSecret,
  resolveClientUrl,
  activateMentorFreeTrial,
  getMentorTrialStatus,
};
