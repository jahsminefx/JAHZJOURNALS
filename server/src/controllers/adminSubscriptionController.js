const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');

const getSubscriptions = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, plan, status, source } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (plan) where.plan = plan;
    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          promotion: { select: { name: true, badge: { select: { name: true } } } }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.subscription.count({ where })
    ]);

    res.json({
      subscriptions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
};

const getSubscriptionMetrics = async (req, res) => {
  try {
    const totalSubs = await prisma.subscription.count();
    
    // Group by subscription record
    const planGroups = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { plan: true }
    });
    
    const statusGroups = await prisma.subscription.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    const sourceGroups = await prisma.subscription.groupBy({
      by: ['source'],
      _count: { source: true }
    });

    // Group by user table
    const userPlanGroups = await prisma.user.groupBy({
      by: ['subscriptionPlan'],
      _count: { subscriptionPlan: true }
    });

    const userPlans = {
      FREE: 0,
      STARTER: 0,
      PRO: 0,
      MENTOR: 0
    };
    userPlanGroups.forEach(g => {
      userPlans[g.subscriptionPlan] = g._count.subscriptionPlan;
    });

    const plans = {
      FREE: 0,
      STARTER: 0,
      PRO: 0,
      MENTOR: 0,
      ...planGroups.reduce((acc, curr) => ({ ...acc, [curr.plan]: curr._count.plan }), {})
    };

    res.json({
      totalSubs,
      plans,
      userPlans,
      statuses: statusGroups.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.status }), {}),
      sources: sourceGroups.reduce((acc, curr) => ({ ...acc, [curr.source]: curr._count.source }), {}),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch subscription metrics' });
  }
};

const getSubscriptionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        promotion: true
      }
    });

    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    const history = await prisma.subscriptionHistory.findMany({
      where: { userId: subscription.userId },
      include: { promotion: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ subscription, history });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch subscription details' });
  }
};

const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, status, source, expiresAt, autoRenew, paymentReference, promotionId, reason } = req.body;

    const currentSub = await prisma.subscription.findUnique({ where: { id } });
    if (!currentSub) return res.status(404).json({ message: 'Subscription not found' });

    const VALID_REASONS = ['PROMOTION_EXPIRED', 'ADMIN_GRANTED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'PROMOTION_REDEEMED', 'REFERRAL_REWARD', 'INITIAL_SIGNUP'];
    const isEnumReason = reason && VALID_REASONS.includes(reason);
    const historyReason = isEnumReason ? reason : 'ADMIN_GRANTED';
    const historyNotes = typeof reason === 'string' && reason.trim() ? reason.trim() : null;

    // Enforce history creation
    const newHistory = await prisma.subscriptionHistory.create({
      data: {
        userId: currentSub.userId,
        previousPlan: currentSub.plan,
        newPlan: plan || currentSub.plan,
        source: source || currentSub.source,
        reason: historyReason,
        notes: historyNotes,
        promotionId: promotionId !== undefined ? promotionId : currentSub.promotionId,
        paymentReference: paymentReference || currentSub.paymentReference,
        changedBy: req.user.email
      }
    });

    const updatedSub = await prisma.subscription.update({
      where: { id },
      data: {
        ...(plan && { plan }),
        ...(status && { status }),
        ...(source && { source }),
        ...(expiresAt !== undefined && { expiresAt }),
        ...(autoRenew !== undefined && { autoRenew }),
        ...(paymentReference !== undefined && { paymentReference }),
        ...(promotionId !== undefined && { promotionId })
      }
    });

    // Keep user table subscription state in sync
    await prisma.user.update({
      where: { id: currentSub.userId },
      data: {
        ...(plan && { subscriptionPlan: plan }),
        ...(status && { subscriptionStatus: status })
      }
    });

    // Write to generic Audit log as well
    await logAudit({
      adminId: req.user.id,
      action: 'ADMIN_UPDATE_SUBSCRIPTION',
      resource: 'Subscription',
      resourceId: id,
      oldValue: JSON.stringify(currentSub),
      newValue: JSON.stringify(updatedSub),
      ipAddress: req.ip
    });

    res.json({ message: 'Subscription updated successfully', subscription: updatedSub });
  } catch (error) {
    console.error('updateSubscription error:', error);
    res.status(500).json({ message: 'Failed to update subscription' });
  }
};

module.exports = {
  getSubscriptions,
  getSubscriptionMetrics,
  getSubscriptionDetails,
  updateSubscription
};
