const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');

/**
 * GET /api/promotions/available
 * Returns live, eligible promotions for the authenticated trader.
 */
const getAvailablePromotions = async (req, res) => {
  try {
    const userId = req.user.id;
    const userPlan = req.user.subscriptionPlan || 'FREE';
    const now = new Date();

    // 1. Query active promotions within date bounds
    const activePromos = await prisma.promotion.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch user's previous promotion redemptions
    const userRedemptions = await prisma.subscriptionHistory.findMany({
      where: { userId, source: 'PROMOTION' },
      select: { promotionId: true }
    });
    const redeemedPromoIds = new Set(userRedemptions.map(r => r.promotionId).filter(Boolean));

    // 3. Filter and map user-safe objects
    const availablePromotions = activePromos
      .filter(p => {
        // Exclude if max redemptions reached
        if (p.maxRedemptions && p.currentRedemptions >= p.maxRedemptions) {
          return false;
        }
        return true;
      })
      .map(p => {
        const isRedeemed = redeemedPromoIds.has(p.id);
        const remainingRedemptions = p.maxRedemptions ? Math.max(0, p.maxRedemptions - p.currentRedemptions) : null;
        
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          planGranted: p.planGranted,
          benefits: p.benefits || [],
          category: p.category,
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          maxRedemptions: p.maxRedemptions,
          remainingRedemptions,
          isRedeemed,
          requiresInvite: p.requiresInvite,
          status: isRedeemed ? 'ALREADY_REDEEMED' : 'ACTIVE'
        };
      });

    res.json({ promotions: availablePromotions });
  } catch (error) {
    console.error('getAvailablePromotions error:', error);
    res.status(500).json({ message: 'Failed to fetch available promotions.' });
  }
};

/**
 * GET /api/promotions/my-redemptions
 * Returns all promotions redeemed by the authenticated trader.
 */
const getMyRedeemedPromotions = async (req, res) => {
  try {
    const userId = req.user.id;

    const histories = await prisma.subscriptionHistory.findMany({
      where: { userId, source: 'PROMOTION' },
      include: {
        promotion: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            planGranted: true,
            benefits: true,
            autoExpire: true,
            endsAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const redemptions = histories.map(h => ({
      historyId: h.id,
      promotionId: h.promotionId,
      name: h.promotion?.name || 'Promotional Grant',
      slug: h.promotion?.slug || 'promo',
      description: h.promotion?.description || '',
      planGranted: h.newPlan,
      redeemedAt: h.createdAt,
      autoExpire: h.promotion?.autoExpire || false,
      expiresAt: h.promotion?.endsAt || null
    }));

    res.json({ redemptions });
  } catch (error) {
    console.error('getMyRedeemedPromotions error:', error);
    res.status(500).json({ message: 'Failed to fetch redeemed promotions.' });
  }
};

/**
 * GET /api/promotions/:id
 * Returns specific promotion details & eligibility status for the trader.
 */
const getPromotionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const now = new Date();

    const promotion = await prisma.promotion.findFirst({
      where: {
        OR: [{ id }, { slug: id }]
      }
    });

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found.' });
    }

    const previousRedemption = await prisma.subscriptionHistory.findFirst({
      where: { userId, promotionId: promotion.id, source: 'PROMOTION' }
    });

    let status = 'ACTIVE';
    if (previousRedemption) {
      status = 'ALREADY_REDEEMED';
    } else if (!promotion.isActive) {
      status = 'INACTIVE';
    } else if (promotion.endsAt && new Date(promotion.endsAt) < now) {
      status = 'EXPIRED';
    } else if (promotion.startsAt && new Date(promotion.startsAt) > now) {
      status = 'SCHEDULED';
    } else if (promotion.maxRedemptions && promotion.currentRedemptions >= promotion.maxRedemptions) {
      status = 'FULLY_REDEEMED';
    }

    const remainingRedemptions = promotion.maxRedemptions ? Math.max(0, promotion.maxRedemptions - promotion.currentRedemptions) : null;

    res.json({
      id: promotion.id,
      name: promotion.name,
      slug: promotion.slug,
      description: promotion.description,
      planGranted: promotion.planGranted,
      benefits: promotion.benefits || [],
      category: promotion.category,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      maxRedemptions: promotion.maxRedemptions,
      remainingRedemptions,
      isRedeemed: !!previousRedemption,
      status
    });
  } catch (error) {
    console.error('getPromotionDetails error:', error);
    res.status(500).json({ message: 'Failed to fetch promotion details.' });
  }
};

/**
 * Helper: Executes atomic promo redemption
 */
