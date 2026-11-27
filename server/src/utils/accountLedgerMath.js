const { isClosedTrade } = require('./dashboardMath');

const roundMoney = (value) => {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const VALID_TYPES = new Set([
  'OPENING_BALANCE',
  'DEPOSIT',
  'WITHDRAWAL',
  'PAYOUT',
  'FEE',
  'ADJUSTMENT',
]);

const VALID_DIRECTIONS = new Set(['INFLOW', 'OUTFLOW']);

const resolveTransactionSign = (type, direction) => {
  const upperType = String(type || '').toUpperCase();
  if (!VALID_TYPES.has(upperType)) {
    throw new Error(`Unsupported transaction type: ${type}`);
  }

  if (upperType === 'DEPOSIT') {
    if (direction && String(direction).toUpperCase() !== 'INFLOW') {
      throw new Error('Deposits must always have INFLOW direction.');
    }
    return { direction: 'INFLOW', sign: 1 };
  }

  if (upperType === 'WITHDRAWAL' || upperType === 'PAYOUT' || upperType === 'FEE') {
    if (direction && String(direction).toUpperCase() !== 'OUTFLOW') {
      throw new Error(`${upperType} transactions must always have OUTFLOW direction.`);
    }
    return { direction: 'OUTFLOW', sign: -1 };
  }

  if (upperType === 'OPENING_BALANCE') {
    const resolved = String(direction || 'INFLOW').toUpperCase() === 'OUTFLOW' ? 'OUTFLOW' : 'INFLOW';
    return { direction: resolved, sign: resolved === 'OUTFLOW' ? -1 : 1 };
  }

  // ADJUSTMENT requires explicit direction
  const upperDir = String(direction || '').toUpperCase();
  if (!VALID_DIRECTIONS.has(upperDir)) {
    throw new Error('Balance adjustments require an explicit direction (INFLOW or OUTFLOW).');
  }
  return { direction: upperDir, sign: upperDir === 'OUTFLOW' ? -1 : 1 };
};

const computeSignedTransactionAmounts = ({ type, amount, direction }) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Transaction amount must be a valid non-negative number.');
  }
  const normalizedAmount = roundMoney(Math.abs(numericAmount));
  const resolved = resolveTransactionSign(type, direction);
  return {
    direction: resolved.direction,
    sign: resolved.sign,
    amount: normalizedAmount,
    signedAmount: roundMoney(resolved.sign * normalizedAmount),
  };
};

const summarizeCashFlowTransactions = (transactions = []) => {
  let deposits = 0;
  let withdrawals = 0;
  let payouts = 0;
  let fees = 0;
  let adjustments = 0;
  let transactionCount = 0;

  for (const tx of transactions || []) {
    if (!tx || tx.archivedAt) continue;
    const upperType = String(tx.type || '').toUpperCase();
    if (upperType === 'OPENING_BALANCE') continue;

    transactionCount += 1;
    const absAmount = Math.abs(Number(tx.amount ?? tx.signedAmount ?? 0)) || 0;
    const signed = tx.signedAmount !== undefined && tx.signedAmount !== null
      ? Number(tx.signedAmount)
      : (String(tx.direction || '').toUpperCase() === 'OUTFLOW' ? -absAmount : absAmount);

    if (upperType === 'DEPOSIT') {
      deposits += absAmount;
    } else if (upperType === 'WITHDRAWAL') {
      withdrawals += absAmount;
    } else if (upperType === 'PAYOUT') {
      payouts += absAmount;
    } else if (upperType === 'FEE') {
      fees += absAmount;
    } else if (upperType === 'ADJUSTMENT') {
      adjustments += signed;
    }
  }

  const netCashFlow = roundMoney(deposits - withdrawals - payouts - fees + adjustments);
  return {
    deposits: roundMoney(deposits),
    withdrawals: roundMoney(withdrawals),
    payouts: roundMoney(payouts),
    fees: roundMoney(fees),
    adjustments: roundMoney(adjustments),
    netCashFlow,
    transactionCount,
  };
};

