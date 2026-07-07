const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create test user
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@jahzjournals.com' },
    update: {},
    create: {
      name: 'Demo Trader',
      email: 'demo@jahzjournals.com',
      passwordHash,
      role: 'TRADER',
      mainTradingPairs: [],
      onboardingCompleted: true,
    },
  });

  // Create trading account
  const account = await prisma.tradingAccount.create({
    data: {
      userId: user.id,
      name: 'Main Personal Account',
      brokerName: 'ICMarkets',
      startingBalance: 10000,
      currentBalance: 10250,
      currency: 'USD',
      riskPerTradePercent: 1.0,
    }
  });

  // Create some trades
  await prisma.trade.create({
    data: {
      tradingAccountId: account.id,
      pair: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.0500,
      stopLoss: 1.0480,
      takeProfit: 1.0600,
      lotSize: 1.0,
      result: 'WIN',
      status: 'CLOSED',
      profitLossAmount: 250,
      setupType: 'FVG Reversal',
      session: 'LONDON',
      entryTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      exitTime: new Date()
    }
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
