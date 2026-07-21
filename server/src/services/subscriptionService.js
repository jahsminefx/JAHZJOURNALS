const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const determineActivationMethod = async (user, plan) => {
  const isLaunchMode = process.env.LAUNCH_MODE === 'true';

  if (isLaunchMode) {
    let promotion = await prisma.promotion.findFirst({
      where: { slug: 'founding-trader', isActive: true }
    });

    if (!promotion) {
      console.warn("Launch Mode is ON but 'founding-trader' promotion is missing. Proceeding to standard checkout.");
      return { method: 'PAYMENT', message: 'Proceed to payment gateway' };
    }

    const currentSub = await prisma.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' }
    });
    
    if (currentSub && currentSub.plan === plan) {
      return { method: 'ALREADY_ACTIVE', message: `You are already on the ${plan} plan.` };
    }

    await prisma.$transaction(async (tx) => {
      // Deactivate old subscription
      await tx.subscription.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' }
      });

      // Create new subscription
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: plan,
          status: 'ACTIVE',
          source: 'PROMOTION',
          promotionId: promotion.id,
          autoRenew: false
        }
      });

      // Create subscription history
      await tx.subscriptionHistory.create({
        data: {
          userId: user.id,
          previousPlan: user.subscriptionPlan,
          newPlan: plan,
          source: 'PROMOTION',
          reason: 'PROMOTION_REDEEMED',
          promotionId: promotion.id,
          changedBy: 'USER'
        }
      });

      // Update user detailing
      await tx.user.update({
        where: { id: user.id },
        data: {
          subscriptionPlan: plan,
          subscriptionStatus: 'ACTIVE'
        }
      });

      // Award badge if available
      if (promotion.badgeId) {
        const existingBadge = await tx.userBadge.findUnique({
          where: {
            userId_badgeId: { userId: user.id, badgeId: promotion.badgeId }
          }
        });
        if (!existingBadge) {
          await tx.userBadge.create({
            data: {
              userId: user.id,
              badgeId: promotion.badgeId
            }
          });
        }
      }
    });

    return { 
      method: 'PROMOTION', 
      message: `🎉 Welcome to the Founding Trader Program.\n\nYou've unlocked complimentary ${plan} access during the JAHZJOURNALS launch. Thank you for helping shape the future of the platform through your feedback and trading journey.` 
    };
  } else {
    return { method: 'PAYMENT', message: 'Proceed to payment gateway' };
  }
};

module.exports = {
  determineActivationMethod
};
