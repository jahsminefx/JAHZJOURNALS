const { PrismaClient } = require('@prisma/client');
const defaultPrisma = new PrismaClient();
const currencyService = require('./fx/currencyService');
const { reconcileAccountBalance } = require('./accountBalanceService');
const { isClosedTrade } = require('../utils/dashboardMath');
const {
  roundMoney,
  computeSignedTransactionAmounts,
  calculateAccountLedgerSummary,
  attachResultingBalances,
  extractTransactionSyncMeta,
} = require('../utils/accountLedgerMath');

const createHttpError = (statusCode, message, code = null) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

const parseOptionalDate = (val, endOfDay = false) => {
  if (val === undefined || val === null || val === '') return null;
  const str = String(val).trim();
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
};

/**
 * Lazily ensures a baseline OPENING_BALANCE transaction row exists for an existing account
 * without touching trade history or inventing cash flows.
 */
const ensureOpeningBalanceBaseline = async (tx, account) => {
  if (!account) return null;
  const startingBalance = roundMoney(account.startingBalance || 0);
  if (startingBalance === 0) return null;

  const existingOpening = await tx.accountTransaction.findFirst({
    where: {
      tradingAccountId: account.id,
      type: 'OPENING_BALANCE',
      archivedAt: null,
    },
  });
  if (existingOpening) return existingOpening;

  const baselineKey = `baseline:opening:${account.id}`;
  return tx.accountTransaction.upsert({
    where: {
      userId_idempotencyKey: {
        userId: account.userId,
        idempotencyKey: baselineKey,
      },
    },
    update: {
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null,
    },
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
      idempotencyKey: baselineKey,
    },
  });
};

