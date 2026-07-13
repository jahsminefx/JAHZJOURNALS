const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { destroyScreenshots } = require('../services/screenshotService');
const {
  createRegularAccountSchema,
  updateRegularAccountSchema,
  formatZodError,
} = require('../validation/accountSchemas');

const hasValue = (value) => value !== undefined && value !== null && value !== '';

// @desc    Get all trading accounts for logged in user
// @route   GET /api/accounts
// @access  Private
const getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId: req.user.id },
      include: {
        propFirmAccount: {
          include: {
            phases: { orderBy: { phaseNumber: 'asc' } },
            progressSnapshots: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(accounts);
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

    const account = await prisma.tradingAccount.create({
      data: {
        userId: req.user.id,
        accountCategory: 'REGULAR',
        name: payload.name,
        brokerName: payload.brokerName || null,
        accountType: payload.accountType || null,
        startingBalance: payload.startingBalance,
        currentBalance: payload.currentBalance ?? payload.startingBalance,
        currency: payload.currency || 'USD',
        platform: payload.platform || null,
        defaultRiskPercent: payload.riskPerTradePercent ?? null,
        riskPerTradePercent: payload.riskPerTradePercent ?? null,
        maxDailyLossPercent: payload.maxDailyLossPercent ?? null,
        maxTradesPerDay: payload.maxTradesPerDay ?? null,
        maxLossesPerDay: payload.maxLossesPerDay ?? null,
        notes: payload.notes || null,
        isPropFirmAccount: false,
      }
    });

    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ message: 'We hit a snag creating your account.' });
  }
};

// @desc    Get account by ID
// @route   GET /api/accounts/:id
// @access  Private
const getAccountById = async (req, res) => {
  try {
    const account = await prisma.tradingAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
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
    });

    if (account) {
      res.json(account);
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
          include: { screenshots: true },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
    }

    if (account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount) {
      return res.status(400).json({ message: 'This is a prop-firm account. Please use its specific editing flow.' });
    }

    const parsed = updateRegularAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatZodError(parsed.error));
    }

    const payload = parsed.data;

    const updatedAccount = await prisma.tradingAccount.update({
      where: { id: req.params.id },
      data: {
        ...(payload.name !== undefined && { name: hasValue(payload.name) ? payload.name.trim() : account.name }),
        ...(payload.brokerName !== undefined && { brokerName: payload.brokerName || null }),
        ...(payload.accountType !== undefined && { accountType: payload.accountType || null }),
        ...(payload.startingBalance !== undefined && { startingBalance: payload.startingBalance }),
        ...(payload.currentBalance !== undefined && { currentBalance: payload.currentBalance }),
        ...(payload.currency !== undefined && { currency: payload.currency || account.currency }),
        ...(payload.platform !== undefined && { platform: payload.platform || null }),
        ...(payload.riskPerTradePercent !== undefined && {
          defaultRiskPercent: payload.riskPerTradePercent ?? null,
          riskPerTradePercent: payload.riskPerTradePercent ?? null,
        }),
        ...(payload.maxDailyLossPercent !== undefined && { maxDailyLossPercent: payload.maxDailyLossPercent ?? null }),
        ...(payload.maxTradesPerDay !== undefined && { maxTradesPerDay: payload.maxTradesPerDay ?? null }),
        ...(payload.maxLossesPerDay !== undefined && { maxLossesPerDay: payload.maxLossesPerDay ?? null }),
        ...(payload.notes !== undefined && { notes: payload.notes || null }),
      }
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
      where: { id: req.params.id }
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
  deleteAccount
};
