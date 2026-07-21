const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const badge = await prisma.badge.upsert({
    where: { name: 'Founding Trader' },
    update: {},
    create: {
      name: 'Founding Trader',
      description: 'Awarded to early supporters of JAHZJOURNALS during the launch period.',
      color: 'gold',
      icon: 'medal'
    }
  });

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setFullYear(2026, 11, 31); // Dec 31, 2026

  await prisma.promotion.upsert({
    where: { slug: 'founding-trader' },
    update: {
      badgeId: badge.id,
      benefits: ['PRO Access', 'AI Features', 'Future Founder Pricing'],
      endsAt: endsAt
    },
    create: {
      name: 'Founding Trader Launch',
      slug: 'founding-trader',
      description: 'Early supporters receive complimentary premium access.',
      planGranted: 'PRO',
      isActive: true,
      requiresInvite: false,
      badgeId: badge.id,
      benefits: ['PRO Access', 'AI Features', 'Future Founder Pricing'],
      endsAt: endsAt
    }
  });

  console.log('Seeded Founding Trader Badge and Promotion successfully.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
