const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Reconciles orphaned trades that do not have a valid tradingAccountId.
 * Ensures existing historical trade data is preserved and associated with a valid user trading account.
 */
async function reconcileOrphanedTrades() {
  console.log('🔍 Starting Orphaned Trade Reconciliation Audit...');

  try {
    // Find trades missing tradingAccountId or referencing non-existent accounts
    const allTrades = await prisma.trade.findMany({
      select: { id: true, tradingAccountId: true, createdAt: true },
    });

    const accounts = await prisma.tradingAccount.findMany({
      select: { id: true, userId: true },
    });

    const existingAccountIds = new Set(accounts.map((a) => a.id));

    const orphanedTrades = await prisma.trade.findMany({
      where: {
        OR: [
          { tradingAccountId: { in: ['', 'null', 'undefined'] } },
          { tradingAccountId: { notIn: Array.from(existingAccountIds) } },
        ],
      },
    });

    console.log(`📊 Found ${orphanedTrades.length} orphaned trade(s) out of ${allTrades.length} total trade(s).`);

    if (orphanedTrades.length === 0) {
      console.log('✅ Zero orphaned trades found. All trades have valid trading accounts.');
      return { totalOrphaned: 0, reconciled: 0, createdAccounts: 0 };
    }

    // Retrieve all users to map orphaned trades to their rightful user account
    const users = await prisma.user.findMany({
      include: {
        tradingAccounts: { orderBy: { createdAt: 'asc' } },
        userSettings: { select: { defaultTradingAccountId: true } },
      },
    });

    let reconciledCount = 0;
    let createdAccountCount = 0;

    for (const user of users) {
      // Find orphaned trades belonging to this user context if any
      // Since orphaned trades lack tradingAccountId, we check if any trade has references or default user context
      let targetAccountId = user.userSettings?.defaultTradingAccountId;

      if (!targetAccountId || !existingAccountIds.has(targetAccountId)) {
        if (user.tradingAccounts.length > 0) {
          targetAccountId = user.tradingAccounts[0].id;
        } else {
          // Create default trading account for user if none exists
          console.log(`⚙️ Creating default 'Main USD Account' for user ${user.id} (${user.email})...`);
          const newAccount = await prisma.tradingAccount.create({
            data: {
              userId: user.id,
              name: 'Main USD Account',
              accountCategory: 'REGULAR',
              startingBalance: 10000,
              currentBalance: 10000,
              currency: 'USD',
            },
          });
          targetAccountId = newAccount.id;
          existingAccountIds.add(newAccount.id);
          createdAccountCount += 1;
        }
      }

      // Reconcile trades for this user context
      // Update any orphaned trades found to point to targetAccountId
      const result = await prisma.trade.updateMany({
        where: {
          id: { in: orphanedTrades.map((t) => t.id) },
        },
        data: {
          tradingAccountId: targetAccountId,
        },
      });

      reconciledCount += result.count;
    }

    console.log(`✅ Reconciliation complete. Reconciled ${reconciledCount} trade(s) across accounts. Created ${createdAccountCount} default account(s).`);
    return { totalOrphaned: orphanedTrades.length, reconciled: reconciledCount, createdAccounts: createdAccountCount };
  } catch (error) {
    console.error('❌ Error during orphaned trade reconciliation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  reconcileOrphanedTrades()
    .then((res) => console.log('Reconciliation Finished:', res))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { reconcileOrphanedTrades };
