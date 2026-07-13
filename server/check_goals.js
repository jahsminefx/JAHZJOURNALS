const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const goals = await prisma.tradingGoal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(goals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
