const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const { determineActivationMethod } = require('../services/subscriptionService');
const { getQuotaSummary } = require('../services/entitlementService');
const { sendSubscriptionConfirmationEmail } = require('../services/emailService');
const {
  isInternationalCheckoutEnabled,
  REGIONS,
  REGIONAL_PRICES,
  resolveRegion,
  getPriceById,
  getTraderPricesForRegion,
  getMentorPricesForRegion,
  getDefaultPriceForPlan,
  validatePriceSelection,
  detectCountry,
} = require('../config/pricingCatalogue');
const { resolveRegionalPricing } = require('../services/regionalPricingResolver');
const paymentGatewayFactory = require('../services/billing/paymentGatewayFactory');

const getPaystackSecret = () => (process.env.PAYSTACK_SECRET_KEY || '').trim();

const getPlanMappings = () => ({
  STARTER: { amountInKobo: 400000, planCode: process.env.PAYSTACK_STARTER_PLAN },
  PRO: { amountInKobo: 850000, planCode: process.env.PAYSTACK_PRO_PLAN },
  PRO_SYNC: { amountInKobo: 3800000, planCode: process.env.PAYSTACK_PRO_SYNC_PLAN || process.env.PAYSTACK_SYNC_PLUS_PLAN },
  MENTOR_PRIVATE_COHORT: { amountInKobo: 1450000, planCode: process.env.PAYSTACK_MENTOR_PRIVATE_COHORT_PLAN },
  MENTOR_GROWTH: { amountInKobo: 2500000, planCode: process.env.PAYSTACK_MENTOR_GROWTH_PLAN || process.env.PAYSTACK_MENTOR_PLAN },
  MENTOR_MEGA: { amountInKobo: 8500000, planCode: process.env.PAYSTACK_MENTOR_MEGA_PLAN },
  MENTOR: { amountInKobo: 2500000, planCode: process.env.PAYSTACK_MENTOR_PLAN || process.env.PAYSTACK_MENTOR_GROWTH_PLAN },
});

const PLAN_RANK = {
  FREE: 1,
  STARTER: 2,
  PRO: 3,
  PRO_SYNC: 4,
  MENTOR: 6,
};

const VALID_PLANS = new Set(['FREE', 'STARTER', 'PRO', 'PRO_SYNC', 'MENTOR']);

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
  if (metadata.plan && VALID_PLANS.has(String(metadata.plan).toUpperCase())) {
    return String(metadata.plan).toUpperCase();
  }
  if (metadata.requestedPlan && VALID_PLANS.has(String(metadata.requestedPlan).toUpperCase())) {
    return String(metadata.requestedPlan).toUpperCase();
  }
  if (metadata.priceId) {
    const priceRecord = getPriceById(metadata.priceId);
    if (priceRecord && VALID_PLANS.has(priceRecord.planId)) {
      return priceRecord.planId;
    }
  }
  const planObjName = txData?.plan_object?.name ? String(txData.plan_object.name).toUpperCase() : '';
  if (VALID_PLANS.has(planObjName)) {
    return planObjName;
  }
  const currency = (txData?.currency || 'NGN').toUpperCase();
  const amountMinor = typeof txData?.amount === 'number' ? txData.amount : 0;
  if (currency === 'USD') {
    const amountUsd = amountMinor > 200 ? amountMinor / 100 : amountMinor;
    if (amountUsd >= 40) return 'MENTOR';
    if (amountUsd >= 30) return 'ELITE';
    if (amountUsd >= 20) return 'PRO_SYNC';
    return 'STARTER';
  } else {
    // NGN
    const amountNgn = amountMinor > 1000 ? amountMinor / 100 : amountMinor;
    if (metadata.studentCount || amountNgn >= 50000) return 'MENTOR';
    if (amountNgn >= 30000) return 'SYNC_PLUS';
    if (amountNgn >= 6000) return 'PRO';
    return 'STARTER';
  }
};

/**
 * Idempotently records a successful payment across:
 * 1) prisma.payment (status: 'SUCCESS')
 * 2) prisma.user (subscriptionPlan & subscriptionStatus = 'ACTIVE')
 * 3) prisma.subscription (ACTIVE record with priceId, currency, provider)
 * 4) prisma.subscriptionHistory (audit trail)
 */
