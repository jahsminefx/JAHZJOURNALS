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
          user: { select: { id: true, name: true, email: true, createdAt: true, subscriptionPlan: true, subscriptionStatus: true } },
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
    console.error('getSubscriptions error:', error);
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
};

const getSubscriptionMetrics = async (req, res) => {
  try {
    const totalSubs = await prisma.subscription.count();
    
    // Group active subscriptions by plan
    const activePlanGroups = await prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: 'ACTIVE' },
      _count: { plan: true }
    });
    
    const statusGroups = await prisma.subscription.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    const sourceGroups = await prisma.subscription.groupBy({
      by: ['source'],
      where: { status: 'ACTIVE' },
      _count: { source: true }
    });

    // Group users by subscriptionPlan
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
      FREE: userPlans.FREE || 0,
      STARTER: userPlans.STARTER || 0,
      PRO: userPlans.PRO || 0,
      MENTOR: userPlans.MENTOR || 0,
      ...activePlanGroups.reduce((acc, curr) => ({ ...acc, [curr.plan]: curr._count.plan }), {})
    };

    res.json({
      totalSubs,
      plans,
      userPlans,
      statuses: statusGroups.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.status }), {}),
      sources: sourceGroups.reduce((acc, curr) => ({ ...acc, [curr.source]: curr._count.source }), {}),
    });
  } catch (error) {
    console.error('getSubscriptionMetrics error:', error);
    res.status(500).json({ message: 'Failed to fetch subscription metrics' });
  }
};

const getSubscriptionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true, subscriptionPlan: true, subscriptionStatus: true } },
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

    const newPlan = plan || currentSub.plan;
    const newStatus = status || currentSub.status;
    const newSource = source || (currentSub.source === 'PROMOTION' && plan && plan !== currentSub.plan ? 'ADMIN' : currentSub.source);
    const newPromotionId = promotionId !== undefined ? promotionId : (newSource !== 'PROMOTION' ? null : currentSub.promotionId);
    const resolvedExpiresAt = expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : currentSub.expiresAt;

    // Enforce history creation
    await prisma.subscriptionHistory.create({
      data: {
        userId: currentSub.userId,
        previousPlan: currentSub.plan,
        newPlan,
        source: newSource,
        reason: historyReason,
        notes: historyNotes,
        promotionId: newPromotionId,
        paymentReference: paymentReference || currentSub.paymentReference,
        changedBy: req.user.email
      }
    });

    const updatedSub = await prisma.subscription.update({
      where: { id },
      data: {
        plan: newPlan,
        status: newStatus,
        source: newSource,
        expiresAt: resolvedExpiresAt,
        ...(autoRenew !== undefined && { autoRenew }),
        ...(paymentReference !== undefined && { paymentReference }),
        promotionId: newPromotionId
      }
    });

    // Keep user table subscription state in sync
    const updatedUser = await prisma.user.update({
      where: { id: currentSub.userId },
      data: {
        subscriptionPlan: newPlan,
        subscriptionStatus: newStatus === 'SUSPENDED' ? 'INACTIVE' : newStatus
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true
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

    res.json({ message: 'Subscription updated successfully', subscription: updatedSub, user: updatedUser });
  } catch (error) {
    console.error('updateSubscription error:', error);
    res.status(500).json({ message: 'Failed to update subscription' });
  }
};

const updateUserSubscriptionDirect = async (req, res) => {
  try {
    const { id } = req.params; // userId
    const { plan, status = 'ACTIVE', reason = 'ADMIN_GRANTED', notes } = req.body;

    const VALID_PLANS = ['FREE', 'STARTER', 'PRO', 'MENTOR'];
    if (!plan || !VALID_PLANS.includes(plan)) {
      return res.status(400).json({ message: 'Invalid subscription plan specified.' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const previousPlan = user.subscriptionPlan;
    const activeSub = user.subscriptions.find(s => s.status === 'ACTIVE') || user.subscriptions[0];

    let subscription;
    if (activeSub) {
      subscription = await prisma.subscription.update({
        where: { id: activeSub.id },
        data: {
          plan,
          status,
          source: 'ADMIN',
          promotionId: null,
          expiresAt: null
        }
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          plan,
          status,
          source: 'ADMIN',
          expiresAt: null
        }
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: status === 'SUSPENDED' ? 'INACTIVE' : status
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true
      }
    });

    await prisma.subscriptionHistory.create({
      data: {
        userId: id,
        previousPlan,
        newPlan: plan,
        source: 'ADMIN',
        reason: 'ADMIN_GRANTED',
        notes: notes || `Direct admin update from ${previousPlan} to ${plan}`,
        changedBy: req.user.email
      }
    });

    await logAudit({
      adminId: req.user.id,
      action: 'ADMIN_SET_USER_PLAN',
      resource: 'User',
      resourceId: id,
      oldValue: previousPlan,
      newValue: plan,
      ipAddress: req.ip
    });

    res.json({
      message: `User subscription successfully updated to ${plan}.`,
      user: updatedUser,
      subscription
    });
  } catch (error) {
    console.error('updateUserSubscriptionDirect error:', error);
    res.status(500).json({ message: 'Failed to update user subscription plan.' });
  }
};

module.exports = {
  getSubscriptions,
  getSubscriptionMetrics,
  getSubscriptionDetails,
  updateSubscription,
  updateUserSubscriptionDirect
};

