const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promotion = await prisma.promotion.findUnique({ where: { slug: 'founding-trader' } });
  if (!promotion) throw new Error('Founding Trader promotion not found. Run seed first.');

  const existingActiveUsers = await prisma.user.findMany({
    where: { subscriptionPlan: { not: 'FREE' }, subscriptionStatus: 'ACTIVE' }
  });

  let migrated = 0;
  for (const user of existingActiveUsers) {
    const existingSub = await prisma.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' }
    });

    if (!existingSub || existingSub.source !== 'PROMOTION') {
      await prisma.$transaction(async (tx) => {
        if (existingSub) {
          await tx.subscription.update({
            where: { id: existingSub.id },
            data: { source: 'PROMOTION', promotionId: promotion.id }
          });
        } else {
          await tx.subscription.create({
            data: {
              userId: user.id,
              plan: user.subscriptionPlan,
              status: 'ACTIVE',
              source: 'PROMOTION',
              promotionId: promotion.id,
              autoRenew: false
            }
          });
        }

        await tx.subscriptionHistory.create({
          data: {
            userId: user.id,
            previousPlan: 'FREE',
            newPlan: user.subscriptionPlan,
            source: 'PROMOTION',
            reason: 'ADMIN_GRANTED',
            promotionId: promotion.id,
            changedBy: 'SYSTEM'
          }
        });

        if (promotion.badgeId) {
          const badgeExists = await tx.userBadge.findUnique({
            where: { userId_badgeId: { userId: user.id, badgeId: promotion.badgeId } }
          });
          if (!badgeExists) {
            await tx.userBadge.create({
              data: { userId: user.id, badgeId: promotion.badgeId }
            });
          }
        }
      });
      migrated++;
    }
  }
  console.log(`Migrated ${migrated} users to PROMOTION source using the Founding Trader campaign.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
