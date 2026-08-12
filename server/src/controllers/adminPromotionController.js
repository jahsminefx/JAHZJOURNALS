const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');
const { dispatchPromotionNotifications } = require('../services/promotionService');

const getPromotions = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, category, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status === 'ACTIVE') {
      where.isActive = true;
      where.startsAt = { lte: new Date() };
      where.OR = [{ endsAt: null }, { endsAt: { gte: new Date() } }];
    } else if (status === 'EXPIRED') {
      where.OR = [{ endsAt: { lt: new Date() }, endsAt: { not: null } }, { isActive: false }];
    } else if (status === 'SCHEDULED') {
      where.startsAt = { gt: new Date() };
      where.isActive = true;
    }

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.promotion.count({ where })
    ]);

    res.json({ promotions, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch promotions' });
  }
};

const getPromotionMetrics = async (req, res) => {
  try {
    const total = await prisma.promotion.count();
    const active = await prisma.promotion.count({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }]
      }
    });

    const scheduled = await prisma.promotion.count({
      where: { isActive: true, startsAt: { gt: new Date() } }
    });

    const expired = await prisma.promotion.count({
      where: { OR: [{ endsAt: { lt: new Date() }, endsAt: { not: null } }, { isActive: false }] }
    });

    const totalRedemptionsRes = await prisma.promotion.aggregate({ _sum: { currentRedemptions: true } });
    const totalRedeemed = totalRedemptionsRes._sum.currentRedemptions || 0;

    res.json({
      total,
      active,
      scheduled,
      expired,
      totalRedemptions: totalRedeemed
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch promotion metrics' });
  }
};

const getPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: { badge: true }
    });
    
    if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch promotion' });
  }
};

const createPromotion = async (req, res) => {
  try {
    const { name, slug, description, planGranted, category, benefits, isActive, startsAt, endsAt, requiresInvite, maxRedemptions, autoActivate, autoExpire, revokeBadgeOnExpiry } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required.' });
    }

    const VALID_PLANS = ['FREE', 'STARTER', 'PRO', 'MENTOR'];
    if (planGranted && !VALID_PLANS.includes(planGranted)) {
      return res.status(400).json({ message: `Invalid target plan. Must be one of: ${VALID_PLANS.join(', ')}` });
    }

    if (maxRedemptions !== null && maxRedemptions !== undefined && parseInt(maxRedemptions) <= 0) {
      return res.status(400).json({ message: 'Max redemptions must be greater than 0.' });
    }

    const startDate = startsAt ? new Date(startsAt) : null;
    const endDate = endsAt ? new Date(endsAt) : null;

    if (startDate && endDate && endDate <= startDate) {
      return res.status(400).json({ message: 'Expiration date must be after start date.' });
    }

    const cleanSlug = slug.toLowerCase().replace(/\s+/g, '-');
    const existing = await prisma.promotion.findUnique({ where: { slug: cleanSlug } });
    if (existing) return res.status(400).json({ message: 'Promotion slug already exists.' });

    const promotion = await prisma.promotion.create({
      data: {
        name,
        slug: cleanSlug,
        description,
        planGranted: planGranted || 'FREE',
        category: category || 'MARKETING',
        benefits: benefits || [],
        isActive: isActive !== undefined ? isActive : true,
        startsAt: startDate,
        endsAt: endDate,
        requiresInvite: !!requiresInvite,
        maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
        autoActivate: !!autoActivate,
        autoExpire: !!autoExpire,
        revokeBadgeOnExpiry: !!revokeBadgeOnExpiry
      }
    });

    await logAudit({
      adminId: req.user.id,
      action: 'CREATE_PROMOTION',
      resource: 'Promotion',
      resourceId: promotion.id,
      newValue: JSON.stringify(promotion),
      ipAddress: req.ip
    });

    const { notifyInApp = true, notifyEmail = false } = req.body;
    if (promotion.isActive) {
      dispatchPromotionNotifications(promotion, { notifyInApp, notifyEmail }).catch(err => {
        console.error('Failed dispatching promotion notifications:', err);
      });
    }

    res.status(201).json(promotion);
  } catch (error) {
    console.error('createPromotion error:', error);
    res.status(500).json({ message: 'Failed to create promotion.' });
  }
};

