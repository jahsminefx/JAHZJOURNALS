const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const roundMoney = (val) => {
  const rounded = Math.round((Number(val) || 0) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const closedResults = new Set(['WIN', 'LOSS', 'BREAKEVEN']);
const isClosedTrade = (trade) => {
  const status = String(trade?.status || '').toUpperCase();
  const result = String(trade?.result || '').toUpperCase();
  if (status === 'CLOSED') return true;
  return closedResults.has(result);
};

/**
 * Safely creates idempotent OPENING_BALANCE ledger rows for existing TradingAccounts
 * without creating guessed deposits/withdrawals or modifying trade history.
 */
const backfillOpeningBalanceTransactions = async (prismaClient, { dryRun = false } = {}) => {
  const accounts = await prismaClient.tradingAccount.findMany({
    include: {
      trades: {
        select: { id: true, status: true, result: true, profitLossAmount: true },
      },
      accountTransactions: {
        where: { archivedAt: null },
        select: { id: true, type: true, signedAmount: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const summary = {
    totalAccounts: accounts.length,
    createdOpeningBalances: 0,
    alreadyPresent: 0,
    skippedZeroBalance: 0,
    legacyBalanceDiscrepancies: [],
  };

  for (const account of accounts) {
    const existingOpening = (account.accountTransactions || []).find((tx) => tx.type === 'OPENING_BALANCE');
    const startingBalance = roundMoney(account.startingBalance || 0);
    const realisedPnl = roundMoney(
      (account.trades || [])
        .filter(isClosedTrade)
        .reduce((sum, trade) => sum + (Number(trade.profitLossAmount) || 0), 0)
    );
    const nonOpeningNet = roundMoney(
      (account.accountTransactions || [])
        .filter((tx) => tx.type !== 'OPENING_BALANCE')
        .reduce((sum, tx) => sum + (Number(tx.signedAmount) || 0), 0)
    );
    const expectedBalance = roundMoney(startingBalance + realisedPnl + nonOpeningNet);
    const currentBalance = roundMoney(account.currentBalance || 0);
    const discrepancy = roundMoney(currentBalance - expectedBalance);

    if (Math.abs(discrepancy) > 0.009) {
      summary.legacyBalanceDiscrepancies.push({
        accountId: account.id,
        accountName: account.name,
        userId: account.userId,
        startingBalance,
        realisedPnl,
        nonOpeningNet,
        expectedBalance,
        recordedCurrentBalance: currentBalance,
        discrepancy,
      });
    }

    if (existingOpening) {
      summary.alreadyPresent += 1;
      continue;
    }

    if (startingBalance === 0) {
      summary.skippedZeroBalance += 1;
      continue;
    }

    if (!dryRun) {
      await prismaClient.accountTransaction.upsert({
        where: {
          userId_idempotencyKey: {
            userId: account.userId,
            idempotencyKey: `backfill:opening:${account.id}`,
          },
        },
        update: {},
        create: {
          userId: account.userId,
          tradingAccountId: account.id,
          type: 'OPENING_BALANCE',
          direction: startingBalance >= 0 ? 'INFLOW' : 'OUTFLOW',
          amount: Math.abs(startingBalance),
          signedAmount: startingBalance,
          currency: account.currency || 'USD',
          occurredAt: account.createdAt || new Date(),
          note: 'Opening balance baseline',
          idempotencyKey: `backfill:opening:${account.id}`,
        },
      });
    }

    summary.createdOpeningBalances += 1;
  }

  return summary;
};

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  backfillOpeningBalanceTransactions(prisma, { dryRun })
    .then((result) => {
      console.log(JSON.stringify({ dryRun, ...result }, null, 2));
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error('Backfill failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = {
  backfillOpeningBalanceTransactions,
};
