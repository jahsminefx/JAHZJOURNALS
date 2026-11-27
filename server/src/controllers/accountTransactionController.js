const {
  getAccountTransactionsFlagMode,
  isAccountTransactionsEnabled,
} = require('../config/featureFlags');
const {
  createAccountTransactionSchema,
  updateAccountTransactionSchema,
  archiveAccountTransactionSchema,
  formatTransactionZodError,
} = require('../validation/accountTransactionSchemas');
const {
  listAccountTransactions,
  createAccountTransaction,
  updateAccountTransaction,
  archiveAccountTransaction,
  confirmSyncedTransactionAsPayout,
} = require('../services/accountTransactionService');

const sendSafeError = (res, error, fallbackMessage) => {
  if (error?.statusCode) {
    return res.status(error.statusCode).json({
      ...(error.code ? { error: error.code } : {}),
      message: error.message,
    });
  }

  console.error('[AccountTransactions]', error);
  return res.status(500).json({ message: fallbackMessage });
};

const getTransactionsFeatureStatus = async (req, res) => {
  return res.json({
    enabled: isAccountTransactionsEnabled(req.user || null),
    mode: getAccountTransactionsFlagMode(),
  });
};

const getGlobalTransactions = async (req, res) => {
  try {
    const result = await listAccountTransactions({
      userId: req.user.id,
      accountId: req.query.accountId ? String(req.query.accountId) : null,
      type: req.query.type || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      includeArchived: req.query.includeArchived === 'true',
      limit: req.query.limit || 200,
    });

    return res.json(result);
  } catch (error) {
    return sendSafeError(res, error, 'We couldn\'t load your account transactions right now.');
  }
};

const getAccountTransactions = async (req, res) => {
  try {
    const result = await listAccountTransactions({
      userId: req.user.id,
      accountId: req.params.accountId,
      type: req.query.type || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      includeArchived: req.query.includeArchived === 'true',
      limit: req.query.limit || 200,
    });

    return res.json(result);
  } catch (error) {
    return sendSafeError(res, error, 'We couldn\'t load transactions for this account right now.');
  }
};

const postAccountTransaction = async (req, res) => {
  try {
    const parsed = createAccountTransactionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json(formatTransactionZodError(parsed.error));
    }

    const headerKey = req.get('x-idempotency-key') || req.headers?.['x-idempotency-key'];
    const idempotencyKey = headerKey || parsed.data.idempotencyKey || null;

    const result = await createAccountTransaction({
      userId: req.user.id,
      accountId: req.params.accountId,
      payload: parsed.data,
      idempotencyKey,
    });

    return res.status(result.idempotentReplay ? 200 : 201).json(result);
  } catch (error) {
    return sendSafeError(res, error, 'We couldn\'t save that account transaction right now.');
  }
};

const putAccountTransaction = async (req, res) => {
  try {
    const parsed = updateAccountTransactionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json(formatTransactionZodError(parsed.error));
    }

    const result = await updateAccountTransaction({
      userId: req.user.id,
      accountId: req.params.accountId,
      transactionId: req.params.transactionId,
      payload: parsed.data,
    });

    return res.json(result);
  } catch (error) {
    return sendSafeError(res, error, 'We couldn\'t update that account transaction right now.');
  }
};

const postArchiveAccountTransaction = async (req, res) => {
  try {
    const parsed = archiveAccountTransactionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json(formatTransactionZodError(parsed.error));
    }

    const result = await archiveAccountTransaction({
      userId: req.user.id,
      accountId: req.params.accountId,
      transactionId: req.params.transactionId,
      reason: parsed.data.reason || null,
    });

    return res.json(result);
  } catch (error) {
    return sendSafeError(res, error, 'We couldn\'t archive that account transaction right now.');
  }
};

const postConfirmSyncedPayout = async (req, res) => {
  try {
    const result = await confirmSyncedTransactionAsPayout({
      userId: req.user.id,
      accountId: req.params.accountId,
      transactionId: req.params.transactionId,
    });

    return res.json(result);
  } catch (error) {
    return sendSafeError(res, error, 'We couldn\'t confirm that payout right now.');
  }
};

module.exports = {
  getTransactionsFeatureStatus,
  getGlobalTransactions,
  getAccountTransactions,
  postAccountTransaction,
  putAccountTransaction,
  postArchiveAccountTransaction,
  postConfirmSyncedPayout,
};