const calculateAccountLedgerSummary = ({ account = null, trades = [], transactions = [] } = {}) => {
  const activeTx = (transactions || []).filter((tx) => tx && !tx.archivedAt);
  const openingTx = activeTx.filter((tx) => String(tx.type || '').toUpperCase() === 'OPENING_BALANCE');

  const openingBalance = openingTx.length > 0
    ? roundMoney(openingTx.reduce((sum, tx) => sum + (Number(tx.signedAmount ?? tx.amount ?? 0) || 0), 0))
    : roundMoney(account?.startingBalance || 0);

  const safeTrades = Array.isArray(trades) ? trades : [];
  const realisedTradingPnl = roundMoney(
    safeTrades
      .filter(isClosedTrade)
      .reduce((sum, trade) => sum + (Number(trade.profitLossAmount) || 0), 0)
  );

  const unrealisedPnl = roundMoney(
    safeTrades
      .filter((trade) => {
        if (isClosedTrade(trade)) return false;
        if (String(trade?.status || '').toUpperCase() === 'CANCELLED') return false;
        return trade.profitLossAmount !== null
          && trade.profitLossAmount !== undefined
          && trade.profitLossAmount !== ''
          && Number.isFinite(Number(trade.profitLossAmount));
      })
      .reduce((sum, trade) => sum + Number(trade.profitLossAmount), 0)
  );

  const cashFlow = summarizeCashFlowTransactions(activeTx);
  const accountBalance = roundMoney(openingBalance + realisedTradingPnl + cashFlow.netCashFlow);
  const equity = roundMoney(accountBalance + unrealisedPnl);
  const netAccountChange = roundMoney(realisedTradingPnl + cashFlow.netCashFlow);

  return {
    openingBalance,
    realisedTradingPnl,
    unrealisedPnl,
    deposits: cashFlow.deposits,
    withdrawals: cashFlow.withdrawals,
    payouts: cashFlow.payouts,
    fees: cashFlow.fees,
    adjustments: cashFlow.adjustments,
    netCashFlow: cashFlow.netCashFlow,
    accountBalance,
    equity,
    netAccountChange,
    hasCashFlowTransactions: cashFlow.transactionCount > 0,
    transactionCount: cashFlow.transactionCount,
  };
};

const LEDGER_EVENT_PRIORITY = {
  OPENING_BALANCE: 0,
  DEPOSIT: 1,
  WITHDRAWAL: 2,
  PAYOUT: 2,
  FEE: 2,
  TRADE: 3,
  ADJUSTMENT: 4,
};

