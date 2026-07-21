const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const startSubscriptionCron = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily subscription expiry check...');
    try {
      const now = new Date();
      // Find all ACTIVE PROMOTION subscriptions that have expired
      const expiredSubs = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          source: 'PROMOTION',
          expiresAt: { lte: now }
        },
        include: { user: true }
      });

      for (const sub of expiredSubs) {
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED' }
          });

          await tx.subscriptionHistory.create({
            data: {
              userId: sub.userId,
              previousPlan: sub.plan,
              newPlan: 'FREE',
              source: 'PROMOTION',
              reason: 'PROMOTION_EXPIRED',
              changedBy: 'SYSTEM'
            }
          });

          await tx.user.update({
            where: { id: sub.userId },
            data: { subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' }
          });
        });
        console.log(`Expired promotional subscription for user ${sub.userId}`);
        
        // Next: queue email or in-app notification for expiry
      }
    } catch (e) {
      console.error('Error in subscription cron:', e);
    }
  });
};

module.exports = { startSubscriptionCron };