const fetchAccountLedgerState = async (db, accountId, userId) => {
  const account = await db.tradingAccount.findFirst({
    where: { id: accountId, userId },
    include: {
      trades: {
        select: {
          id: true,
          status: true,
          result: true,
          profitLossAmount: true,
          entryTime: true,
          exitTime: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      accountTransactions: {
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!account) return null;

  const transactionsWithBalance = attachResultingBalances({
    account,
    trades: account.trades || [],
    transactions: account.accountTransactions || [],
  });
  const summary = calculateAccountLedgerSummary({
    account,
    trades: account.trades || [],
    transactions: account.accountTransactions || [],
  });

  return { account, transactionsWithBalance, summary };
};

const listAccountTransactions = async (
  {
    userId,
    accountId = null,
    type = null,
    startDate = null,
    endDate = null,
    includeArchived = false,
    limit = 200,
  } = {},
  prismaClient = defaultPrisma
) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
  }

  const parsedStart = parseOptionalDate(startDate, false);
  const parsedEnd = parseOptionalDate(endDate, true);
  const typeFilter = type ? String(type).trim().toUpperCase() : null;
  const maxRows = Math.min(Math.max(Number(limit) || 200, 1), 500);

  if (accountId) {
    const state = await fetchAccountLedgerState(prismaClient, accountId, userId);
    if (!state) {
      throw createHttpError(404, 'We couldn\'t find that trading account.', 'ACCOUNT_NOT_FOUND');
    }

    const filtered = state.transactionsWithBalance
      .filter((tx) => {
        if (!includeArchived && tx.archivedAt) return false;
        if (typeFilter && tx.type !== typeFilter) return false;
        const ts = new Date(tx.occurredAt);
        if (parsedStart && ts < parsedStart) return false;
        if (parsedEnd && ts > parsedEnd) return false;
        return true;
      })
      .sort((a, b) => {
        const tDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
        if (tDiff !== 0) return tDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, maxRows)
      .map((tx) => ({
        ...tx,
        accountName: state.account.name,
      }));

    return {
      account: {
        id: state.account.id,
        name: state.account.name,
        currency: state.account.currency || 'USD',
        startingBalance: Number(state.account.startingBalance || 0),
        currentBalance: Number(state.account.currentBalance || 0),
        isPropFirmAccount: Boolean(state.account.isPropFirmAccount),
      },
      summary: {
        ...state.summary,
        currency: state.account.currency || 'USD',
        isMultiCurrencyNormalized: false,
      },
      transactions: filtered,
      totalCount: filtered.length,
    };
  }

  // Global view across all owned accounts
  const accounts = await prismaClient.tradingAccount.findMany({
    where: { userId },
    include: {
      trades: {
        select: {
          id: true,
          status: true,
          result: true,
          profitLossAmount: true,
          entryTime: true,
          exitTime: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      accountTransactions: {
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const distinctCurrencies = [...new Set(accounts.map((a) => a.currency || 'USD'))];
  const isMultiCurrency = distinctCurrencies.length > 1;
  const targetCurrency = isMultiCurrency ? 'USD' : (distinctCurrencies[0] || 'USD');
  const rateCache = new Map();

  const getRateToTarget = async (fromCurrency) => {
    const src = fromCurrency || 'USD';
    if (src === targetCurrency) return 1;
    if (rateCache.has(src)) return rateCache.get(src);
    const conv = await currencyService.convertAmount(1, src, targetCurrency);
    const rate = conv?.convertedAmount ?? 1;
    rateCache.set(src, rate);
    return rate;
  };

  let openingBalance = 0;
  let realisedTradingPnl = 0;
  let unrealisedPnl = 0;
  let deposits = 0;
  let withdrawals = 0;
  let payouts = 0;
  let fees = 0;
  let adjustments = 0;
  let netCashFlow = 0;
  let accountBalance = 0;
  let equity = 0;
  let netAccountChange = 0;
  let transactionCount = 0;

  const allTransactions = [];

  for (const account of accounts) {
    const rate = await getRateToTarget(account.currency || 'USD');
    const summary = calculateAccountLedgerSummary({
      account,
      trades: account.trades || [],
      transactions: account.accountTransactions || [],
    });

    openingBalance += summary.openingBalance * rate;
    realisedTradingPnl += summary.realisedTradingPnl * rate;
    unrealisedPnl += summary.unrealisedPnl * rate;
    deposits += summary.deposits * rate;
    withdrawals += summary.withdrawals * rate;
    payouts += summary.payouts * rate;
    fees += summary.fees * rate;
    adjustments += summary.adjustments * rate;
    netCashFlow += summary.netCashFlow * rate;
    accountBalance += summary.accountBalance * rate;
    equity += summary.equity * rate;
    netAccountChange += summary.netAccountChange * rate;
    transactionCount += summary.transactionCount;

    const annotated = attachResultingBalances({
      account,
      trades: account.trades || [],
      transactions: account.accountTransactions || [],
    });

    for (const tx of annotated) {
      allTransactions.push({
        ...tx,
        accountName: account.name,
      });
    }
  }

  const filtered = allTransactions
    .filter((tx) => {
      if (!includeArchived && tx.archivedAt) return false;
      if (typeFilter && tx.type !== typeFilter) return false;
      const ts = new Date(tx.occurredAt);
      if (parsedStart && ts < parsedStart) return false;
      if (parsedEnd && ts > parsedEnd) return false;
      return true;
    })
    .sort((a, b) => {
      const tDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (tDiff !== 0) return tDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, maxRows);

  return {
    account: null,
    summary: {
      openingBalance: roundMoney(openingBalance),
      realisedTradingPnl: roundMoney(realisedTradingPnl),
      unrealisedPnl: roundMoney(unrealisedPnl),
      deposits: roundMoney(deposits),
      withdrawals: roundMoney(withdrawals),
      payouts: roundMoney(payouts),
      fees: roundMoney(fees),
      adjustments: roundMoney(adjustments),
      netCashFlow: roundMoney(netCashFlow),
      accountBalance: roundMoney(accountBalance),
      equity: roundMoney(equity),
      netAccountChange: roundMoney(netAccountChange),
      hasCashFlowTransactions: transactionCount > 0,
      transactionCount,
      currency: targetCurrency,
      isMultiCurrencyNormalized: isMultiCurrency,
    },
    transactions: filtered,
    totalCount: filtered.length,
  };
};

const createAccountTransaction = async (
  { userId, accountId, payload, idempotencyKey = null },
  prismaClient = defaultPrisma
) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
  }

  const cleanIdempKey = idempotencyKey && String(idempotencyKey).trim()
    ? String(idempotencyKey).trim()
    : (payload.idempotencyKey || null);

  try {
    return await prismaClient.$transaction(async (tx) => {
      const account = await tx.tradingAccount.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        throw createHttpError(404, 'We couldn\'t find that trading account.', 'ACCOUNT_NOT_FOUND');
      }

      const accountCurrency = String(account.currency || 'USD').toUpperCase();
      if (payload.currency && String(payload.currency).toUpperCase() !== accountCurrency) {
        throw createHttpError(
          400,
          `Transaction currency (${payload.currency}) must match account currency (${accountCurrency}).`,
          'CURRENCY_MISMATCH'
        );
      }

      if (cleanIdempKey) {
        const existingIdemp = await tx.accountTransaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: cleanIdempKey,
            },
          },
        });

        if (existingIdemp) {
          if (existingIdemp.tradingAccountId !== account.id) {
            throw createHttpError(409, 'This idempotency key was already used for another account.', 'IDEMPOTENCY_CONFLICT');
          }

          const state = await fetchAccountLedgerState(tx, account.id, userId);
          const replayTx = state.transactionsWithBalance.find((item) => item.id === existingIdemp.id);
          return {
            idempotentReplay: true,
            transaction: replayTx,
            summary: { ...state.summary, currency: accountCurrency },
            account: {
              id: account.id,
              name: account.name,
              currency: accountCurrency,
              currentBalance: state.summary.accountBalance,
            },
          };
        }
      }

      await ensureOpeningBalanceBaseline(tx, account);

      const { direction, amount, signedAmount } = computeSignedTransactionAmounts({
        type: payload.type,
        amount: payload.amount,
        direction: payload.direction,
      });

      const created = await tx.accountTransaction.create({
        data: {
          userId,
          tradingAccountId: account.id,
          type: payload.type,
          direction,
          amount,
          signedAmount,
          currency: accountCurrency,
          occurredAt: payload.occurredAt || new Date(),
          note: payload.note ?? null,
          idempotencyKey: cleanIdempKey,
        },
      });

      await reconcileAccountBalance(account.id, tx, { force: true });

      const state = await fetchAccountLedgerState(tx, account.id, userId);
      const annotatedCreated = state.transactionsWithBalance.find((item) => item.id === created.id);

      return {
        idempotentReplay: false,
        transaction: { ...annotatedCreated, accountName: account.name },
        summary: { ...state.summary, currency: accountCurrency },
        account: {
          id: account.id,
          name: account.name,
          currency: accountCurrency,
          currentBalance: state.summary.accountBalance,
        },
      };
    });
  } catch (error) {
    // Handle concurrent race on identical idempotency key gracefully
    if (error?.code === 'P2002' && cleanIdempKey) {
      const existingIdemp = await prismaClient.accountTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: cleanIdempKey,
          },
        },
      });
      if (existingIdemp && existingIdemp.tradingAccountId === accountId) {
        const state = await fetchAccountLedgerState(prismaClient, accountId, userId);
        const replayTx = state.transactionsWithBalance.find((item) => item.id === existingIdemp.id);
        return {
          idempotentReplay: true,
          transaction: { ...replayTx, accountName: state.account.name },
          summary: { ...state.summary, currency: state.account.currency || 'USD' },
          account: {
            id: state.account.id,
            name: state.account.name,
            currency: state.account.currency || 'USD',
            currentBalance: state.summary.accountBalance,
          },
        };
      }
      throw createHttpError(409, 'This request has already been processed or conflicts with another entry.', 'IDEMPOTENCY_CONFLICT');
    }
    throw error;
  }
};