const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const oldPromo = await prisma.promotion.findUnique({ where: { id } });
    if (!oldPromo) return res.status(404).json({ message: 'Promotion not found' });

    if (updateData.maxRedemptions !== undefined && updateData.maxRedemptions !== null && parseInt(updateData.maxRedemptions) <= 0) {
      return res.status(400).json({ message: 'Max redemptions must be greater than 0.' });
    }

    const startDate = updateData.startsAt ? new Date(updateData.startsAt) : oldPromo.startsAt;
    const endDate = updateData.endsAt ? new Date(updateData.endsAt) : oldPromo.endsAt;

    if (startDate && endDate && endDate <= startDate) {
      return res.status(400).json({ message: 'Expiration date must be after start date.' });
    }

    if (updateData.startsAt) updateData.startsAt = new Date(updateData.startsAt);
    if (updateData.endsAt) updateData.endsAt = new Date(updateData.endsAt);
    if (updateData.maxRedemptions !== undefined) {
      updateData.maxRedemptions = updateData.maxRedemptions ? parseInt(updateData.maxRedemptions) : null;
    }

    const promotion = await prisma.promotion.update({
      where: { id },
      data: updateData
    });

    await logAudit({
      adminId: req.user.id,
      action: 'UPDATE_PROMOTION',
      resource: 'Promotion',
      resourceId: id,
      oldValue: JSON.stringify(oldPromo),
      newValue: JSON.stringify(promotion),
      ipAddress: req.ip
    });

    res.json(promotion);
  } catch (error) {
    console.error('updatePromotion error:', error);
    res.status(500).json({ message: 'Failed to update promotion.' });
  }
};

const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await prisma.promotion.findUnique({ where: { id } });
    
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    if (promo.currentRedemptions > 0) {
       const archived = await prisma.promotion.update({
         where: { id },
         data: { isActive: false, endsAt: new Date() }
       });
       
       await logAudit({ adminId: req.user.id, action: 'ARCHIVE_PROMOTION', resource: 'Promotion', resourceId: id, ipAddress: req.ip });
       return res.json({ message: 'Promotion has redemptions and was ARCHIVED securely.', promotion: archived });
    }

    await prisma.promotion.delete({ where: { id } });
    await logAudit({ adminId: req.user.id, action: 'DELETE_PROMOTION_EMPTY', resource: 'Promotion', resourceId: id, ipAddress: req.ip });
    
    res.json({ message: 'Unused promotion wiped.' });
  } catch(error) {
    res.status(500).json({ message: 'Failed to delete promotion.' });
  }
};

const grantPromotion = async (req, res) => {
  try {
    const { userId, promotionId, reason } = req.body;
    if (!userId || !promotionId) {
      return res.status(400).json({ message: 'User ID and Promotion ID are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.findUnique({ where: { id: promotionId } });
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { subscriptions: { where: { status: 'ACTIVE' } } }
      });

      if (!promotion || !user) {
        throw new Error('NOT_FOUND');
      }

      if (!promotion.isActive) {
        throw new Error('PROMOTION_INACTIVE');
      }

      if (promotion.endsAt && new Date(promotion.endsAt) < new Date()) {
        throw new Error('PROMOTION_EXPIRED');
      }

      if (promotion.startsAt && new Date(promotion.startsAt) > new Date()) {
        throw new Error('PROMOTION_FUTURE');
      }

      if (promotion.maxRedemptions && promotion.currentRedemptions >= promotion.maxRedemptions) {
        throw new Error('LIMIT_EXCEEDED');
      }

      let activeSub = user.subscriptions[0];
      if (!activeSub) {
        activeSub = await tx.subscription.create({
          data: {
            userId,
            plan: user.subscriptionPlan || 'FREE',
            status: 'ACTIVE',
            source: 'ADMIN'
          }
        });
      }

      const updatedSub = await tx.subscription.update({
        where: { id: activeSub.id },
        data: {
          plan: promotion.planGranted,
          source: 'PROMOTION',
          promotionId: promotion.id,
          ...(promotion.autoExpire && promotion.endsAt && { expiresAt: promotion.endsAt })
        }
      });

      await tx.subscriptionHistory.create({
        data: {
          userId,
          previousPlan: activeSub.plan,
          newPlan: promotion.planGranted,
          source: 'PROMOTION',
          reason: 'PROMOTION_REDEEMED',
          promotionId: promotion.id,
          changedBy: req.user.email
        }
      });

      await tx.promotion.update({
        where: { id: promotion.id },
        data: { currentRedemptions: { increment: 1 } }
      });

      await tx.user.update({
        where: { id: userId },
        data: { subscriptionPlan: promotion.planGranted }
      });

      if (promotion.badgeId) {
        await tx.userBadge.create({
          data: { userId, badgeId: promotion.badgeId }
        }).catch(() => {});
      }

      return updatedSub;
    });

    await logAudit({
      adminId: req.user.id,
      action: 'MANUAL_GRANT_PROMOTION',
      resource: 'Subscription',
      resourceId: result.id,
      newValue: JSON.stringify(result),
      ipAddress: req.ip
    });

    res.json({ message: 'Promotion successfully assigned.', subscription: result });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'User or Promotion missing' });
    }
    if (e.message === 'PROMOTION_INACTIVE') {
      return res.status(400).json({ message: 'Promotion is currently inactive.' });
    }
    if (e.message === 'PROMOTION_EXPIRED') {
      return res.status(400).json({ message: 'Promotion has expired.' });
    }
    if (e.message === 'PROMOTION_FUTURE') {
      return res.status(400).json({ message: 'Promotion has not started yet.' });
    }
    if (e.message === 'LIMIT_EXCEEDED') {
      return res.status(400).json({ message: 'Promotion max redemptions reached.' });
    }
    console.error('grantPromotion error:', e);
    res.status(500).json({ message: 'Engine failure evaluating assignment hook' });
  }
};

