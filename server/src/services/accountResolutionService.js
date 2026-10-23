/**
 * JAHZJOURNALS — Intelligent Trading Account Resolution & Currency Context Service
 *
 * Implements a strict, deterministic hierarchy for resolving trading accounts and
 * establishing authoritative currency context for captured trades:
 *
 * Hierarchy:
 * 1. An explicitly selected account in the current capture is the default context.
 * 2. An explicit account name or identifier in the user's message can identify an account,
 *    but if it conflicts with the current selection, requests confirmation before switching.
 * 3. Screenshot-derived broker or account identifiers match against authenticated user accounts;
 *    if conflicting with the current selection, requests confirmation before switching.
 * 4. If multiple accounts remain plausible and none is selected, flags as AMBIGUOUS and prompts the user.
 * 5. If the account cannot be established reliably, never silently guesses or saves under an arbitrary account.
 *
 * Currency Invariants:
 * - Authoritative currency comes exclusively from the trusted database TradingAccount record.
 * - Account currency applies to monetary values (gross profit, commission, swap, fees, net profit, balance).
 * - Distinguishes monetary values from instrument quote prices, volumes (lots), and pips.
 * - Detects and flags currency conflicts (e.g., screenshot shows EUR but account is USD).
 */

const normalizeStr = (v) => String(v || '').trim().toLowerCase();

/**
 * Searches user's authorized trading accounts for a match against an identifier,
 * account name, broker name, prop firm, or MT account number.
 *
 * @param {string} identifier - Search term or extracted account hint
 * @param {Array} userAccounts - Authorized TradingAccount records belonging to user
 * @returns {Object|null} Matching account or null
 */
const findMatchingAccount = (identifier, userAccounts = []) => {
  if (!identifier || !Array.isArray(userAccounts) || userAccounts.length === 0) {
    return null;
  }

  const query = normalizeStr(identifier);
  if (!query) return null;

  // 1. Direct ID match
  const idMatch = userAccounts.find((a) => normalizeStr(a.id) === query);
  if (idMatch) return idMatch;

  // 2. Exact MT account number or cloud login match
  const loginMatch = userAccounts.find(
    (a) =>
      (a.mtAccountNumber && normalizeStr(a.mtAccountNumber) === query) ||
      (a.cloudLogin && normalizeStr(a.cloudLogin) === query)
  );
  if (loginMatch) return loginMatch;

  // 3. Exact Account Name match
  const exactNameMatch = userAccounts.find((a) => normalizeStr(a.name) === query);
  if (exactNameMatch) return exactNameMatch;

  // 4. Substring Name match (query contained in account name or vice versa)
  const nameSubMatch = userAccounts.find(
    (a) => normalizeStr(a.name).includes(query) || query.includes(normalizeStr(a.name))
  );
  if (nameSubMatch) return nameSubMatch;

  // 5. Broker or Prop Firm name match
  const brokerMatch = userAccounts.find(
    (a) =>
      (a.brokerName && normalizeStr(a.brokerName).includes(query)) ||
      (a.propFirmName && normalizeStr(a.propFirmName).includes(query)) ||
      (a.brokerName && query.includes(normalizeStr(a.brokerName))) ||
      (a.propFirmName && query.includes(normalizeStr(a.propFirmName)))
  );
  if (brokerMatch) return brokerMatch;

  return null;
};

/**
 * Resolves the trading account according to the mandated hierarchy.
 *
 * @param {Object} params
 * @param {string} [params.currentAccountId] - Currently selected account ID in the UI/draft
 * @param {string} [params.requestedAccountName] - Account name/hint from user's message
 * @param {Object} [params.screenshotAccountInfo] - Account info from screenshot OCR (accountNumber, brokerName)
 * @param {Array} params.userAccounts - All accounts belonging to the authenticated user
 * @returns {Object} Resolution result
 */
