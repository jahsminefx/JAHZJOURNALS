const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateAccountLedgerSummary } = require('../utils/accountLedgerMath');

/**
 * Reconcile & Recalculate Trading Account Balance from Ground Truth Ledger:
 * accountBalance = openingBalance + sum(closedTrades.profitLossAmount) + netCashFlow(active AccountTransactions)
 */
const reconcileAccountBalance = async (accountId, tx = prisma, { force = false } = {}) => {
  if (!accountId) return null;

  const isExternalTx = tx !== prisma;

  try {
    const account = await tx.tradingAccount.findUnique({
      where: { id: accountId },
      include: {
        trades: {
          where: {
            OR: [
              { status: 'CLOSED' },
              { result: { in: ['WIN', 'LOSS', 'BREAKEVEN'] } },
            ],
          },
          select: { id: true, status: true, result: true, profitLossAmount: true },
        },
        accountTransactions: {
          where: { archivedAt: null },
          select: { id: true, type: true, direction: true, amount: true, signedAmount: true, archivedAt: true },
        },
      },
    });

    if (!account) return null;

    const activeTransactions = account.accountTransactions || [];
    const hasCashFlowTx = activeTransactions.some((entry) => entry.type !== 'OPENING_BALANCE');

    // For live MetaTrader cloud-connected accounts without explicit app cash-flow entries,
    // keep the live broker balance authoritative.
    if (!force && account.cloudAccountId && account.cloudSyncStatus === 'CONNECTED' && !hasCashFlowTx) {
      return Number(account.currentBalance || 0);
    }

    const summary = calculateAccountLedgerSummary({
      account,
      trades: account.trades || [],
      transactions: activeTransactions,
    });
    const correctCurrentBalance = summary.accountBalance;
    const currentBalanceNum = Number(account.currentBalance || 0);

    // If currentBalance deviates from ground truth, update it in DB
    if (Math.abs(currentBalanceNum - correctCurrentBalance) > 0.001) {
      await tx.tradingAccount.update({
        where: { id: accountId },
        data: { currentBalance: correctCurrentBalance },
      });
      account.currentBalance = correctCurrentBalance;
    }

    return correctCurrentBalance;
  } catch (error) {
    console.error(`Error reconciling balance for account ${accountId}:`, error);
    if (isExternalTx) {
      throw error;
    }
    return null;
  }
};

/**
 * Reconcile all accounts for a specific user
 */
const reconcileUserAccounts = async (userId, tx = prisma) => {
  if (!userId) return;

  try {
    const accounts = await tx.tradingAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    for (const acc of accounts) {
      await reconcileAccountBalance(acc.id, tx);
    }
  } catch (error) {
    console.error(`Error reconciling user accounts for ${userId}:`, error);
  }
};

module.exports = {
  reconcileAccountBalance,
  reconcileUserAccounts,
};