const fulfillSubscriptionPayment = async (txData, options = {}) => {
  const { fallbackUserId = null, isHistoricalSync = false, provider = 'PAYSTACK' } = options;
  const reference = txData?.reference || txData?.id;
  if (!reference) {
    throw new Error('Missing transaction reference/ID in payment payload');
  }

  const user = await findUserForPaystackTransaction(txData, fallbackUserId);
  if (!user) {
    return { fulfilled: false, reason: 'USER_NOT_FOUND', reference };
  }

  const requestedPlan = inferPlanFromTransaction(txData);
  const metadata = txData?.metadata && typeof txData.metadata === 'object' ? txData.metadata : {};
  const priceId = metadata.priceId || null;
  const amount = typeof txData.amount === 'number'
    ? (txData.amount > 1000 && provider === 'PAYSTACK' ? txData.amount / 100 : (txData.amount > 200 && provider === 'STRIPE' ? txData.amount / 100 : txData.amount))
    : 0;
  const currency = (txData.currency || (provider === 'STRIPE' ? 'USD' : 'NGN')).toUpperCase();
  const paidAt = txData.paid_at || txData.paidAt ? new Date(txData.paid_at || txData.paidAt) : new Date();
  const channel = txData.channel || (provider === 'STRIPE' ? 'stripe_checkout' : 'card');
  const rawPromotionId = metadata.promotionId || null;

  let validPromotionId = null;
  if (rawPromotionId) {
    const promoExists = await prisma.promotion.findUnique({ where: { id: rawPromotionId }, select: { id: true } });
    if (promoExists) validPromotionId = promoExists.id;
  }

  const existingPayment = await prisma.payment.findUnique({ where: { reference } });
  const wasAlreadySuccess = existingPayment?.status === 'SUCCESS';

  // 1. Upsert Payment record
  const paymentRecord = await prisma.payment.upsert({
    where: { reference },
    update: {
      amount: amount > 0 ? amount : existingPayment?.amount || 0,
      currency,
      provider,
      status: 'SUCCESS',
      paidAt,
    },
    create: {
      userId: user.id,
      amount,
      currency,
      provider,
      reference,
      status: 'SUCCESS',
      paidAt,
      createdAt: txData.created_at ? new Date(txData.created_at) : paidAt,
    },
  });

  // 2. Active subscription update
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

    if (!user.billingCurrency) updateData.billingCurrency = currency;
    if (metadata.country && !user.billingCountry) updateData.billingCountry = metadata.country;

    if (effectivePlan === 'MENTOR') {
      const tierKey = metadata.mentorTier || (amount >= 85000 || (currency === 'USD' && amount >= 199) ? 'MEGA' : amount >= 25000 || (currency === 'USD' && amount >= 90) ? 'GROWTH' : 'PRIVATE_COHORT');
      updateData.role = 'MENTOR';
      updateData.mentorTier = tierKey;
      updateData.mentorMaxStudents = tierKey === 'MEGA' ? 1000 : tierKey === 'GROWTH' ? 200 : 80;
      updateData.mentorMaxCohorts = tierKey === 'MEGA' ? 100 : tierKey === 'GROWTH' ? 5 : 2;
    }

    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const subData = {
      plan: effectivePlan,
      status: 'ACTIVE',
      source: 'PAYMENT',
      autoRenew: true,
      paymentReference: reference,
      priceId: priceId || undefined,
      currency,
      provider,
      providerSubscriptionId: options.providerSubscriptionId || metadata.subscriptionId || undefined,
      providerCustomerId: options.providerCustomerId || metadata.customerId || undefined,
      promotionId: validPromotionId,
      startedAt: paidAt,
      expiresAt,
    };

    if (currentSub) {
      await prisma.subscription.update({
        where: { id: currentSub.id },
        data: subData,
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          ...subData,
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
        notes: `${provider} payment of ${currency} ${amount.toLocaleString()} verified via ${channel} (Ref: ${reference})${studentNote}${discountNote}`,
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

const fulfillPaystackTransaction = async (txData, options = {}) => {
  return fulfillSubscriptionPayment(txData, { ...options, provider: 'PAYSTACK' });
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
    const { plan, priceId, country: requestedCountry, email, promoCode, studentCount, tier, gateway } = req.body;

    const userCountry = requestedCountry || req.user?.billingCountry || detectCountry(req);
    let resolvedPriceRecord = null;
    let targetPlanKey = plan;

    // 1. Resolve Price Record
    if (priceId) {
      const validation = validatePriceSelection({
        priceId,
        planId: plan,
        countryCode: userCountry,
      });

      if (!validation.valid) {
        return res.status(400).json({
          message: validation.message,
          reason: validation.reason,
        });
      }
      resolvedPriceRecord = validation.priceRecord;
      targetPlanKey = resolvedPriceRecord.planId;
    } else {
      if (!plan || !VALID_PLANS.has(String(plan).toUpperCase())) {
        return res.status(400).json({ message: 'Invalid subscription plan selected.' });
      }
      targetPlanKey = String(plan).toUpperCase();
      resolvedPriceRecord = getDefaultPriceForPlan(targetPlanKey, userCountry, tier);
      if (!resolvedPriceRecord) {
        return res.status(400).json({ message: `No active pricing found for plan "${plan}" in region "${userCountry}".` });
      }
    }

    let appliedPromo = null;
    let mentorStudentCount = null;
    let selectedMentorTier = null;

    if (targetPlanKey === 'MENTOR') {
      const parsed = parseInt(studentCount, 10);
      if (tier === 'GROWTH' || (!tier && parsed > 80 && parsed <= 200)) {
        selectedMentorTier = 'GROWTH';
        mentorStudentCount = 200;
      } else if (tier === 'MEGA' || (!tier && parsed > 200)) {
        selectedMentorTier = 'MEGA';
        mentorStudentCount = 1000;
      } else {
        selectedMentorTier = 'PRIVATE_COHORT';
        mentorStudentCount = 80;
      }
      resolvedPriceRecord = getDefaultPriceForPlan('MENTOR', userCountry, selectedMentorTier) || resolvedPriceRecord;
    }

    // 2. Promotion handling
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
        const isPlanApplicable = promoPlans.includes(targetPlanKey);

        if (isNotExpired && isStarted && hasRedemptions && isPlanApplicable) {
          if (promo.discountType === 'PERCENTAGE_DISCOUNT' || (promo.discountPercent && promo.discountPercent > 0 && promo.discountPercent < 100)) {
            appliedPromo = promo;
          }
        }
      }
    }

    const activation = await determineActivationMethod(req.user, targetPlanKey);

    if (!appliedPromo && activation.method === 'PROMOTION') {
      return res.json({ success: true, authorization_url: null, message: activation.message });
    }
    if (activation.method === 'ALREADY_ACTIVE' && (!appliedPromo || req.user.subscriptionPlan === targetPlanKey)) {
      return res.status(400).json({ message: activation.message });
    }

    const userEmail = email || req.user.email;
    const clientUrl = resolveClientUrl(req);

    // 2.5 Enforce International Checkout Gate
    if (resolvedPriceRecord && (resolvedPriceRecord.region === 'GLOBAL' || resolvedPriceRecord.currency !== 'NGN' || resolvedPriceRecord.provider === 'STRIPE')) {
      if (!isInternationalCheckoutEnabled()) {
        return res.status(403).json({
          success: false,
          error: 'INTERNATIONAL_CHECKOUT_DISABLED',
          message: 'International USD checkout is currently disabled. Active subscriptions are processed in Nigerian Naira (NGN) via Paystack.',
        });
      }
    }

    // 3. Resolve Gateway Adapter
    const preferredProvider = gateway ? String(gateway).toUpperCase() : resolvedPriceRecord.provider;
    const adapter = paymentGatewayFactory.getAdapter(preferredProvider);

    const checkoutSession = await adapter.createCheckoutSession({
      user: { id: req.user.id, email: userEmail },
      priceRecord: resolvedPriceRecord,
      planKey: targetPlanKey,
      clientUrl,
      promo: appliedPromo,
      metadata: {
        userId: req.user.id,
        userEmail: req.user.email,
        requestedPlan: targetPlanKey,
        priceId: resolvedPriceRecord.id,
        country: userCountry,
        mentorTier: selectedMentorTier || undefined,
        studentCount: mentorStudentCount || undefined,
        promotionId: appliedPromo ? appliedPromo.id : undefined,
        discountPercent: appliedPromo ? appliedPromo.discountPercent : undefined,
      },
    });

    if (checkoutSession.success && checkoutSession.reference) {
      await prisma.payment.upsert({
        where: { reference: checkoutSession.reference },
        update: {
          amount: checkoutSession.amountInMinor / 100,
          currency: checkoutSession.currency,
          provider: adapter.name,
        },
        create: {
          userId: req.user.id,
          amount: checkoutSession.amountInMinor / 100,
          currency: checkoutSession.currency,
          provider: adapter.name,
          reference: checkoutSession.reference,
          status: 'PENDING',
        },
      }).catch((err) => console.warn('Failed creating initial pending payment:', err?.message || err));

      return res.json({
        success: true,
        authorization_url: checkoutSession.authorizationUrl,
        reference: checkoutSession.reference,
        provider: adapter.name,
        currency: checkoutSession.currency,
        amountFormatted: resolvedPriceRecord.amountFormatted,
        priceId: resolvedPriceRecord.id,
        message: appliedPromo
          ? `${adapter.name} checkout initialized with ${appliedPromo.discountPercent}% discount!`
          : `${adapter.name} checkout initialized successfully.`,
      });
    }

    return res.status(400).json({
      message: 'Could not initialize checkout. Please check payment gateway configuration.',
    });
  } catch (error) {
    console.error('Subscription Init Error:', error);
    res.status(500).json({ message: error.message || 'Unable to initialize subscription at this time.' });
  }
};

const verifySubscription = async (req, res) => {
  try {
    const reference = req.params.reference || req.query.reference || req.query.session_id;
    if (!reference) {
      return res.status(400).json({ message: 'Transaction reference is required.' });
    }

    const providerKey = (reference.startsWith('cs_') || req.query.provider === 'stripe') ? 'STRIPE' : 'PAYSTACK';
    const adapter = paymentGatewayFactory.getAdapter(providerKey);

    const verificationResult = await adapter.verifyPayment(reference);

    if (verificationResult.success) {
      const result = await fulfillSubscriptionPayment(verificationResult.rawData || {
        reference: verificationResult.reference,
        amount: verificationResult.amount,
        currency: verificationResult.currency,
        metadata: verificationResult.metadata,
      }, {
        fallbackUserId: req.user?.id || null,
        provider: providerKey,
        providerSubscriptionId: verificationResult.providerSubscriptionId,
        providerCustomerId: verificationResult.providerCustomerId,
      });

      if (!result.fulfilled) {
        return res.status(404).json({ message: 'Payment verified, but matching user account was not found.' });
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

    return res.status(400).json({
      message: verificationResult.message || `Transaction status is "${verificationResult.status}".`,
      status: verificationResult.status,
    });
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
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody;

    if (!signature) {
      return res.status(400).send('Missing signature header');
    }

    if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
      return res.status(400).send('Missing raw request body for signature verification');
    }

    const paystackAdapter = paymentGatewayFactory.getAdapter('PAYSTACK');
    if (!paystackAdapter.verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const eventType = event.event || 'charge.success';
    const reference = event.data?.reference || `ref_${Date.now()}`;
    const eventId = `paystack_${eventType}_${reference}`;

    // Idempotency check using WebhookEvent
    const existingEvt = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvt && existingEvt.status === 'PROCESSED') {
      return res.status(200).send('Webhook Processed Successfully (Deduplicated)');
    }

    await prisma.webhookEvent.upsert({
      where: { eventId },
      update: { status: 'PROCESSING' },
      create: {
        provider: 'PAYSTACK',
        eventId,
        eventType,
        status: 'PROCESSING',
        payload: event,
      },
    }).catch(() => {});

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
        const result = await fulfillSubscriptionPayment(event.data, {
          isHistoricalSync: false,
          provider: 'PAYSTACK',
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

    await prisma.webhookEvent.update({
      where: { eventId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    }).catch(() => {});

    res.status(200).send('Webhook Processed Successfully');
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).send('Webhook Processing Error');
  }
};

const handleStripeWebhook = async (req, res) => {
  try {
    const stripeAdapter = paymentGatewayFactory.getAdapter('STRIPE');

    // Reject immediately if Stripe gateway is not configured
    if (!stripeAdapter.isConfigured()) {
      return res.status(503).json({ message: 'Stripe webhook receiver is unconfigured.' });
    }

    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody;

    if (!signature) {
      return res.status(400).send('Missing stripe-signature header');
    }

    if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0) || (typeof rawBody === 'string' && rawBody.trim() === '')) {
      return res.status(400).send('Missing raw request body');
    }

    const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    if (!stripeAdapter.verifyWebhookSignature(rawBodyString, signature)) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    if (!event || typeof event !== 'object') {
      return res.status(400).send('Malformed event payload');
    }

    const parsed = stripeAdapter.parseWebhookEvent(event);
    if (!parsed || !parsed.eventId) {
      return res.status(400).send('Invalid event structure');
    }

    const existingEvt = await prisma.webhookEvent.findUnique({
      where: { eventId: parsed.eventId },
    });

    if (existingEvt && existingEvt.status === 'PROCESSED') {
      return res.status(200).json({ received: true, deduplicated: true });
    }

    await prisma.webhookEvent.upsert({
      where: { eventId: parsed.eventId },
      update: { status: 'PROCESSING' },
      create: {
        provider: 'STRIPE',
        eventId: parsed.eventId,
        eventType: parsed.eventType,
        status: 'PROCESSING',
        payload: event,
      },
    }).catch(() => {});

    if (parsed.eventType === 'checkout.session.completed' || parsed.eventType === 'invoice.payment_succeeded') {
      await fulfillSubscriptionPayment(parsed.rawData, {
        provider: 'STRIPE',
        providerSubscriptionId: parsed.providerSubscriptionId,
        providerCustomerId: parsed.providerCustomerId,
      });
    } else if (parsed.eventType === 'customer.subscription.deleted') {
      const subId = parsed.providerSubscriptionId || parsed.reference;
      if (subId) {
        await prisma.subscription.updateMany({
          where: { providerSubscriptionId: subId },
          data: { status: 'CANCELLED', autoRenew: false },
        });
      }
    }

    await prisma.webhookEvent.update({
      where: { eventId: parsed.eventId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    }).catch(() => {});

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook processing error', { message: error.message });
    res.status(500).send('Webhook processing error');
  }
};

const getPricingCatalogueEndpoint = async (req, res) => {
  try {
    const resolution = await resolveRegionalPricing(req);

    res.json({
      success: true,
      ...resolution,
    });
  } catch (error) {
    console.error('getPricingCatalogue error:', error);
    res.status(500).json({ message: 'Failed to retrieve pricing catalogue.' });
  }
};

const setUserRegionEndpoint = async (req, res) => {
  try {
    const { country, currency } = req.body;
    if (!country) {
      return res.status(400).json({ message: 'Country code is required.' });
    }

    const cleanCountry = String(country).trim().toUpperCase();
    const region = resolveRegion(cleanCountry);
    const defaultCurrency = region === 'NG' ? 'NGN' : 'USD';
    const cleanCurrency = currency ? String(currency).trim().toUpperCase() : defaultCurrency;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        billingCountry: cleanCountry,
        billingCurrency: cleanCurrency,
      },
      select: {
        id: true,
        email: true,
        billingCountry: true,
        billingCurrency: true,
      },
    });

    res.json({
      success: true,
      user: updatedUser,
      region,
      message: `Billing region updated to ${cleanCountry} (${cleanCurrency}).`,
    });
  } catch (error) {
    console.error('setUserRegion error:', error);
    res.status(500).json({ message: 'Failed to update billing region.' });
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
          mentorMaxStudents: 80,
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
          title: '🎉 14-Day Private Cohort Free Trial Activated',
          message: `Welcome to the Mentor Workspace! You have 14 days of complimentary Private Cohort access (up to 80 students, 2 cohorts, and Strategy Risk Guards) ending on ${expiresAt.toLocaleDateString()}, plus a 12-hour grace buffer. Note: Free trials are exclusive to Private Cohort; Growth Community and Mega Academy require an active subscription.`,
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

const getSubscriptionEntitlements = async (req, res) => {
  try {
    const summary = await getQuotaSummary(req.user.id);
    res.json({
      success: true,
      entitlements: summary,
    });
  } catch (error) {
    console.error('getSubscriptionEntitlements error:', error);
    res.status(500).json({ message: 'Failed to retrieve subscription entitlements.' });
  }
};

module.exports = {
  PLAN_RANK,
  VALID_PLANS,
  initializeSubscription,
  verifySubscription,
  cancelSubscription,
  getBillingHistory,
  handlePaystackWebhook,
  handleStripeWebhook,
  getPricingCatalogueEndpoint,
  setUserRegionEndpoint,
  fulfillSubscriptionPayment,
  fulfillPaystackTransaction,
  syncPaystackTransactions,
  getPaystackSecret,
  resolveClientUrl,
  activateMentorFreeTrial,
  getMentorTrialStatus,
  getSubscriptionEntitlements,
};
