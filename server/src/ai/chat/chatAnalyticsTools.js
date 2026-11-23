/**
 * Dedicated Read-Only Analytics & Prop-Firm Tools for JAHZ AI Chat V2
 * Strictly scoped to req.user.id. Never modifies journal or account data.
 * Reuses existing canonical math & compliance engines without altering them.
 */

const { PrismaClient } = require('@prisma/client');
const defaultPrisma = new PrismaClient();
const { buildDashboardAnalytics } = require('../../services/dashboardAnalyticsService');
const { getPropFirmComplianceReport } = require('../../services/propFirmRuleEngine');
const { evaluateProposedTrade } = require('../../services/propFirmRiskGuardService');
const currencyService = require('../../services/fx/currencyService');
const {
  getTradeTimestamp,
  isClosedTrade,
  normalizeTradeResult,
  round,
} = require('../../utils/dashboardMath');

const SYMBOL_ALIASES = {
  GOLD: 'XAUUSD',
  BITCOIN: 'BTCUSD',
  ETHEREUM: 'ETHUSD',
  SILVER: 'XAGUSD',
};

const normalizePairQuery = (rawPair) => {
  if (!rawPair || typeof rawPair !== 'string') return '';
  const cleaned = rawPair.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return SYMBOL_ALIASES[cleaned] || cleaned;
};

const parseFilterDate = (value, endOfDay = false) => {
  if (value === undefined || value === null || value === '') {
    return { valid: true, date: null, normalized: null };
  }
  const str = String(value).trim();
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, date: null, normalized: null };
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return {
    valid: true,
    date: parsed,
    normalized: /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : parsed.toISOString().slice(0, 10),
  };
};

/**
 * Validates optional UI/tool context filters (accountId ownership & date range)
 * against the authenticated user before any journal query executes.
 */
const validateChatContextFilters = async (
  { userId, tradingAccountId = null, startDate = null, endDate = null } = {},
  db = defaultPrisma
) => {
  if (!userId) {
    return {
      valid: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Authentication is required.',
    };
  }

  let account = null;
  if (tradingAccountId !== undefined && tradingAccountId !== null && String(tradingAccountId).trim() !== '') {
    const cleanAccountId = String(tradingAccountId).trim();
    account = await db.tradingAccount.findFirst({
      where: { id: cleanAccountId, userId },
      select: {
        id: true,
        name: true,
        currency: true,
        isPropFirmAccount: true,
        accountCategory: true,
      },
    });

    if (!account) {
      return {
        valid: false,
        status: 403,
        code: 'INVALID_ACCOUNT_CONTEXT',
        message: 'The selected trading account is unavailable for your profile.',
      };
    }
  }

  const parsedStart = parseFilterDate(startDate, false);
  const parsedEnd = parseFilterDate(endDate, true);

  if (!parsedStart.valid || !parsedEnd.valid) {
    return {
      valid: false,
      status: 400,
      code: 'INVALID_DATE_RANGE',
      message: 'The supplied date filter is invalid. Use YYYY-MM-DD format.',
    };
  }

  if (parsedStart.date && parsedEnd.date && parsedStart.date > parsedEnd.date) {
    return {
      valid: false,
      status: 400,
      code: 'INVALID_DATE_RANGE',
      message: 'Start date cannot be after end date.',
    };
  }

  return {
    valid: true,
    account,
    startDate: parsedStart.normalized,
    endDate: parsedEnd.normalized,
    parsedStart: parsedStart.date,
    parsedEnd: parsedEnd.date,
  };
};

/**
 * Queries authoritative symbol/pair trade counts and P&L metrics scoped strictly to userId.
 */
