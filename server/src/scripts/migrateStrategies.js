const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeName(name) {
  if (!name) return null;
  let normalized = name.trim();
  const lower = normalized.toLowerCase();

  // Common Strategy Normalization
  if (['ict', 'i.c.t.', 'i.c.t', 'ict strategy'].includes(lower)) return 'ICT';
  if (['smc', 'smart money', 'smart money concepts'].includes(lower)) return 'Smart Money Concepts';
  if (['sr', 's/r', 'support and resistance', 'support resistance'].includes(lower)) return 'Support & Resistance';

  // Common Setup Normalization
  if (['london open', 'london', 'lo', 'london session'].includes(lower)) return 'London Session';
  if (['new york', 'ny', 'new york open', 'nyo', 'new york session'].includes(lower)) return 'New York Session';
  if (['silver bullet', 'sb', 'ict sb'].includes(lower)) return 'Silver Bullet';
  if (['asian', 'asian range', 'asia'].includes(lower)) return 'Asian Session';

  // General fallback capitalization for other acronyms etc
  return normalized;
}

async function run() {
  console.log('Starting Strategy Data Migration...');
  const users = await prisma.user.findMany();

  let unassignedCount = 0;
  let mappedCount = 0;

  for (const user of users) {
    const trades = await prisma.trade.findMany({
      where: { tradingAccount: { userId: user.id } },
      include: { tradingAccount: true },
    });

    if (trades.length === 0) continue;

    // We'll store mapped instances in memory during this run to avoid duplicates
    // Key: strategyName, Value: Created Strategy ID
    const strategyMap = {}; 
    // Key: strategyId_setupName, Value: Created Setup ID
    const setupMap = {};
    
    // We will track the "Imported Fallback" dynamically per user if needed
    let fallbackStrategyId = null;
    let fallbackSetupId = null;

    for (const trade of trades) {
      let stratName = normalizeName(trade.strategyName);
      let setupName = normalizeName(trade.setupType);

      // If BOTH are missing, use imported fallback strategy.
      // If one is present, we still map gracefully.
      if (!stratName && !setupName) {
        if (!fallbackStrategyId) {
          const fallbackStrat = await prisma.strategy.create({
            data: {
              userId: user.id,
              name: 'Imported Strategy',
              description: 'Automatically grouped imported trades that had no strategy specified.',
              isImported: true,
            }
          });
          fallbackStrategyId = fallbackStrat.id;
          
          const fallbackSetup = await prisma.setup.create({
            data: {
              strategyId: fallbackStrategyId,
              name: 'Imported Setup',
              isImported: true,
            }
          });
          fallbackSetupId = fallbackSetup.id;
        }

        await prisma.trade.update({
          where: { id: trade.id },
          data: {
            strategyId: fallbackStrategyId,
            setupId: fallbackSetupId,
          }
        });
        unassignedCount++;
        continue;
      }

      // If user only provided a setup but no strategy name, we group it under "Imported Strategies"
      let currentStrategyId = null;
      if (stratName) {
        const stratKey = stratName.toLowerCase();
        if (!strategyMap[stratKey]) {
          const newStrat = await prisma.strategy.create({
            data: {
              userId: user.id,
              name: (stratKey === 'ict') ? 'ICT' : stratName, // Simple casing fallback
              isImported: true,
            }
          });
          strategyMap[stratKey] = newStrat.id;
        }
        currentStrategyId = strategyMap[stratKey];
      } else {
        // Fallback strategy grouping for named setups without strategy names
        if (!fallbackStrategyId) {
           const fallbackStrat = await prisma.strategy.create({
              data: {
                userId: user.id,
                name: 'Imported Strategy (Uncategorized)',
                isImported: true,
              }
           });
           fallbackStrategyId = fallbackStrat.id;
        }
        currentStrategyId = fallbackStrategyId;
      }

      // Handle setups mapping
      let currentSetupId = null;
      if (setupName) {
        const setupKey = `${currentStrategyId}_${setupName.toLowerCase()}`;
        if (!setupMap[setupKey]) {
           const newSetup = await prisma.setup.create({
             data: {
               strategyId: currentStrategyId,
               name: (setupName.toLowerCase() === 'london session') ? 'London Session' : setupName,
               isImported: true,
             }
           });
           setupMap[setupKey] = newSetup.id;
        }
        currentSetupId = setupMap[setupKey];
      }

      await prisma.trade.update({
        where: { id: trade.id },
        data: {
          strategyId: currentStrategyId,
          setupId: currentSetupId,
        }
      });
      mappedCount++;
    }
  }

  console.log(`Migration Complete. Mapped ${mappedCount} trades to normalized logic, and ${unassignedCount} completely blank trades to fallback Imported groups.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
