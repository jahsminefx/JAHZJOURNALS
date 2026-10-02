const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendSubscriptionExpiryEmail } = require('./emailService');

/**
 * Sweeps and force-downgrades users whose promotional subscriptions or promotions have expired.
 * Can be called programmatically on startup, via cron, or via Super Admin API action.
 */
const sweepAndDowngradeExpiredPromotions = async () => {
  const now = new Date();
  console.log(`[SUBSCRIPTION-SWEEPER] Starting expired promotion & subscription check at ${now.toISOString()}...`);

  let expiredSubsCount = 0;
  let downgradedUsersCount = 0;
  const processedUsers = new Set();
  const summaryDetails = [];

  try {
    // 1. Find all ACTIVE subscriptions with source 'PROMOTION' or attached promotionId
    // that have expired either by explicit expiresAt OR because the linked promotion has ended/deactivated
    const candidateSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { source: 'PROMOTION' },
          { promotionId: { not: null } }
        ]
      },
      include: {
        user: true,
        promotion: true
      }
    });

    for (const sub of candidateSubs) {
      let isExpired = false;
      let expiryReason = 'PROMOTION_EXPIRED';

      // Check explicit expiresAt
      if (sub.expiresAt && new Date(sub.expiresAt) <= now) {
        isExpired = true;
      }
      // Check linked promotion endsAt
      else if (sub.promotion && sub.promotion.endsAt && new Date(sub.promotion.endsAt) <= now) {
        isExpired = true;
      }
      // Check linked promotion active status
      else if (sub.promotion && sub.promotion.isActive === false) {
        isExpired = true;
      }

      if (isExpired) {
        // Check if the user has any other active PAID subscription that hasn't expired
        const activePaidSub = await prisma.subscription.findFirst({
          where: {
            userId: sub.userId,
            id: { not: sub.id },
            source: 'PAYMENT',
            status: 'ACTIVE',
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } }
            ]
          }
        });

        await prisma.$transaction(async (tx) => {
          // Mark this promotional subscription as EXPIRED
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED' }
          });

          // If user does not have an active paid subscription, downgrade them to FREE
          if (!activePaidSub) {
            await tx.subscriptionHistory.create({
              data: {
                userId: sub.userId,
                previousPlan: sub.plan,
                newPlan: 'FREE',
                source: 'PROMOTION',
                reason: 'PROMOTION_EXPIRED',
                promotionId: sub.promotionId,
                changedBy: 'SYSTEM'
              }
            });

            await tx.user.update({
              where: { id: sub.userId },
              data: {
                subscriptionPlan: 'FREE',
                subscriptionStatus: 'ACTIVE'
              }
            });

            // If promotion specifies badge revocation on expiry
            if (sub.promotion?.revokeBadgeOnExpiry && sub.promotion?.badgeId) {
              await tx.userBadge.deleteMany({
                where: {
                  userId: sub.userId,
                  badgeId: sub.promotion.badgeId
                }
              }).catch(() => {});
            }

            downgradedUsersCount++;
            processedUsers.add(sub.userId);
            summaryDetails.push({
              userId: sub.userId,
              userEmail: sub.user?.email,
              previousPlan: sub.plan,
              promotionName: sub.promotion?.name || 'Promotional Upgrade'
            });
          }
        });

        expiredSubsCount++;

        // Send friendly notification email if user exists and was downgraded
        if (sub.user && !activePaidSub) {
          sendSubscriptionExpiryEmail(sub.user, sub.plan).catch((err) => {
            console.warn(`[SUBSCRIPTION-SWEEPER] Failed to send expiry email to ${sub.user.email}:`, err?.message || err);
          });
        }
      }
    }

    // 2. Also check for orphaned user plans (users who have PRO/STARTER/MENTOR but NO active subscription or only expired promo history)
    const upgradedUsers = await prisma.user.findMany({
      where: {
        subscriptionPlan: { in: ['STARTER', 'PRO', 'MENTOR'] },
        role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } // Keep admins untouched
      },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { promotion: true }
        }
      }
    });

    for (const u of upgradedUsers) {
      if (processedUsers.has(u.id)) continue;

      const hasValidActiveSub = u.subscriptions.some((s) => {
        if (s.source === 'PAYMENT') {
          return !s.expiresAt || new Date(s.expiresAt) > now;
        }
        if (s.source === 'PROMOTION' || s.promotionId) {
          const promoExpired = s.promotion && ((s.promotion.endsAt && new Date(s.promotion.endsAt) <= now) || s.promotion.isActive === false);
          const subExpired = s.expiresAt && new Date(s.expiresAt) <= now;
          return !promoExpired && !subExpired;
        }
        if (s.source === 'ADMIN') {
          return !s.expiresAt || new Date(s.expiresAt) > now;
        }
        return false;
      });

      if (!hasValidActiveSub && u.subscriptions.length === 0) {
        // User has upgraded plan but 0 active subscriptions, downgrade to FREE
        await prisma.$transaction(async (tx) => {
          await tx.subscriptionHistory.create({
            data: {
              userId: u.id,
              previousPlan: u.subscriptionPlan,
              newPlan: 'FREE',
              source: 'PROMOTION',
              reason: 'PROMOTION_EXPIRED',
              changedBy: 'SYSTEM'
            }
          });

          await tx.user.update({
            where: { id: u.id },
            data: {
              subscriptionPlan: 'FREE',
              subscriptionStatus: 'ACTIVE'
            }
          });
        });

        downgradedUsersCount++;
        processedUsers.add(u.id);
        summaryDetails.push({
          userId: u.id,
          userEmail: u.email,
          previousPlan: u.subscriptionPlan,
          promotionName: 'Orphaned/Expired Plan'
        });
      }
    }

    console.log(`[SUBSCRIPTION-SWEEPER] Completed sweep. Expired ${expiredSubsCount} subscription(s), downgraded ${downgradedUsersCount} trader(s) back to FREE.`);
    return {
      success: true,
      expiredSubscriptionsCount: expiredSubsCount,
      downgradedUsersCount: downgradedUsersCount,
      details: summaryDetails,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[SUBSCRIPTION-SWEEPER] Error during subscription expiry sweep:', error);
    return {
      success: false,
      error: error.message,
      expiredSubscriptionsCount: expiredSubsCount,
      downgradedUsersCount: downgradedUsersCount
    };
  }
};

/**
 * Starts automated cron job for subscription & promotion expiration checks.
 * Runs every 10 minutes to catch promotions the moment they expire.
 */
const startSubscriptionCron = () => {
  // Initial sweep upon server boot
  sweepAndDowngradeExpiredPromotions().catch((err) => {
    console.warn('[SUBSCRIPTION-CRON] Initial boot sweep warning:', err?.message || err);
  });

  // Schedule to run every 10 minutes: '*/10 * * * *'
  cron.schedule('*/10 * * * *', async () => {
    try {
      await sweepAndDowngradeExpiredPromotions();
    } catch (e) {
      console.error('[SUBSCRIPTION-CRON] Error in recurring subscription sweep:', e);
    }
  });

  console.log('[SUBSCRIPTION-CRON] Recurring promotion expiry sweeper initialized (every 10m).');
};

module.exports = {
  startSubscriptionCron,
  sweepAndDowngradeExpiredPromotions
};