const getSymbolTradeStats = async (
  {
    userId,
    pair,
    tradingAccountId = null,
    startDate = null,
    endDate = null,
    includeOpen = true,
  } = {},
  db = defaultPrisma
) => {
  const normalizedPair = normalizePairQuery(pair);
  if (!normalizedPair) {
    return {
      error: true,
      code: 'INVALID_PAIR',
      message: 'Please specify a trading pair or symbol (for example, XAUUSD or EURUSD).',
    };
  }

  const filterCheck = await validateChatContextFilters(
    { userId, tradingAccountId, startDate, endDate },
    db
  );
  if (!filterCheck.valid) {
    return {
      error: true,
      code: filterCheck.code,
      message: filterCheck.message,
    };
  }

  const rawTrades = await db.trade.findMany({
    where: {
      tradingAccount: { userId },
      ...(filterCheck.account ? { tradingAccountId: filterCheck.account.id } : {}),
    },
    select: {
      id: true,
      pair: true,
      direction: true,
      status: true,
      result: true,
      profitLossAmount: true,
      entryTime: true,
      exitTime: true,
      createdAt: true,
      fxRateToReporting: true,
      tradingAccount: {
        select: { id: true, name: true, currency: true },
      },
    },
  });

  // Match symbol + date range deterministically
  const matchingTrades = rawTrades.filter((trade) => {
    if (normalizePairQuery(trade.pair) !== normalizedPair) return false;
    if (filterCheck.parsedStart || filterCheck.parsedEnd) {
      const tsRaw = getTradeTimestamp(trade);
      if (!tsRaw) return false;
      const ts = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
      if (Number.isNaN(ts.getTime())) return false;
      if (filterCheck.parsedStart && ts < filterCheck.parsedStart) return false;
      if (filterCheck.parsedEnd && ts > filterCheck.parsedEnd) return false;
    }
    return true;
  });

  const closedList = matchingTrades.filter(isClosedTrade);
  const openList = matchingTrades.filter((t) => !isClosedTrade(t));

  let wins = 0;
  let losses = 0;
  let breakevens = 0;

  for (const t of closedList) {
    const res = normalizeTradeResult(t);
    if (res === 'WIN') wins += 1;
    else if (res === 'LOSS') losses += 1;
    else if (res === 'BREAKEVEN') breakevens += 1;
  }

  const winRate = closedList.length > 0 ? round((wins / closedList.length) * 100, 1) : 0;

  const currenciesSet = new Set(
    matchingTrades.map((t) => t.tradingAccount?.currency || 'USD')
  );
  if (currenciesSet.size === 0 && filterCheck.account?.currency) {
    currenciesSet.add(filterCheck.account.currency);
  }
  const currenciesPresent = [...currenciesSet];
  const isMultiCurrency = currenciesPresent.length > 1;
  const reportingCurrency = isMultiCurrency
    ? 'USD'
    : (currenciesPresent[0] || filterCheck.account?.currency || 'USD');

  // Aggregate closed Net P&L safely
  let netProfitLoss = 0;
  const fxRateCache = new Map();
  for (const t of closedList) {
    const rawPnl = Number(t.profitLossAmount || 0);
    const accCurr = t.tradingAccount?.currency || 'USD';
    if (!isMultiCurrency || accCurr === reportingCurrency) {
      netProfitLoss += rawPnl;
    } else if (t.fxRateToReporting && reportingCurrency === 'USD') {
      netProfitLoss += rawPnl * Number(t.fxRateToReporting);
    } else {
      let rate = fxRateCache.get(accCurr);
      if (rate === undefined) {
        try {
          const conv = await currencyService.convertAmount(1, accCurr, reportingCurrency);
          rate = conv?.convertedAmount ?? 1;
        } catch {
          rate = 1;
        }
        fxRateCache.set(accCurr, rate);
      }
      netProfitLoss += rawPnl * rate;
    }
  }

  const includeOpenFlag = includeOpen !== false;
  const totalTrades = matchingTrades.length;

  return {
    pair: normalizedPair,
    matchedPairLabels: [...new Set(matchingTrades.map((t) => t.pair))],
    scope: {
      accountId: filterCheck.account?.id || null,
      accountName: filterCheck.account?.name || 'All Accounts',
      isAllAccounts: !filterCheck.account,
      startDate: filterCheck.startDate || null,
      endDate: filterCheck.endDate || null,
      currency: reportingCurrency,
      isMultiCurrencyNormalized: isMultiCurrency,
      currenciesPresent,
    },
    includeOpen: includeOpenFlag,
    filteredTradeCount: includeOpenFlag ? totalTrades : closedList.length,
    totalTrades,
    closedTrades: closedList.length,
    openTrades: openList.length,
    wins,
    losses,
    breakevens,
    winRate,
    netProfitLoss: round(netProfitLoss, 2),
  };
};

/**
 * Full portfolio / session / pair overview reusing canonical buildDashboardAnalytics.
 */