const toTimestampMs = (val) => {
  if (!val) return 0;
  const d = val instanceof Date ? val : new Date(val);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

const extractTransactionSyncMeta = (tx) => {
  const history = Array.isArray(tx?.editHistory) ? tx.editHistory : [];
  const syncEntries = history.filter(
    (entry) => entry && (entry.source === 'MT_CLOUD_SYNC' || entry.action === 'MT_SYNC_IMPORT' || entry.action === 'CONFIRM_PROP_PAYOUT')
  );
  const latestSyncEntry = syncEntries.length > 0 ? syncEntries[syncEntries.length - 1] : null;
  const idemp = String(tx?.idempotencyKey || '');
  const isMtKey = idemp.startsWith('mt_balance:');
  const isMtSync = Boolean(isMtKey || latestSyncEntry?.source === 'MT_CLOUD_SYNC');

  let externalDealId = latestSyncEntry?.externalDealId || null;
  if (!externalDealId && isMtKey) {
    const parts = idemp.split(':');
    externalDealId = parts.length >= 3 ? parts.slice(2).join(':') : null;
  }

  const upperType = String(tx?.type || '').toUpperCase();
  const isOpening = upperType === 'OPENING_BALANCE';

  let source = 'MANUAL';
  let sourceLabel = 'Manual';
  if (isMtSync) {
    source = 'MT_CLOUD_SYNC';
    sourceLabel = 'MetaTrader Sync';
  } else if (isOpening) {
    source = 'SYSTEM_BASELINE';
    sourceLabel = 'Opening Baseline';
  } else if (tx?.linkedPropFirmPayoutId) {
    source = 'PROP_PAYOUT_LEDGER';
    sourceLabel = 'Prop Payout Ledger';
  }

  return {
    source,
    sourceLabel,
    isReadOnly: Boolean(isOpening || isMtSync),
    externalDealId,
    payoutClassificationStatus: latestSyncEntry?.payoutClassificationStatus || null,
  };
};

const serializeTransaction = (tx, resultingBalance = null, { isPropFirmAccount = false } = {}) => {
  const syncMeta = extractTransactionSyncMeta(tx);
  const upperType = String(tx?.type || '').toUpperCase();
  const upperDirection = String(tx?.direction || '').toUpperCase();
  const canConfirmAsPayout = Boolean(
    syncMeta.source === 'MT_CLOUD_SYNC'
    && !tx?.archivedAt
    && upperType === 'WITHDRAWAL'
    && upperDirection === 'OUTFLOW'
    && (isPropFirmAccount || syncMeta.payoutClassificationStatus === 'REQUIRES_USER_CONFIRMATION')
  );

  return {
    id: tx.id,
    userId: tx.userId,
    tradingAccountId: tx.tradingAccountId,
    type: tx.type,
    direction: tx.direction,
    amount: roundMoney(Math.abs(Number(tx.amount ?? tx.signedAmount ?? 0))),
    signedAmount: roundMoney(Number(tx.signedAmount ?? 0)),
    currency: tx.currency || 'USD',
    occurredAt: tx.occurredAt instanceof Date ? tx.occurredAt.toISOString() : tx.occurredAt,
    note: tx.note || null,
    idempotencyKey: tx.idempotencyKey || null,
    transferGroupId: tx.transferGroupId || null,
    linkedPropFirmPayoutId: tx.linkedPropFirmPayoutId || null,
    archivedAt: tx.archivedAt ? (tx.archivedAt instanceof Date ? tx.archivedAt.toISOString() : tx.archivedAt) : null,
    archivedByUserId: tx.archivedByUserId || null,
    archiveReason: tx.archiveReason || null,
    editedAt: tx.editedAt ? (tx.editedAt instanceof Date ? tx.editedAt.toISOString() : tx.editedAt) : null,
    editHistory: tx.editHistory || null,
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
    updatedAt: tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : tx.updatedAt,
    resultingBalance,
    source: syncMeta.source,
    sourceLabel: syncMeta.sourceLabel,
    isReadOnly: syncMeta.isReadOnly,
    externalDealId: syncMeta.externalDealId,
    payoutClassificationStatus: syncMeta.payoutClassificationStatus,
    canConfirmAsPayout,
  };
};

const attachResultingBalances = ({ account = null, trades = [], transactions = [] } = {}) => {
  const safeTx = Array.isArray(transactions) ? transactions : [];
  const activeTx = safeTx.filter((tx) => tx && !tx.archivedAt);
  const hasOpeningRow = activeTx.some((tx) => String(tx.type || '').toUpperCase() === 'OPENING_BALANCE');

  const events = [];

  if (!hasOpeningRow && account && Number(account.startingBalance || 0) !== 0) {
    events.push({
      kind: 'SYNTHETIC_OPENING',
      type: 'OPENING_BALANCE',
      timestamp: toTimestampMs(account.createdAt),
      createdAtMs: toTimestampMs(account.createdAt),
      id: `synthetic-opening-${account.id || '0'}`,
      delta: roundMoney(account.startingBalance),
    });
  }

  for (const tx of activeTx) {
    events.push({
      kind: 'TRANSACTION',
      type: String(tx.type || '').toUpperCase(),
      timestamp: toTimestampMs(tx.occurredAt || tx.createdAt),
      createdAtMs: toTimestampMs(tx.createdAt || tx.occurredAt),
      id: String(tx.id || ''),
      txId: tx.id,
      delta: roundMoney(Number(tx.signedAmount ?? 0)),
    });
  }

  for (const trade of (trades || []).filter(isClosedTrade)) {
    const tradeTime = trade.exitTime || trade.updatedAt || trade.entryTime || trade.createdAt;
    events.push({
      kind: 'TRADE',
      type: 'TRADE',
      timestamp: toTimestampMs(tradeTime),
      createdAtMs: toTimestampMs(trade.createdAt || tradeTime),
      id: String(trade.id || ''),
      delta: roundMoney(Number(trade.profitLossAmount) || 0),
    });
  }

  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    const pDiff = (LEDGER_EVENT_PRIORITY[a.type] ?? 5) - (LEDGER_EVENT_PRIORITY[b.type] ?? 5);
    if (pDiff !== 0) return pDiff;
    if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
    return a.id.localeCompare(b.id);
  });

  let runningBalance = 0;
  const resultingByTxId = new Map();
  for (const ev of events) {
    runningBalance = roundMoney(runningBalance + ev.delta);
    if (ev.kind === 'TRANSACTION' && ev.txId) {
      resultingByTxId.set(ev.txId, runningBalance);
    }
  }

  const isPropFirmAccount = Boolean(account?.isPropFirmAccount || account?.accountCategory === 'PROP_FIRM');
  return safeTx.map((tx) => {
    const resultingBalance = tx.archivedAt ? null : (resultingByTxId.get(tx.id) ?? null);
    return serializeTransaction(tx, resultingBalance, { isPropFirmAccount });
  });
};

module.exports = {
  VALID_TYPES,
  VALID_DIRECTIONS,
  roundMoney,
  resolveTransactionSign,
  computeSignedTransactionAmounts,
  summarizeCashFlowTransactions,
  calculateAccountLedgerSummary,
  attachResultingBalances,
  serializeTransaction,
  extractTransactionSyncMeta,
};
