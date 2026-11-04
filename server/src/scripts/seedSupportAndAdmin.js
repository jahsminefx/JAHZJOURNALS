const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 10);

  // 1. Support Role Demo Account
  const supportUser = await prisma.user.upsert({
    where: { email: 'support@jahzjournals.com' },
    update: {
      passwordHash: hash,
      role: 'SUPPORT',
      emailVerified: true,
      onboardingCompleted: true,
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      isDisabled: false,
    },
    create: {
      name: 'Demo Support Agent',
      email: 'support@jahzjournals.com',
      passwordHash: hash,
      role: 'SUPPORT',
      emailVerified: true,
      onboardingCompleted: true,
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      isDisabled: false,
    },
  });
  console.log(`✅ Support account ready: ${supportUser.email} (Role: ${supportUser.role})`);

  // 2. Admin Role Demo Account
  const adminUser = await prisma.user.upsert({
    where: { email: 'staffadmin@jahzjournals.com' },
    update: {
      passwordHash: hash,
      role: 'ADMIN',
      emailVerified: true,
      onboardingCompleted: true,
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      isDisabled: false,
    },
    create: {
      name: 'Demo Admin Manager',
      email: 'staffadmin@jahzjournals.com',
      passwordHash: hash,
      role: 'ADMIN',
      emailVerified: true,
      onboardingCompleted: true,
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      isDisabled: false,
    },
  });
  console.log(`✅ Admin account ready: ${adminUser.email} (Role: ${adminUser.role})`);

  // 3. Demo Trading Account for each
  for (const u of [supportUser, adminUser]) {
    const existingAcc = await prisma.tradingAccount.findFirst({ where: { userId: u.id } });
    if (!existingAcc) {
      await prisma.tradingAccount.create({
        data: {
          userId: u.id,
          name: `${u.role === 'SUPPORT' ? 'Support' : 'Admin'} Testing Desk`,
          brokerName: 'MetaQuotes Demo',
          accountType: 'DEMO',
          currency: 'USD',
          startingBalance: 10000,
          currentBalance: 10000,
        },
      });
      console.log(`✅ Created demo trading account for ${u.email}`);
    }
  }

  console.log('🎉 Successfully created/updated Support & Admin demo accounts.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding demo accounts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