const updateAccountTransaction = async (
  { userId, accountId, transactionId, payload },
  prismaClient = defaultPrisma
) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
  }

  return prismaClient.$transaction(async (tx) => {
    const existing = await tx.accountTransaction.findFirst({
      where: {
        id: transactionId,
        tradingAccountId: accountId,
        userId,
      },
      include: {
        tradingAccount: {
          select: { id: true, name: true, currency: true },
        },
      },
    });

    if (!existing) {
      throw createHttpError(404, 'We couldn\'t find that account transaction.', 'TRANSACTION_NOT_FOUND');
    }

    if (existing.archivedAt) {
      throw createHttpError(400, 'Archived transactions cannot be edited.', 'TRANSACTION_ARCHIVED');
    }

    const syncMeta = extractTransactionSyncMeta(existing);
    if (syncMeta.source === 'MT_CLOUD_SYNC') {
      throw createHttpError(
        403,
        'MetaTrader-synced balance transactions are read-only and cannot be modified or archived manually.',
        'MT_SYNC_TRANSACTION_READ_ONLY'
      );
    }

    if (existing.type === 'OPENING_BALANCE') {
      throw createHttpError(
        400,
        'Opening balance baseline cannot be edited directly. Record a Balance adjustment instead.',
        'OPENING_BALANCE_IMMUTABLE'
      );
    }

    const accountCurrency = String(existing.tradingAccount?.currency || existing.currency || 'USD').toUpperCase();
    if (payload.currency && String(payload.currency).toUpperCase() !== accountCurrency) {
      throw createHttpError(
        400,
        `Transaction currency (${payload.currency}) must match account currency (${accountCurrency}).`,
        'CURRENCY_MISMATCH'
      );
    }

    const nextType = payload.type || existing.type;
    const nextAmount = payload.amount !== undefined ? payload.amount : Number(existing.amount);
    const nextDirectionInput = nextType === 'ADJUSTMENT'
      ? (payload.direction || existing.direction)
      : payload.direction;

    let computed;
    try {
      computed = computeSignedTransactionAmounts({
        type: nextType,
        amount: nextAmount,
        direction: nextDirectionInput,
      });
    } catch (calcErr) {
      throw createHttpError(400, calcErr.message, 'INVALID_TRANSACTION_UPDATE');
    }

    const priorHistory = Array.isArray(existing.editHistory) ? existing.editHistory : [];
    const now = new Date();
    const auditEntry = {
      action: 'EDIT',
      editedAt: now.toISOString(),
      editedByUserId: userId,
      previous: {
        type: existing.type,
        direction: existing.direction,
        amount: roundMoney(existing.amount),
        signedAmount: roundMoney(existing.signedAmount),
        occurredAt: existing.occurredAt instanceof Date ? existing.occurredAt.toISOString() : existing.occurredAt,
        note: existing.note ?? null,
      },
    };

    const updated = await tx.accountTransaction.update({
      where: { id: existing.id },
      data: {
        type: nextType,
        direction: computed.direction,
        amount: computed.amount,
        signedAmount: computed.signedAmount,
        occurredAt: payload.occurredAt !== undefined ? payload.occurredAt : existing.occurredAt,
        note: payload.note !== undefined ? payload.note : existing.note,
        editedAt: now,
        editHistory: [...priorHistory, auditEntry],
      },
    });

    await reconcileAccountBalance(accountId, tx, { force: true });

    const state = await fetchAccountLedgerState(tx, accountId, userId);
    const annotatedUpdated = state.transactionsWithBalance.find((item) => item.id === updated.id);

    return {
      transaction: { ...annotatedUpdated, accountName: state.account.name },
      summary: { ...state.summary, currency: accountCurrency },
      account: {
        id: state.account.id,
        name: state.account.name,
        currency: accountCurrency,
        currentBalance: state.summary.accountBalance,
      },
    };
  });
};

