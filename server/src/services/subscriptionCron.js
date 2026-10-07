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
    // 1. Find all ACTIVE subscriptions with source 'PROMOTION'
    // that have expired either by explicit expiresAt OR because the linked promotion has ended/deactivated
    const candidateSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        source: 'PROMOTION'
      },
      include: {
        user: true,
        promotion: true
      }
    });

    for (const sub of candidateSubs) {
      let isExpired = false;

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
        // Check if the user has any other active non-promotional (PAYMENT or ADMIN) subscription that hasn't expired
        const activeNonPromotionalSub = await prisma.subscription.findFirst({
          where: {
            userId: sub.userId,
            id: { not: sub.id },
            status: 'ACTIVE',
            source: { in: ['PAYMENT', 'ADMIN'] },
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

          // If user does not have an active non-promotional subscription, downgrade them to FREE
          if (!activeNonPromotionalSub) {
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
        if (sub.user && !activeNonPromotionalSub) {
          sendSubscriptionExpiryEmail(sub.user, sub.plan).catch((err) => {
            console.warn(`[SUBSCRIPTION-SWEEPER] Failed to send expiry email to ${sub.user.email}:`, err?.message || err);
          });
        }
      }
    }

    // 2. Also check for upgraded users (PRO/STARTER/MENTOR) ensuring valid active subscription records exist
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
        if (s.source === 'PAYMENT' || s.source === 'ADMIN') {
          return !s.expiresAt || new Date(s.expiresAt) > now;
        }
        if (s.source === 'PROMOTION') {
          const promoExpired = s.promotion && ((s.promotion.endsAt && new Date(s.promotion.endsAt) <= now) || s.promotion.isActive === false);
          const subExpired = s.expiresAt && new Date(s.expiresAt) <= now;
          return !promoExpired && !subExpired;
        }
        return false;
      });

      if (!hasValidActiveSub) {
        if (u.subscriptions.length === 0) {
          // Provision default admin subscription rather than wiping their configured plan
          await prisma.subscription.create({
            data: {
              userId: u.id,
              plan: u.subscriptionPlan,
              status: 'ACTIVE',
              source: 'ADMIN'
            }
          });
        }
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