const getChatDashboardAnalytics = async (
  { userId, tradingAccountId = null, startDate = null, endDate = null } = {},
  db = defaultPrisma
) => {
  const filterCheck = await validateChatContextFilters(
    { userId, tradingAccountId, startDate, endDate },
    db
  );
  if (!filterCheck.valid) {
    return {
      error: true,
      code: filterCheck.code,
      message: filterCheck.message,
    };
  }

  const query = {};
  if (filterCheck.account?.id) query.accountId = filterCheck.account.id;
  if (filterCheck.startDate) query.startDate = filterCheck.startDate;
  if (filterCheck.endDate) query.endDate = filterCheck.endDate;

  const analyticsData = await buildDashboardAnalytics({ userId, query });

  const recentRaw = await db.trade.findMany({
    where: {
      tradingAccount: { userId },
      ...(filterCheck.account ? { tradingAccountId: filterCheck.account.id } : {}),
    },
    orderBy: [{ entryTime: 'desc' }, { createdAt: 'desc' }],
    take: 15,
    select: {
      pair: true,
      direction: true,
      status: true,
      profitLossAmount: true,
      result: true,
      exitTime: true,
      entryTime: true,
      createdAt: true,
      tradingAccount: { select: { name: true, currency: true } },
    },
  });

  return {
    scope: {
      accountId: filterCheck.account?.id || null,
      accountName: filterCheck.account?.name || 'All Accounts',
      isAllAccounts: !filterCheck.account,
      startDate: analyticsData.filters?.startDate || null,
      endDate: analyticsData.filters?.endDate || null,
      currency: analyticsData.currency,
      isMultiAccountNormalized: analyticsData.isMultiAccountNormalized,
    },
    accounts: (analyticsData.accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      currentBalance: a.currentBalance,
      isPropFirmAccount: a.isPropFirmAccount,
    })),
    summary: analyticsData.summary,
    tradeOutcomes: analyticsData.tradeOutcomes,
    pairPerformance: analyticsData.pairPerformance,
    sessionPerformance: analyticsData.sessionPerformance,
    topPairs: analyticsData.topPairs,
    worstPairs: analyticsData.worstPairs,
    recentTradesPreview: recentRaw.map((t) => ({
      pair: t.pair,
      direction: t.direction,
      status: t.status,
      result: t.result,
      pnl: t.profitLossAmount != null ? Number(t.profitLossAmount) : null,
      currency: t.tradingAccount?.currency || 'USD',
      account: t.tradingAccount?.name || null,
      date: (t.exitTime || t.entryTime || t.createdAt)?.toISOString().split('T')[0],
    })),
    note: 'Use pairPerformance for all closed-trade pair counts or call getSymbolTradeStats for exact total/open/closed counts on a specific symbol.',
  };
};

const resolvePropFirmAccountIdForUser = async (userId, requestedAccountId, db = defaultPrisma) => {
  if (requestedAccountId !== undefined && requestedAccountId !== null && String(requestedAccountId).trim() !== '') {
    const check = await validateChatContextFilters({ userId, tradingAccountId: requestedAccountId }, db);
    if (!check.valid) {
      return { error: true, message: check.message };
    }
    return { error: false, accountId: check.account.id };
  }

  const firstPropAccount = await db.propFirmAccount.findFirst({
    where: { tradingAccount: { userId } },
    select: { tradingAccountId: true },
  });

  return {
    error: false,
    accountId: firstPropAccount?.tradingAccountId || null,
  };
};

const getChatPropFirmCompliance = async ({ userId, tradingAccountId = null } = {}, db = defaultPrisma) => {
  const resolved = await resolvePropFirmAccountIdForUser(userId, tradingAccountId, db);
  if (resolved.error) {
    return { error: true, message: resolved.message };
  }
  if (!resolved.accountId) {
    return { hasPropFirmAccount: false, message: 'No prop-firm account found for this trader.' };
  }
  const compliance = await getPropFirmComplianceReport(userId, resolved.accountId);
  return compliance || { hasPropFirmAccount: false, message: 'Prop-firm compliance data unavailable for the selected account.' };
};

const evaluateChatPropFirmRisk = async (
  {
    userId,
    tradingAccountId = null,
    lotSize,
    entryPrice,
    stopLoss,
    pair,
    direction = 'BUY',
    estimatedRiskAmount,
  } = {},
  db = defaultPrisma
) => {
  const resolved = await resolvePropFirmAccountIdForUser(userId, tradingAccountId, db);
  if (resolved.error) {
    return { error: true, message: resolved.message };
  }
  if (!resolved.accountId) {
    return { hasPropFirmAccount: false, message: 'No prop-firm account found to evaluate trade risk.' };
  }
  return evaluateProposedTrade({
    tradingAccountId: resolved.accountId,
    userId,
    lotSize,
    entryPrice,
    stopLoss,
    pair,
    direction,
    estimatedRiskAmount,
  });
};