const archiveAccountTransaction = async (
  { userId, accountId, transactionId, reason = null },
  prismaClient = defaultPrisma
) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
  }

  return prismaClient.$transaction(async (tx) => {
    const existing = await tx.accountTransaction.findFirst({
      where: {
        id: transactionId,
        tradingAccountId: accountId,
        userId,
      },
      include: {
        tradingAccount: {
          select: { id: true, name: true, currency: true },
        },
      },
    });

    if (!existing) {
      throw createHttpError(404, 'We couldn\'t find that account transaction.', 'TRANSACTION_NOT_FOUND');
    }

    const syncMeta = extractTransactionSyncMeta(existing);
    if (syncMeta.source === 'MT_CLOUD_SYNC') {
      throw createHttpError(
        403,
        'MetaTrader-synced balance transactions are read-only and cannot be modified or archived manually.',
        'MT_SYNC_TRANSACTION_READ_ONLY'
      );
    }

    if (existing.type === 'OPENING_BALANCE') {
      throw createHttpError(400, 'Opening balance baseline cannot be archived.', 'OPENING_BALANCE_IMMUTABLE');
    }

    if (existing.archivedAt) {
      throw createHttpError(400, 'This transaction is already archived.', 'ALREADY_ARCHIVED');
    }

    const priorHistory = Array.isArray(existing.editHistory) ? existing.editHistory : [];
    const now = new Date();
    const auditEntry = {
      action: 'ARCHIVE',
      archivedAt: now.toISOString(),
      archivedByUserId: userId,
      reason: reason || null,
      previous: {
        type: existing.type,
        direction: existing.direction,
        amount: roundMoney(existing.amount),
        signedAmount: roundMoney(existing.signedAmount),
        occurredAt: existing.occurredAt instanceof Date ? existing.occurredAt.toISOString() : existing.occurredAt,
        note: existing.note ?? null,
      },
    };

    const archived = await tx.accountTransaction.update({
      where: { id: existing.id },
      data: {
        archivedAt: now,
        archivedByUserId: userId,
        archiveReason: reason || null,
        editHistory: [...priorHistory, auditEntry],
      },
    });

    await reconcileAccountBalance(accountId, tx, { force: true });

    const accountCurrency = String(existing.tradingAccount?.currency || existing.currency || 'USD').toUpperCase();
    const state = await fetchAccountLedgerState(tx, accountId, userId);
    const annotatedArchived = state.transactionsWithBalance.find((item) => item.id === archived.id);

    return {
      transaction: { ...annotatedArchived, accountName: state.account.name },
      summary: { ...state.summary, currency: accountCurrency },
      account: {
        id: state.account.id,
        name: state.account.name,
        currency: accountCurrency,
        currentBalance: state.summary.accountBalance,
      },
    };
  });
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const findVerifiedPropFirmPayoutMatch = ({ deal, absAmount, propFirmPayouts = [], alreadyLinkedPayoutIds }) => {
  if (!Array.isArray(propFirmPayouts) || propFirmPayouts.length === 0) {
    return null;
  }

  const eligible = propFirmPayouts.filter((payout) => {
    if (!payout || alreadyLinkedPayoutIds.has(payout.id)) return false;
    const status = String(payout.status || '').toUpperCase();
    if (status !== 'APPROVED' && status !== 'PAID') return false;
    return Math.abs(roundMoney(payout.amountRequested) - absAmount) <= 0.01;
  });

  if (eligible.length === 0) return null;

  // 1. Exact transactionReference match against MetaTrader dealId or broker comment
  const dealComment = String(deal.comment || '');
  const refMatch = eligible.find((payout) => {
    const ref = String(payout.transactionReference || '').trim();
    if (!ref) return false;
    return ref === deal.dealId || (dealComment && dealComment.includes(ref));
  });
  if (refMatch) return refMatch;

  // 2. Exact amount match within +-7 days of payout processedDate / requestDate
  const dealMs = new Date(deal.time).getTime();
  if (!Number.isFinite(dealMs)) return null;

  const timedMatches = eligible
    .map((payout) => {
      const refDate = payout.processedDate || payout.requestDate;
      const payoutMs = refDate ? new Date(refDate).getTime() : NaN;
      const diff = Number.isFinite(payoutMs) ? Math.abs(dealMs - payoutMs) : Infinity;
      return { payout, diff };
    })
    .filter((item) => item.diff <= SEVEN_DAYS_MS)
    .sort((a, b) => a.diff - b.diff);

  return timedMatches.length > 0 ? timedMatches[0].payout : null;
};

