const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');

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
    
    // Check if slug exists
    const existing = await prisma.promotion.findUnique({ where: { slug } });
    if (existing) return res.status(400).json({ message: 'Slug already extensively used.' });

    const promotion = await prisma.promotion.create({
      data: {
        name, slug, description, planGranted, category, benefits: benefits || [], isActive, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null,
        requiresInvite, maxRedemptions, autoActivate, autoExpire, revokeBadgeOnExpiry
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

    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create generic promotion.' });
  }
};

const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // formatting dates
    if (updateData.startsAt) updateData.startsAt = new Date(updateData.startsAt);
    if (updateData.endsAt) updateData.endsAt = new Date(updateData.endsAt);

    const oldPromo = await prisma.promotion.findUnique({ where: { id } });
    if (!oldPromo) return res.status(404).json({ message: 'Promotion missing' });

    const promotion = await prisma.promotion.update({
      where: { id },
      data: updateData
    });

    await logAudit({
      adminId: req.user.id, action: 'UPDATE_PROMOTION', resource: 'Promotion', resourceId: id,
      oldValue: JSON.stringify(oldPromo), newValue: JSON.stringify(promotion), ipAddress: req.ip
    });

    res.json(promotion);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update generic promotion.' });
  }
};

const deletePromotion = async (req, res) => {
  try {
    // Only SUPER_ADMIN allowed via routes. Should archive if used.
    const { id } = req.params;
    const promo = await prisma.promotion.findUnique({ where: { id } });
    
    if (!promo) return res.status(404).json({ message: 'Not found' });
    if (promo.currentRedemptions > 0) {
       // Must ARCHIVE instead
       const archived = await prisma.promotion.update({ where: { id }, data: { isActive: false, endsAt: new Date() } });
       
       await logAudit({ adminId: req.user.id, action: 'ARCHIVE_PROMOTION', resource: 'Promotion', resourceId: id, ipAddress: req.ip });
       return res.json({ message: 'Promotion has redemptions and was ARCHIVED securely.', promotion: archived });
    }

    await prisma.promotion.delete({ where: { id } });
    await logAudit({ adminId: req.user.id, action: 'DELETE_PROMOTION_EMPTY', resource: 'Promotion', resourceId: id, ipAddress: req.ip });
    
    res.json({ message: 'Unused promotion entirely wiped.' });
  } catch(error) {
    res.status(500).json({ message: 'Failed to delete.' });
  }
};

const grantPromotion = async (req, res) => {
  // Foundational promotional bridging mechanism utilizing existing subscription boundaries.
  try {
    const { userId, promotionId, reason } = req.body;
    
    const promotion = await prisma.promotion.findUnique({ where: { id: promotionId } });
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscriptions: { where: { status: 'ACTIVE' } } } });

    if (!promotion || !user) return res.status(404).json({ message: 'User or Promotion missing' });

    // Ensure redemptions limits
    if (promotion.maxRedemptions && promotion.currentRedemptions >= promotion.maxRedemptions) {
      return res.status(400).json({ message: 'Promotion max redemptions reached.' });
    }

    // Attempt to map onto existing subscription gracefully
    let activeSub = user.subscriptions[0];
    let createdSub = false;

    if (!activeSub) {
      // User literally has no active generic subscription edge case
      activeSub = await prisma.subscription.create({
        data: {
          userId,
          plan: user.subscriptionPlan || 'FREE',
          status: 'ACTIVE',
          source: 'ADMIN'
        }
      });
      createdSub = true;
    }

    // Force subscription injection
    const updatedSub = await prisma.subscription.update({
      where: { id: activeSub.id },
      data: {
        plan: promotion.planGranted,
        source: 'PROMOTION',
        promotionId: promotion.id,
        // Override the expiry gracefully
        ...(promotion.autoExpire && promotion.endsAt && { expiresAt: promotion.endsAt })
      }
    });

    // Write Subscription History securely
    await prisma.subscriptionHistory.create({
      data: {
        userId,
        previousPlan: activeSub.plan,
        newPlan: promotion.planGranted,
        source: 'PROMOTION',
        reason: reason || 'ADMIN_PROMOTION_GRANT_MANUAL',
        promotionId: promotion.id,
        changedBy: req.user.email
      }
    });

    // Increment promotion redemptions
    await prisma.promotion.update({
       where: { id: promotion.id },
       data: { currentRedemptions: { increment: 1 } }
    });

    // Also update User base struct bridging just in case global checks use legacy flags
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionPlan: promotion.planGranted }
    });

    // Optional Badge allocation if exists
    if (promotion.badgeId) {
       await prisma.userBadge.create({
         data: { userId, badgeId: promotion.badgeId }
       }).catch(() => {}); // Eat unique constraint bugs safely if user already has it
    }

    await logAudit({
      adminId: req.user.id, action: 'MANUAL_GRANT_PROMOTION', resource: 'Subscription', resourceId: activeSub.id,
      newValue: JSON.stringify(updatedSub), ipAddress: req.ip
    });

    res.json({ message: 'Promotion successfully assigned and bridged to existing mechanisms.', subscription: updatedSub });
  } catch(e) {
    console.error(e);
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
}

module.exports = {
  getPromotions,
  getPromotionMetrics,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  grantPromotion,
  getGranteesByPromotion
};