async function executeRedemption(userId, promotionIdentifier, changedByEmail) {
  return await prisma.$transaction(async (tx) => {
    const promotion = await tx.promotion.findFirst({
      where: {
        OR: [{ id: promotionIdentifier }, { slug: promotionIdentifier.toLowerCase().trim() }]
      }
    });

    if (!promotion) {
      throw new Error('PROMOTION_NOT_FOUND');
    }

    if (!promotion.isActive) {
      throw new Error('PROMOTION_INACTIVE');
    }

    const now = new Date();
    if (promotion.endsAt && new Date(promotion.endsAt) < now) {
      throw new Error('PROMOTION_EXPIRED');
    }

    if (promotion.startsAt && new Date(promotion.startsAt) > now) {
      throw new Error('PROMOTION_FUTURE');
    }

    if (promotion.maxRedemptions && promotion.currentRedemptions >= promotion.maxRedemptions) {
      throw new Error('PROMOTION_LIMIT_EXCEEDED');
    }

    // Check duplicate redemption by user
    const existingRedemption = await tx.subscriptionHistory.findFirst({
      where: { userId, promotionId: promotion.id, source: 'PROMOTION' }
    });

    if (existingRedemption) {
      throw new Error('ALREADY_REDEEMED');
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    let activeSub = user.subscriptions[0];
    if (!activeSub) {
      activeSub = await tx.subscription.create({
        data: {
          userId,
          plan: user.subscriptionPlan || 'FREE',
          status: 'ACTIVE',
          source: 'PROMOTION'
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
        changedBy: changedByEmail
      }
    });

    await tx.promotion.update({
      where: { id: promotion.id },
      data: { currentRedemptions: { increment: 1 } }
    });

    await tx.user.update({
      where: { id: userId },
      data: { subscriptionPlan: promotion.planGranted, subscriptionStatus: 'ACTIVE' }
    });

    if (promotion.badgeId) {
      await tx.userBadge.create({
        data: { userId, badgeId: promotion.badgeId }
      }).catch(() => {});
    }

    // Create in-app notification confirming redemption
    const notif = await tx.notification.create({
      data: {
        type: 'PROMOTION',
        category: 'SUCCESS',
        title: `🎉 ${promotion.name} Unlocked!`,
        message: `Congratulations! You've successfully unlocked complimentary ${promotion.planGranted} tier access.`,
        actionUrl: '/pricing',
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

    return { subscription: updatedSub, promotion };
  });
}

/**
 * POST /api/promotions/:id/redeem
 * Direct trader redemption by promotion ID
 */
const redeemPromotionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await executeRedemption(userId, id, req.user.email);
    res.json({
      message: `🎉 Successfully unlocked ${result.promotion.planGranted} plan via ${result.promotion.name}!`,
      subscription: result.subscription,
      promotion: result.promotion
    });
  } catch (error) {
    if (error.message === 'PROMOTION_NOT_FOUND') return res.status(404).json({ message: 'Promotion not found.' });
    if (error.message === 'PROMOTION_INACTIVE') return res.status(400).json({ message: 'This promotion is currently inactive.' });
    if (error.message === 'PROMOTION_EXPIRED') return res.status(400).json({ message: 'This promotion has expired.' });
    if (error.message === 'PROMOTION_FUTURE') return res.status(400).json({ message: 'This promotion has not started yet.' });
    if (error.message === 'PROMOTION_LIMIT_EXCEEDED') return res.status(400).json({ message: 'Maximum redemptions reached for this promotion.' });
    if (error.message === 'ALREADY_REDEEMED') return res.status(400).json({ message: 'You have already redeemed this promotion.' });

    console.error('redeemPromotionById error:', error);
    res.status(500).json({ message: 'Failed to redeem promotion.' });
  }
};

/**
 * POST /api/promotions/redeem-code
 * Promo code entry redemption by code/slug
 */
const redeemPromotionByCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ message: 'Promo code is required.' });
    }

    const userId = req.user.id;
    const result = await executeRedemption(userId, code.trim(), req.user.email);

    res.json({
      message: `🎉 Code '${code.toUpperCase()}' successfully redeemed! You are now on the ${result.promotion.planGranted} plan.`,
      subscription: result.subscription,
      promotion: result.promotion
    });
  } catch (error) {
    if (error.message === 'PROMOTION_NOT_FOUND') return res.status(404).json({ message: 'Invalid promo code. Please check the spelling.' });
    if (error.message === 'PROMOTION_INACTIVE') return res.status(400).json({ message: 'This promo code is currently inactive.' });
    if (error.message === 'PROMOTION_EXPIRED') return res.status(400).json({ message: 'This promo code has expired.' });
    if (error.message === 'PROMOTION_FUTURE') return res.status(400).json({ message: 'This promo code is not active yet.' });
    if (error.message === 'PROMOTION_LIMIT_EXCEEDED') return res.status(400).json({ message: 'Maximum redemptions reached for this promo code.' });
    if (error.message === 'ALREADY_REDEEMED') return res.status(400).json({ message: 'You have already redeemed this promo code.' });

    console.error('redeemPromotionByCode error:', error);
    res.status(500).json({ message: 'Failed to redeem promo code.' });
  }
};

module.exports = {
  getAvailablePromotions,
  getMyRedeemedPromotions,
  getPromotionDetails,
  redeemPromotionById,
  redeemPromotionByCode
};