/**
 * Idempotently imports MetaTrader DEAL_TYPE_BALANCE events as source-labelled,
 * read-only AccountTransaction rows after sync completion.
 */
const syncMetaTraderBalanceDeals = async (
  { accountId, balanceDeals = [], liveBalance = null } = {},
  prismaClient = defaultPrisma
) => {
  if (!accountId || !Array.isArray(balanceDeals) || balanceDeals.length === 0) {
    return { importedCount: 0, skippedCount: 0 };
  }

  const normalizedMap = new Map();
  for (const rawDeal of balanceDeals) {
    if (!rawDeal) continue;
    const dealId = String(rawDeal.dealId || rawDeal.id || rawDeal.ticket || '').trim();
    const amount = roundMoney(rawDeal.amount);
    if (!dealId || Math.abs(amount) < 0.005) continue;
    const parsedTime = rawDeal.time ? new Date(rawDeal.time) : null;
    const time = parsedTime && !Number.isNaN(parsedTime.getTime())
      ? parsedTime.toISOString()
      : new Date().toISOString();
    const comment = rawDeal.comment ? String(rawDeal.comment).trim() : null;

    if (!normalizedMap.has(dealId)) {
      normalizedMap.set(dealId, { dealId, amount, time, comment });
    }
  }

  const sortedDeals = Array.from(normalizedMap.values()).sort((a, b) => {
    const tDiff = new Date(a.time).getTime() - new Date(b.time).getTime();
    if (tDiff !== 0) return tDiff;
    return a.dealId.localeCompare(b.dealId);
  });

  if (sortedDeals.length === 0) {
    return { importedCount: 0, skippedCount: 0 };
  }

  return prismaClient.$transaction(async (tx) => {
    const account = await tx.tradingAccount.findUnique({
      where: { id: accountId },
      include: {
        trades: {
          select: {
            id: true,
            status: true,
            result: true,
            profitLossAmount: true,
            entryTime: true,
            exitTime: true,
            createdAt: true,
          },
        },
        accountTransactions: {
          orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
        },
        propFirmAccount: {
          include: {
            payouts: true,
          },
        },
      },
    });

    if (!account) {
      return { importedCount: 0, skippedCount: 0 };
    }

    await ensureOpeningBalanceBaseline(tx, account);

    const existingTransactions = await tx.accountTransaction.findMany({
      where: { tradingAccountId: account.id },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const existingByKey = new Map();
    const alreadyLinkedPayoutIds = new Set();
    let existingOpeningRow = null;

    for (const existingTx of existingTransactions) {
      if (existingTx.idempotencyKey) {
        existingByKey.set(existingTx.idempotencyKey, existingTx);
      }
      if (!existingTx.archivedAt && existingTx.linkedPropFirmPayoutId) {
        alreadyLinkedPayoutIds.add(existingTx.linkedPropFirmPayoutId);
      }
      if (!existingTx.archivedAt && existingTx.type === 'OPENING_BALANCE' && !existingOpeningRow) {
        existingOpeningRow = existingTx;
      }
    }

    const closedTrades = (account.trades || []).filter(isClosedTrade);
    let earliestTradeMs = null;
    for (const trade of closedTrades) {
      const ts = new Date(trade.exitTime || trade.entryTime || trade.createdAt).getTime();
      if (Number.isFinite(ts) && (earliestTradeMs === null || ts < earliestTradeMs)) {
        earliestTradeMs = ts;
      }
    }

    const realisedPnl = roundMoney(
      closedTrades.reduce((sum, trade) => sum + (Number(trade.profitLossAmount) || 0), 0)
    );
    const sumAllBalanceDeals = roundMoney(sortedDeals.reduce((sum, d) => sum + d.amount, 0));

    const firstDeal = sortedDeals[0];
    const firstDealMs = new Date(firstDeal.time).getTime();
    const existingOpeningMeta = existingOpeningRow ? extractTransactionSyncMeta(existingOpeningRow) : null;
    const existingOpeningDealId = existingOpeningMeta?.source === 'MT_CLOUD_SYNC'
      ? existingOpeningMeta.externalDealId
      : null;
    const firstDealKey = `mt_balance:${account.id}:${firstDeal.dealId}`;

    let firstDealIsOpeningBaseline = false;
    if (
      firstDeal
      && firstDeal.amount > 0
      && (earliestTradeMs === null || firstDealMs <= earliestTradeMs)
      && (!existingOpeningDealId || existingOpeningDealId === firstDeal.dealId)
      && !existingByKey.has(firstDealKey)
    ) {
      const matchesStarting = Math.abs(firstDeal.amount - roundMoney(account.startingBalance)) <= 0.01;
      const matchesReconciledLive = liveBalance !== null
        && Number.isFinite(Number(liveBalance))
        && Math.abs(roundMoney(sumAllBalanceDeals + realisedPnl) - roundMoney(liveBalance)) <= 0.05;
      firstDealIsOpeningBaseline = Boolean(matchesStarting || matchesReconciledLive);
    }

    let openingModified = false;
    let skippedCount = 0;

    if (firstDealIsOpeningBaseline) {
      skippedCount += 1;
      const nowIso = new Date().toISOString();
      const firstNotePrefix = `MetaTrader Sync (#${firstDeal.dealId})`;
      const firstNote = firstDeal.comment
        ? `${firstNotePrefix}: ${firstDeal.comment}`.slice(0, 500)
        : `${firstNotePrefix}: Opening balance baseline`;

      const alreadyRecordedAsFirstOpening = Boolean(
        existingOpeningRow
        && existingOpeningDealId === firstDeal.dealId
        && Math.abs(roundMoney(existingOpeningRow.signedAmount) - firstDeal.amount) <= 0.01
      );

      if (!alreadyRecordedAsFirstOpening) {
        openingModified = true;
        const importAuditEntry = {
          action: 'MT_SYNC_IMPORT',
          source: 'MT_CLOUD_SYNC',
          sourceLabel: 'MetaTrader Sync',
          readOnly: true,
          externalDealId: firstDeal.dealId,
          rawComment: firstDeal.comment || null,
          importedAt: nowIso,
        };

        if (existingOpeningRow) {
          const priorHistory = Array.isArray(existingOpeningRow.editHistory) ? existingOpeningRow.editHistory : [];
          await tx.accountTransaction.update({
            where: { id: existingOpeningRow.id },
            data: {
              occurredAt: new Date(firstDeal.time),
              amount: Math.abs(firstDeal.amount),
              signedAmount: firstDeal.amount,
              note: firstNote,
              editHistory: [...priorHistory, importAuditEntry],
            },
          });
        } else {
          await tx.accountTransaction.create({
            data: {
              userId: account.userId,
              tradingAccountId: account.id,
              type: 'OPENING_BALANCE',
              direction: 'INFLOW',
              amount: Math.abs(firstDeal.amount),
              signedAmount: firstDeal.amount,
              currency: account.currency || 'USD',
              occurredAt: new Date(firstDeal.time),
              note: firstNote,
              idempotencyKey: `baseline:opening:${account.id}`,
              editHistory: [importAuditEntry],
            },
          });
        }

        if (Math.abs(roundMoney(account.startingBalance) - firstDeal.amount) > 0.01) {
          await tx.tradingAccount.update({
            where: { id: account.id },
            data: { startingBalance: firstDeal.amount },
          });
        }
      }
    }

    const dealsToImport = firstDealIsOpeningBaseline ? sortedDeals.slice(1) : sortedDeals;
    const isPropFirm = Boolean(account.isPropFirmAccount || account.accountCategory === 'PROP_FIRM');
    const propFirmPayouts = account.propFirmAccount?.payouts || [];
    let importedCount = 0;

    for (const deal of dealsToImport) {
      const idempotencyKey = `mt_balance:${account.id}:${deal.dealId}`;
      if (existingByKey.has(idempotencyKey)) {
        skippedCount += 1;
        continue;
      }

      // Guard against same idempotencyKey existing outside current array snapshot
      const existingGlobal = await tx.accountTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: account.userId,
            idempotencyKey,
          },
        },
      });
      if (existingGlobal) {
        existingByKey.set(idempotencyKey, existingGlobal);
        skippedCount += 1;
        continue;
      }

      const isInflow = deal.amount > 0;
      const absAmount = roundMoney(Math.abs(deal.amount));
      const signedAmount = isInflow ? absAmount : -absAmount;
      const direction = isInflow ? 'INFLOW' : 'OUTFLOW';

      let type = isInflow ? 'DEPOSIT' : 'WITHDRAWAL';
      let linkedPropFirmPayoutId = null;
      let payoutClassificationStatus = null;

      if (!isInflow && isPropFirm) {
        const matchedPayout = findVerifiedPropFirmPayoutMatch({
          deal,
          absAmount,
          propFirmPayouts,
          alreadyLinkedPayoutIds,
        });

        if (matchedPayout) {
          type = 'PAYOUT';
          linkedPropFirmPayoutId = matchedPayout.id;
          payoutClassificationStatus = 'VERIFIED_PAYOUT_MATCH';
          alreadyLinkedPayoutIds.add(matchedPayout.id);
        } else {
          type = 'WITHDRAWAL';
          payoutClassificationStatus = 'REQUIRES_USER_CONFIRMATION';
        }
      }

      const notePrefix = `MetaTrader Sync (#${deal.dealId})`;
      const note = deal.comment ? `${notePrefix}: ${deal.comment}`.slice(0, 500) : notePrefix;

      const created = await tx.accountTransaction.create({
        data: {
          userId: account.userId,
          tradingAccountId: account.id,
          type,
          direction,
          amount: absAmount,
          signedAmount,
          currency: account.currency || 'USD',
          occurredAt: new Date(deal.time),
          note,
          idempotencyKey,
          linkedPropFirmPayoutId,
          editHistory: [
            {
              action: 'MT_SYNC_IMPORT',
              source: 'MT_CLOUD_SYNC',
              sourceLabel: 'MetaTrader Sync',
              readOnly: true,
              externalDealId: deal.dealId,
              rawComment: deal.comment || null,
              payoutClassificationStatus,
              importedAt: new Date().toISOString(),
            },
          ],
        },
      });

      existingByKey.set(idempotencyKey, created);
      importedCount += 1;
    }

    if (importedCount > 0 || openingModified) {
      await reconcileAccountBalance(account.id, tx, { force: true });
    }

    return { importedCount, skippedCount };
  });
};

