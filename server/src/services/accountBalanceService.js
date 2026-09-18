const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Reconcile & Recalculate Trading Account Balance from Ground Truth
 * groundTruthBalance = startingBalance + sum(closedTrades.profitLossAmount)
 */
const reconcileAccountBalance = async (accountId) => {
  if (!accountId) return null;

  try {
    const account = await prisma.tradingAccount.findUnique({
      where: { id: accountId },
      include: {
        trades: {
          where: { status: 'CLOSED' },
          select: { profitLossAmount: true },
        },
      },
    });

    if (!account) return null;

    const totalClosedPnl = account.trades.reduce(
      (sum, t) => sum + (Number(t.profitLossAmount) || 0),
      0
    );

    const startingBalance = Number(account.startingBalance || 0);
    const correctCurrentBalance = Math.round((startingBalance + totalClosedPnl) * 100) / 100;

    const currentBalanceNum = Number(account.currentBalance || 0);

    // If currentBalance deviates from ground truth, update it in DB
    if (Math.abs(currentBalanceNum - correctCurrentBalance) > 0.001) {
      await prisma.tradingAccount.update({
        where: { id: accountId },
        data: { currentBalance: correctCurrentBalance },
      });
      account.currentBalance = correctCurrentBalance;
    }

    return correctCurrentBalance;
  } catch (error) {
    console.error(`Error reconciling balance for account ${accountId}:`, error);
    return null;
  }
};

/**
 * Reconcile all accounts for a specific user
 */
const reconcileUserAccounts = async (userId) => {
  if (!userId) return;

  try {
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    for (const acc of accounts) {
      await reconcileAccountBalance(acc.id);
    }
  } catch (error) {
    console.error(`Error reconciling user accounts for ${userId}:`, error);
  }
};

module.exports = {
  reconcileAccountBalance,
  reconcileUserAccounts,
};