const resolveAccountHierarchy = ({
  currentAccountId = null,
  requestedAccountName = null,
  screenshotAccountInfo = {},
  userAccounts = [],
}) => {
  // Case 0: User has no accounts
  if (!Array.isArray(userAccounts) || userAccounts.length === 0) {
    return {
      status: 'NO_ACCOUNTS',
      resolvedAccount: null,
      authoritativeCurrency: 'USD',
      requiresConfirmation: false,
      isAmbiguous: true,
      message: 'No trading accounts exist for this user. An account must be created before logging trades.',
    };
  }

  // Find currently selected account if provided
  const currentAccount = currentAccountId
    ? userAccounts.find((a) => a.id === currentAccountId) || null
    : null;

  // Step 2 in Hierarchy: Check user message for explicit account mention
  const messageMatchedAccount = requestedAccountName
    ? findMatchingAccount(requestedAccountName, userAccounts)
    : null;

  // Step 3 in Hierarchy: Check screenshot OCR for account identifier / broker
  const screenshotLogin = screenshotAccountInfo?.accountNumber || screenshotAccountInfo?.login || null;
  const screenshotBroker = screenshotAccountInfo?.brokerName || screenshotAccountInfo?.platform || null;
  
  let screenshotMatchedAccount = null;
  if (screenshotLogin) {
    screenshotMatchedAccount = findMatchingAccount(screenshotLogin, userAccounts);
  }
  if (!screenshotMatchedAccount && screenshotBroker) {
    screenshotMatchedAccount = findMatchingAccount(screenshotBroker, userAccounts);
  }

  // Conflict Detection: Message mentions Account B while Account A is selected
  if (
    messageMatchedAccount &&
    currentAccount &&
    messageMatchedAccount.id !== currentAccount.id
  ) {
    return {
      status: 'CONFIRMATION_REQUIRED',
      resolvedAccount: currentAccount,
      suggestedAccount: messageMatchedAccount,
      authoritativeCurrency: currentAccount.currency || 'USD',
      requiresConfirmation: true,
      conflictType: 'USER_MESSAGE_CONFLICT',
      conflictReason: `You mentioned "${requestedAccountName}" which matches "${messageMatchedAccount.name}" (${messageMatchedAccount.currency}), but "${currentAccount.name}" (${currentAccount.currency}) is currently selected.`,
    };
  }

  // Conflict Detection: Screenshot indicates Account B while Account A is selected
  if (
    screenshotMatchedAccount &&
    currentAccount &&
    screenshotMatchedAccount.id !== currentAccount.id
  ) {
    return {
      status: 'CONFIRMATION_REQUIRED',
      resolvedAccount: currentAccount,
      suggestedAccount: screenshotMatchedAccount,
      authoritativeCurrency: currentAccount.currency || 'USD',
      requiresConfirmation: true,
      conflictType: 'SCREENSHOT_METADATA_CONFLICT',
      conflictReason: `Screenshot indicates broker/account "${screenshotLogin || screenshotBroker}" which matches "${screenshotMatchedAccount.name}" (${screenshotMatchedAccount.currency}), but "${currentAccount.name}" (${currentAccount.currency}) is currently selected.`,
    };
  }

  // Step 1: If current account is explicitly selected and valid, it is the default context
  if (currentAccount) {
    return {
      status: 'RESOLVED',
      resolvedAccount: currentAccount,
      authoritativeCurrency: currentAccount.currency || 'USD',
      requiresConfirmation: false,
      isAmbiguous: false,
      message: `Resolved to currently selected account "${currentAccount.name}" (${currentAccount.currency}).`,
    };
  }

  // If no current account was selected, try message matched account
  if (messageMatchedAccount) {
    return {
      status: 'RESOLVED',
      resolvedAccount: messageMatchedAccount,
      authoritativeCurrency: messageMatchedAccount.currency || 'USD',
      requiresConfirmation: false,
      isAmbiguous: false,
      message: `Resolved from message to "${messageMatchedAccount.name}" (${messageMatchedAccount.currency}).`,
    };
  }

  // If no current account and no message match, try screenshot matched account
  if (screenshotMatchedAccount) {
    return {
      status: 'RESOLVED',
      resolvedAccount: screenshotMatchedAccount,
      authoritativeCurrency: screenshotMatchedAccount.currency || 'USD',
      requiresConfirmation: false,
      isAmbiguous: false,
      message: `Resolved from screenshot to "${screenshotMatchedAccount.name}" (${screenshotMatchedAccount.currency}).`,
    };
  }

  // Convenient Default: Single-account user
  if (userAccounts.length === 1) {
    const single = userAccounts[0];
    return {
      status: 'RESOLVED',
      resolvedAccount: single,
      authoritativeCurrency: single.currency || 'USD',
      requiresConfirmation: false,
      isAmbiguous: false,
      isSingleAccountDefault: true,
      message: `Defaulted to user's only trading account "${single.name}" (${single.currency}).`,
    };
  }

  // Step 4 in Hierarchy: Multiple accounts exist and none established reliably
  return {
    status: 'AMBIGUOUS',
    resolvedAccount: null,
    authoritativeCurrency: 'USD',
    requiresConfirmation: true,
    isAmbiguous: true,
    candidateAccounts: userAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency || 'USD',
      currentBalance: a.currentBalance,
      brokerName: a.brokerName || a.propFirmName || null,
    })),
    message: 'Which trading account should this trade belong to?',
  };
};

