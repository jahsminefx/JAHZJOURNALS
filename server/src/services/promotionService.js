const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPromotionNotificationEmail } = require('./emailService');

/**
 * Service helper to dispatch in-app and email notifications for live promotions.
 */
const dispatchPromotionNotifications = async (promotion, options = {}) => {
  const { notifyInApp = true, notifyEmail = false } = options;

  if (!notifyInApp && !notifyEmail) return;
  if (!promotion.isActive) return;

  try {
    // Determine target eligible users
    let targetWhere = { isDisabled: false };
    if (promotion.planGranted === 'PRO' || promotion.planGranted === 'STARTER') {
      // Notify FREE users who can upgrade
      targetWhere.subscriptionPlan = 'FREE';
    }

    const eligibleUsers = await prisma.user.findMany({
      where: targetWhere,
      select: { id: true, email: true, name: true }
    });

    if (eligibleUsers.length === 0) return;

    // 1. Dispatch In-App Notifications
    if (notifyInApp) {
      // Check if notification already sent for this promotion to avoid duplicates
      const existingNotif = await prisma.notification.findFirst({
        where: {
          type: 'PROMOTION',
          actionUrl: `/promotions/${promotion.id}`
        }
      });

      if (!existingNotif) {
        const notif = await prisma.notification.create({
          data: {
            type: 'PROMOTION',
            category: 'INFO',
            title: `🎉 ${promotion.name}`,
            message: promotion.description || `Special promotion live! Use code ${promotion.slug.toUpperCase()} for ${promotion.planGranted} access.`,
            actionUrl: `/promotions/${promotion.id}`,
            senderId: 'SYSTEM'
          }
        });

        const recipients = eligibleUsers.map(u => ({
          notificationId: notif.id,
          userId: u.id,
          status: 'UNREAD'
        }));

        await prisma.notificationRecipient.createMany({
          data: recipients,
          skipDuplicates: true
        });
      }
    }

    // 2. Dispatch Brevo Email Notifications (Background/Async, never blocks caller)
    if (notifyEmail) {
      setImmediate(async () => {
        for (const user of eligibleUsers) {
          try {
            await sendPromotionNotificationEmail(user, promotion);
          } catch (e) {
            console.error(`[Email Dispatch Error] Failed sending promo email to ${user.email}:`, e.message);
          }
        }
      });
    }

    return { totalNotified: eligibleUsers.length };
  } catch (error) {
    console.error('[Promotion Notification Service Error]:', error);
  }
};

module.exports = {
  dispatchPromotionNotifications
};
