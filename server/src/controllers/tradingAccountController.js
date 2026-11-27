const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { destroyScreenshots } = require('../services/screenshotService');
const {
  createRegularAccountSchema,
  updateRegularAccountSchema,
  formatZodError,
} = require('../validation/accountSchemas');
const { reconcileUserAccounts, reconcileAccountBalance } = require('../services/accountBalanceService');
const { ensureOpeningBalanceBaseline } = require('../services/accountTransactionService');
const { calculateAccountLedgerSummary, roundMoney } = require('../utils/accountLedgerMath');
const { isAccountTransactionsEnabled } = require('../config/featureFlags');

const hasValue = (value) => value !== undefined && value !== null && value !== '';

// @desc    Get all trading accounts for logged in user
// @route   GET /api/accounts
// @access  Private
const getAccounts = async (req, res) => {
  try {
    await reconcileUserAccounts(req.user.id);
    const txEnabled = isAccountTransactionsEnabled(req.user || null);
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId: req.user.id },
      include: {
        propFirmAccount: {
          include: {
            phases: { orderBy: { phaseNumber: 'asc' } },
            progressSnapshots: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
        trades: {
          select: { id: true, status: true, result: true, profitLossAmount: true },
        },
        accountTransactions: {
          where: { archivedAt: null },
          select: { id: true, type: true, direction: true, amount: true, signedAmount: true, archivedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = accounts.map(({ trades, accountTransactions, ...account }) => ({
      ...account,
      ledgerSummary: calculateAccountLedgerSummary({
        account,
        trades: trades || [],
        transactions: accountTransactions || [],
      }),
      accountTransactionsEnabled: txEnabled,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'We couldn\'t retrieve your trading accounts.' });
  }
};

// @desc    Create new trading account
// @route   POST /api/accounts
// @access  Private
const createAccount = async (req, res) => {
  try {
    const parsed = createRegularAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const payload = parsed.data;
    const startingBalance = roundMoney(payload.startingBalance);

    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.tradingAccount.create({
        data: {
          userId: req.user.id,
          accountCategory: 'REGULAR',
          name: payload.name,
          brokerName: payload.brokerName || null,
          accountType: payload.accountType || null,
          startingBalance,
          currentBalance: startingBalance,
          currency: payload.currency || 'USD',
          platform: payload.platform || null,
          defaultRiskPercent: payload.riskPerTradePercent ?? null,
          riskPerTradePercent: payload.riskPerTradePercent ?? null,
          maxDailyLossPercent: payload.maxDailyLossPercent ?? null,
          maxTradesPerDay: payload.maxTradesPerDay ?? null,
          maxLossesPerDay: payload.maxLossesPerDay ?? null,
          notes: payload.notes || null,
          isSharedWithMentor: payload.isSharedWithMentor ?? true,
          isPropFirmAccount: false,
        },
      });

      await ensureOpeningBalanceBaseline(tx, created);
      return created;
    });

    res.status(201).json({
      ...account,
      ledgerSummary: calculateAccountLedgerSummary({ account, trades: [], transactions: [] }),
      accountTransactionsEnabled: isAccountTransactionsEnabled(req.user || null),
    });
  } catch (error) {
    res.status(500).json({ message: 'We hit a snag creating your account.' });
  }
};

// @desc    Get account by ID
// @route   GET /api/accounts/:id
// @access  Private
const getAccountById = async (req, res) => {
  try {
    await reconcileAccountBalance(req.params.id);
    const [account, ledgerTrades, activeTransactions] = await Promise.all([
      prisma.tradingAccount.findFirst({
        where: {
          id: req.params.id,
          userId: req.user.id,
        },
        include: {
          propFirmAccount: {
            include: {
              phases: { orderBy: { phaseNumber: 'asc' } },
              progressSnapshots: { orderBy: { recordedAt: 'desc' }, take: 10 },
            },
          },
          trades: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
      prisma.trade.findMany({
        where: {
          tradingAccountId: req.params.id,
          tradingAccount: { userId: req.user.id },
        },
        select: { id: true, status: true, result: true, profitLossAmount: true },
      }),
      prisma.accountTransaction.findMany({
        where: {
          tradingAccountId: req.params.id,
          userId: req.user.id,
          archivedAt: null,
        },
        select: { id: true, type: true, direction: true, amount: true, signedAmount: true, archivedAt: true },
      }),
    ]);

    if (account) {
      res.json({
        ...account,
        ledgerSummary: calculateAccountLedgerSummary({
          account,
          trades: ledgerTrades,
          transactions: activeTransactions,
        }),
        accountTransactionsEnabled: isAccountTransactionsEnabled(req.user || null),
      });
    } else {
      res.status(404).json({ message: 'We couldn\'t find that trading account.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Our servers encountered an issue.' });
  }
};

// @desc    Update trading account
// @route   PUT /api/accounts/:id
// @access  Private
const updateAccount = async (req, res) => {
  try {
    const account = await prisma.tradingAccount.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        trades: {
          select: { id: true },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
    }

    if (account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount) {
      return res.status(400).json({ message: 'This is a prop-firm account. Please use its specific editing flow.' });
    }

    // Disallow direct currentBalance overwrite; all balance movements go through Account Transactions
    if (
      req.body?.currentBalance !== undefined
      && req.body.currentBalance !== ''
      && req.body.currentBalance !== null
      && Math.abs(Number(req.body.currentBalance) - Number(account.currentBalance)) > 0.001
    ) {
      return res.status(400).json({
        message: 'Direct balance edits are not allowed. Record a Deposit, Withdrawal, Payout, Fee, or Balance Adjustment in Account Transactions instead.',
      });
    }

    const parsed = updateRegularAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const payload = parsed.data;
    const isChangingStartingBalance = payload.startingBalance !== undefined
      && Math.abs(Number(payload.startingBalance) - Number(account.startingBalance)) > 0.001;

    const nonOpeningTxCount = await prisma.accountTransaction.count({
      where: {
        tradingAccountId: account.id,
        archivedAt: null,
        type: { not: 'OPENING_BALANCE' },
      },
    });
    const hasLedgerOrTradeActivity = (account.trades || []).length > 0 || nonOpeningTxCount > 0;

    if (isChangingStartingBalance && hasLedgerOrTradeActivity) {
      return res.status(400).json({
        message: 'Starting balance cannot be directly overwritten once trades or cash-flow transactions exist. Record a Balance adjustment in Account Transactions instead.',
      });
    }

    const nextCurrency = payload.currency !== undefined ? (payload.currency || account.currency) : account.currency;

    const updatedAccount = await prisma.$transaction(async (tx) => {
      const saved = await tx.tradingAccount.update({
        where: { id: req.params.id },
        data: {
          ...(payload.name !== undefined && { name: hasValue(payload.name) ? payload.name.trim() : account.name }),
          ...(payload.brokerName !== undefined && { brokerName: payload.brokerName || null }),
          ...(payload.accountType !== undefined && { accountType: payload.accountType || null }),
          ...(isChangingStartingBalance && { startingBalance: roundMoney(payload.startingBalance) }),
          ...(payload.currency !== undefined && { currency: nextCurrency }),
          ...(payload.platform !== undefined && { platform: payload.platform || null }),
          ...(payload.riskPerTradePercent !== undefined && {
            defaultRiskPercent: payload.riskPerTradePercent ?? null,
            riskPerTradePercent: payload.riskPerTradePercent ?? null,
          }),
          ...(payload.maxDailyLossPercent !== undefined && { maxDailyLossPercent: payload.maxDailyLossPercent ?? null }),
          ...(payload.maxTradesPerDay !== undefined && { maxTradesPerDay: payload.maxTradesPerDay ?? null }),
          ...(payload.maxLossesPerDay !== undefined && { maxLossesPerDay: payload.maxLossesPerDay ?? null }),
          ...(payload.notes !== undefined && { notes: payload.notes || null }),
          ...(payload.isSharedWithMentor !== undefined && { isSharedWithMentor: payload.isSharedWithMentor }),
        },
      });

      if (isChangingStartingBalance) {
        const nextOpening = roundMoney(payload.startingBalance);
        const existingOpening = await tx.accountTransaction.findFirst({
          where: {
            tradingAccountId: account.id,
            type: 'OPENING_BALANCE',
            archivedAt: null,
          },
        });

        if (existingOpening) {
          await tx.accountTransaction.update({
            where: { id: existingOpening.id },
            data: {
              amount: Math.abs(nextOpening),
              signedAmount: nextOpening,
              direction: nextOpening >= 0 ? 'INFLOW' : 'OUTFLOW',
              currency: nextCurrency,
              editedAt: new Date(),
            },
          });
        } else if (nextOpening !== 0) {
          await ensureOpeningBalanceBaseline(tx, saved);
        }

        await reconcileAccountBalance(account.id, tx, { force: true });
      } else if (!hasLedgerOrTradeActivity && payload.currency !== undefined && nextCurrency !== account.currency) {
        await tx.accountTransaction.updateMany({
          where: { tradingAccountId: account.id, type: 'OPENING_BALANCE', archivedAt: null },
          data: { currency: nextCurrency },
        });
      }

      return tx.tradingAccount.findUnique({ where: { id: account.id } });
    });

    res.json(updatedAccount);
  } catch (error) {
    res.status(500).json({ message: 'We hit a snag updating your account.' });
  }
};

// @desc    Delete trading account
// @route   DELETE /api/accounts/:id
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const account = await prisma.tradingAccount.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        trades: {
          include: { screenshots: true },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
    }

    const screenshots = account.trades.flatMap((trade) => trade.screenshots);
    await destroyScreenshots(screenshots);

    await prisma.tradingAccount.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Account removed from your sanctuary.' });
  } catch (error) {
    res.status(500).json({ message: 'We couldn\'t remove that account right now.' });
  }
};

module.exports = {
  getAccounts,
  createAccount,
  getAccountById,
  updateAccount,
  deleteAccount,
};