const getGranteesByPromotion = async (req, res) => {
   try {
     const { id } = req.params;
     const { page = 1, limit = 50 } = req.query;
     
     const [grants, total] = await Promise.all([
       prisma.subscriptionHistory.findMany({
         where: { promotionId: id, source: 'PROMOTION' },
         include: { user: { select: { id: true, name: true, email: true, subscriptionPlan: true } } },
         orderBy: { createdAt: 'desc' },
         skip: (page - 1) * limit, take: parseInt(limit)
       }),
       prisma.subscriptionHistory.count({ where: { promotionId: id, source: 'PROMOTION' } })
     ]);

     res.json({ grants, total, page: parseInt(page), totalPages: Math.ceil(total/limit) });
   } catch(e) {
     res.status(500).json({ message: 'Failed isolating historical grants' });
   }
};

const awardBadge = async (req, res) => {
  try {
    const { userId, badgeName, badgeId } = req.body;
    if (!userId || (!badgeName && !badgeId)) {
      return res.status(400).json({ message: 'userId and badgeName or badgeId are required.' });
    }

    let targetBadge = null;
    if (badgeId) {
      targetBadge = await prisma.badge.findUnique({ where: { id: badgeId } });
    } else {
      targetBadge = await prisma.badge.upsert({
        where: { name: badgeName },
        update: {},
        create: { name: badgeName, color: 'gold', description: `${badgeName} Awarded Badge` }
      });
    }

    if (!targetBadge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    const userBadge = await prisma.userBadge.upsert({
      where: {
        userId_badgeId: { userId, badgeId: targetBadge.id }
      },
      update: {},
      create: { userId, badgeId: targetBadge.id }
    });

    await logAudit({
      adminId: req.user.id,
      action: 'AWARD_BADGE',
      resource: 'UserBadge',
      resourceId: userBadge.id,
      newValue: JSON.stringify(userBadge),
      ipAddress: req.ip
    });

    res.json({ message: 'Badge successfully awarded.', userBadge });
  } catch (error) {
    console.error('awardBadge error:', error);
    res.status(500).json({ message: 'Failed to award badge' });
  }
};

const revokeBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body;
    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'userId and badgeId are required.' });
    }

    await prisma.userBadge.deleteMany({
      where: { userId, badgeId }
    });

    await logAudit({
      adminId: req.user.id,
      action: 'REVOKE_BADGE',
      resource: 'UserBadge',
      resourceId: `${userId}:${badgeId}`,
      ipAddress: req.ip
    });

    res.json({ message: 'Badge successfully revoked.' });
  } catch (error) {
    console.error('revokeBadge error:', error);
    res.status(500).json({ message: 'Failed to revoke badge' });
  }
};

module.exports = {
  getPromotions,
  getPromotionMetrics,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  grantPromotion,
  getGranteesByPromotion,
  awardBadge,
  revokeBadge
};