const ANALYTICS_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getSymbolTradeStats',
      description:
        'Get exact trade counts (total, closed, open, wins, losses, breakevens, win rate, and net P&L) for a specific trading symbol/pair such as XAUUSD, EURUSD, or BTCUSD, scoped to the authenticated user and optional account or date range. Always call this when asked how many trades were taken on a specific symbol or how a specific pair performed.',
      parameters: {
        type: 'object',
        properties: {
          pair: {
            type: 'string',
            description: 'Instrument or currency pair symbol (e.g. XAUUSD, EURUSD, BTCUSD).',
          },
          tradingAccountId: {
            type: 'string',
            description: 'Optional trading account ID to scope the query. Omit for all accounts.',
          },
          startDate: {
            type: 'string',
            description: 'Optional inclusive start date (YYYY-MM-DD).',
          },
          endDate: {
            type: 'string',
            description: 'Optional inclusive end date (YYYY-MM-DD).',
          },
          includeOpen: {
            type: 'boolean',
            description: 'Whether to include open/active/planned trades alongside closed trades in filteredTradeCount (default true).',
          },
        },
        required: ['pair'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDashboardAnalytics',
      description:
        'Get overall trading performance metrics (summary, outcomes, full pairPerformance, sessionPerformance, accounts list, currency, and a 15-trade recent preview) scoped to the authenticated user and optional account/date filters.',
      parameters: {
        type: 'object',
        properties: {
          tradingAccountId: {
            type: 'string',
            description: 'Optional trading account ID. Omit for All Accounts.',
          },
          startDate: {
            type: 'string',
            description: 'Optional start date (YYYY-MM-DD).',
          },
          endDate: {
            type: 'string',
            description: 'Optional end date (YYYY-MM-DD).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPropFirmCompliance',
      description:
        'Get authoritative prop-firm compliance metrics (daily loss remaining, overall drawdown floor, profit target progress, minimum trading days, and rule warnings).',
      parameters: {
        type: 'object',
        properties: {
          tradingAccountId: {
            type: 'string',
            description: 'Optional specific prop-firm trading account ID. If omitted, evaluates primary prop-firm account.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'evaluatePropFirmTradeRisk',
      description:
        'Evaluate a proposed trade risk against the user prop-firm account rules (daily loss buffer, trailing floor, max lot size, restricted symbols). Note: advisory only.',
      parameters: {
        type: 'object',
        properties: {
          tradingAccountId: { type: 'string', description: 'Optional trading account ID' },
          lotSize: { type: 'number', description: 'Proposed lot size' },
          entryPrice: { type: 'number', description: 'Proposed entry price' },
          stopLoss: { type: 'number', description: 'Proposed stop loss price' },
          pair: { type: 'string', description: 'Currency or instrument symbol (e.g. XAUUSD, EURUSD)' },
          direction: { type: 'string', enum: ['BUY', 'SELL'], description: 'Trade direction' },
          estimatedRiskAmount: { type: 'number', description: 'Optional monetary risk amount' },
        },
        required: ['pair'],
      },
    },
  },
];

const SUPPORT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'searchProductSupport',
      description:
        'Search verified JAHZJOURNALS documentation covering what JAHZJOURNALS is, manual trade logging, Log Trades with JAHZ AI, screenshots & Screenshot Vision, rules/strategies/setups/emotions, daily & weekly reviews, Analytics & Edge Finder, Prop-Firm Cockpit, Economic Calendar, Risk Calculator, live pricing/plan limits, settings, and support.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The user question or feature topic to look up in verified JAHZJOURNALS documentation.',
          },
        },
        required: ['query'],
      },
    },
  },
];

module.exports = {
  normalizePairQuery,
  validateChatContextFilters,
  getSymbolTradeStats,
  getChatDashboardAnalytics,
  getChatPropFirmCompliance,
  evaluateChatPropFirmRisk,
  ANALYTICS_TOOL_DEFINITIONS,
  SUPPORT_TOOL_DEFINITIONS,
};