/**
 * Validates currency consistency between the authoritative trading account currency
 * and any explicit currency detected from a screenshot or trade receipt.
 *
 * @param {Object} params
 * @param {Object} params.account - Authoritative TradingAccount record
 * @param {string} [params.screenshotCurrency] - Explicit currency detected from screenshot
 * @returns {Object} Validation report
 */
const detectCurrencyConflict = ({ account, screenshotCurrency = null }) => {
  if (!account) {
    return {
      hasCurrencyConflict: false,
      accountCurrency: 'USD',
      screenshotCurrency: null,
      warning: null,
    };
  }

  const accountCurr = String(account.currency || 'USD').toUpperCase().trim();
  const screenCurr = screenshotCurrency
    ? String(screenshotCurrency).toUpperCase().trim()
    : null;

  if (screenCurr && screenCurr !== accountCurr) {
    return {
      hasCurrencyConflict: true,
      accountCurrency: accountCurr,
      screenshotCurrency: screenCurr,
      warning: `Currency mismatch: Screenshot indicates ${screenCurr}, but target account "${account.name}" is denominated in ${accountCurr}. Financial amounts marked for review.`,
    };
  }

  return {
    hasCurrencyConflict: false,
    accountCurrency: accountCurr,
    screenshotCurrency: screenCurr,
    warning: null,
  };
};

/**
 * Distinguishes monetary profit/loss from price, volume, pips, or points.
 * Prevents ambiguous numbers like '2.25' from being blindly assigned.
 *
 * @param {Object} params
 * @param {number|string} params.candidateValue - Raw extracted numeric value
 * @param {string} [params.labelContext] - Surrounding text label (e.g. 'Profit', 'Pips', 'Lots')
 * @param {number} [params.entryPrice] - Trade entry price
 * @param {number} [params.lotSize] - Trade lot size
 * @returns {Object} Classification of numeric value
 */
const disambiguateMonetaryValue = ({
  candidateValue,
  labelContext = '',
  entryPrice = null,
  lotSize = null,
}) => {
  const val = Number(candidateValue);
  if (Number.isNaN(val) || candidateValue === null || candidateValue === undefined) {
    return { metricType: 'UNKNOWN', value: null, isMonetary: false };
  }

  const ctx = normalizeStr(labelContext);

  if (ctx.includes('pip') || ctx.includes('point') || ctx.includes('pts')) {
    return { metricType: 'PIPS', value: val, isMonetary: false };
  }

  if (ctx.includes('lot') || ctx.includes('volume') || ctx.includes('size')) {
    return { metricType: 'VOLUME', value: val, isMonetary: false };
  }

  if (ctx.includes('price') || ctx.includes('open') || ctx.includes('close') || ctx.includes('rate')) {
    return { metricType: 'PRICE', value: val, isMonetary: false };
  }

  if (ctx.includes('profit') || ctx.includes('p&l') || ctx.includes('p/l') || ctx.includes('gain') || ctx.includes('loss')) {
    const isNet = ctx.includes('net') || !ctx.includes('gross');
    return { metricType: isNet ? 'NET_PROFIT' : 'GROSS_PROFIT', value: val, isMonetary: true };
  }

  if (ctx.includes('commission') || ctx.includes('comm')) {
    return { metricType: 'COMMISSION', value: val, isMonetary: true };
  }

  if (ctx.includes('swap')) {
    return { metricType: 'SWAP', value: val, isMonetary: true };
  }

  if (ctx.includes('fee')) {
    return { metricType: 'FEES', value: val, isMonetary: true };
  }

  // Heuristic disambiguation if label context is absent or ambiguous
  // If entry price is ~82,000 (e.g. BTC) and candidate value is 2.25, it's NOT a price.
  if (entryPrice && Math.abs(val - entryPrice) / entryPrice < 0.05) {
    return { metricType: 'PRICE_HEURISTIC', value: val, isMonetary: false };
  }

  // Default to monetary with needs_review if in typical PnL scale
  return { metricType: 'MONETARY_CANDIDATE', value: val, isMonetary: true, requiresVerification: true };
};

module.exports = {
  findMatchingAccount,
  resolveAccountHierarchy,
  detectCurrencyConflict,
  disambiguateMonetaryValue,
};
