/**
 * Runtime Feature Flags for Safe Dark-Launch & Rollback
 */

const normalizeFlagValue = (value) => String(value ?? '').trim().toLowerCase();

const parseAllowlist = () => String(process.env.ACCOUNT_TRANSACTIONS_ALLOWLIST || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const getAccountTransactionsFlagMode = () => {
  const raw = normalizeFlagValue(process.env.ACCOUNT_TRANSACTIONS_ENABLED);
  if (raw === 'false' || raw === '0') return 'DISABLED';
  if (raw === 'true' || raw === '1') return 'ENABLED';
  if (raw === 'admin_only' || raw === 'staging') return 'ADMIN_ONLY';
  return 'ENABLED_DEFAULT';
};

/**
 * Checks whether Account Transactions / Cash Flow ledger is enabled for the given user.
 */
const isAccountTransactionsEnabled = (user = null) => {
  const raw = normalizeFlagValue(process.env.ACCOUNT_TRANSACTIONS_ENABLED);

  if (raw === 'false' || raw === '0') {
    return false;
  }

  if (raw === 'true' || raw === '1') {
    return true;
  }

  if (raw === 'admin_only' || raw === 'staging') {
    if (!user) return false;
    const role = String(user.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      return true;
    }

    const allowlist = parseAllowlist();
    if (allowlist.length === 0) return false;

    const userId = String(user.id || '').trim().toLowerCase();
    const userEmail = String(user.email || '').trim().toLowerCase();
    return Boolean((userId && allowlist.includes(userId)) || (userEmail && allowlist.includes(userEmail)));
  }

  // Enabled by default across environments; set ACCOUNT_TRANSACTIONS_ENABLED=false to roll back cleanly
  return true;
};

/**
 * Express middleware gating Account Transactions write/read endpoints by feature flag.
 */
const requireAccountTransactionsEnabled = (req, res, next) => {
  if (!isAccountTransactionsEnabled(req.user || null)) {
    return res.status(503).json({
      error: 'FEATURE_DISABLED',
      message: 'Account Transactions is currently unavailable.',
    });
  }
  return next();
};

module.exports = {
  getAccountTransactionsFlagMode,
  isAccountTransactionsEnabled,
  requireAccountTransactionsEnabled,
};