/**
 * Allows the trader to explicitly confirm a MetaTrader-synced outflow withdrawal
 * on a prop-firm account as a Prop-Firm Payout without allowing amount/date alteration.
 */
const confirmSyncedTransactionAsPayout = async (
  { userId, accountId, transactionId },
  prismaClient = defaultPrisma
) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
  }

  return prismaClient.$transaction(async (tx) => {
    const account = await tx.tradingAccount.findFirst({
      where: { id: accountId, userId },
      select: {
        id: true,
        name: true,
        currency: true,
        isPropFirmAccount: true,
        accountCategory: true,
      },
    });

    if (!account) {
      throw createHttpError(404, 'We couldn\'t find that trading account.', 'ACCOUNT_NOT_FOUND');
    }

    const isPropFirm = Boolean(account.isPropFirmAccount || account.accountCategory === 'PROP_FIRM');
    if (!isPropFirm) {
      throw createHttpError(
        400,
        'Only prop-firm accounts can classify synced withdrawals as prop-firm payouts.',
        'NOT_PROP_FIRM_ACCOUNT'
      );
    }

    const existing = await tx.accountTransaction.findFirst({
      where: {
        id: transactionId,
        tradingAccountId: account.id,
        userId,
      },
    });

    if (!existing) {
      throw createHttpError(404, 'We couldn\'t find that account transaction.', 'TRANSACTION_NOT_FOUND');
    }

    if (existing.archivedAt) {
      throw createHttpError(400, 'Archived transactions cannot be updated.', 'TRANSACTION_ARCHIVED');
    }

    const syncMeta = extractTransactionSyncMeta(existing);
    if (syncMeta.source !== 'MT_CLOUD_SYNC') {
      throw createHttpError(
        400,
        'Only MetaTrader-synced balance transactions use payout confirmation.',
        'NOT_MT_SYNC_TRANSACTION'
      );
    }

    if (existing.direction !== 'OUTFLOW') {
      throw createHttpError(
        400,
        'Only outflow transactions can be classified as a payout.',
        'INVALID_PAYOUT_DIRECTION'
      );
    }

    const accountCurrency = String(account.currency || existing.currency || 'USD').toUpperCase();

    if (existing.type === 'PAYOUT') {
      const state = await fetchAccountLedgerState(tx, account.id, userId);
      const currentTx = state.transactionsWithBalance.find((item) => item.id === existing.id);
      return {
        transaction: { ...currentTx, accountName: account.name },
        summary: { ...state.summary, currency: accountCurrency },
        account: {
          id: account.id,
          name: account.name,
          currency: accountCurrency,
          currentBalance: state.summary.accountBalance,
        },
      };
    }

    const priorHistory = Array.isArray(existing.editHistory) ? existing.editHistory : [];
    const now = new Date();
    const auditEntry = {
      action: 'CONFIRM_PROP_PAYOUT',
      source: 'MT_CLOUD_SYNC',
      sourceLabel: 'MetaTrader Sync',
      readOnly: true,
      externalDealId: syncMeta.externalDealId,
      payoutClassificationStatus: 'USER_CONFIRMED_PAYOUT',
      confirmedAt: now.toISOString(),
      confirmedByUserId: userId,
    };

    const updated = await tx.accountTransaction.update({
      where: { id: existing.id },
      data: {
        type: 'PAYOUT',
        editedAt: now,
        editHistory: [...priorHistory, auditEntry],
      },
    });

    await reconcileAccountBalance(account.id, tx, { force: true });

    const state = await fetchAccountLedgerState(tx, account.id, userId);
    const annotatedUpdated = state.transactionsWithBalance.find((item) => item.id === updated.id);

    return {
      transaction: { ...annotatedUpdated, accountName: account.name },
      summary: { ...state.summary, currency: accountCurrency },
      account: {
        id: account.id,
        name: account.name,
        currency: accountCurrency,
        currentBalance: state.summary.accountBalance,
      },
    };
  });
};

module.exports = {
  ensureOpeningBalanceBaseline,
  fetchAccountLedgerState,
  listAccountTransactions,
  createAccountTransaction,
  updateAccountTransaction,
  archiveAccountTransaction,
  syncMetaTraderBalanceDeals,
  confirmSyncedTransactionAsPayout,
};
