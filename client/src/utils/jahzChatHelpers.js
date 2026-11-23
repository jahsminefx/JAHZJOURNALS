/**
 * Shared client helpers for JAHZ AI Chat V2
 * Keeps mode histories separate, filters noise before submission,
 * and maps errors to clear, safe, actionable user states.
 */

export const DEFAULT_CHAT_GREETINGS = {
  ANALYTICS: {
    role: 'assistant',
    isGreeting: true,
    content:
      'Hello! I am JAHZ AI (Analytics Mode). Ask about your symbol counts (e.g. XAUUSD), win rate, P&L, or prop-firm risk status.',
  },
  SUPPORT: {
    role: 'assistant',
    isGreeting: true,
    content:
      'Hello! I am JAHZ AI (App Support Mode). Ask me about JAHZJOURNALS features, logging trades manually or with JAHZ AI, screenshots, rules, plans, or settings.',
  },
};

export const createInitialMessagesByMode = () => ({
  ANALYTICS: [{ ...DEFAULT_CHAT_GREETINGS.ANALYTICS }],
  SUPPORT: [{ ...DEFAULT_CHAT_GREETINGS.SUPPORT }],
});

/**
 * Strips client-only greetings and inline error cards before sending history to the backend.
 */
export const buildChatRequestMessages = (messages = []) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        typeof m === 'object' &&
        !m.isGreeting &&
        !m.isError &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim(),
    }))
    .slice(-20);
};

/**
 * Extracts optional active dashboard/trades filter params from URL search string.
 */
export const extractActiveAnalyticsContext = (searchOrParams) => {
  if (!searchOrParams) return undefined;
  const params =
    searchOrParams instanceof URLSearchParams
      ? searchOrParams
      : new URLSearchParams(String(searchOrParams));

  const accountId = params.get('accountId')?.trim();
  const startDate = params.get('startDate')?.trim();
  const endDate = params.get('endDate')?.trim();

  if (!accountId && !startDate && !endDate) {
    return undefined;
  }

  const context = {};
  if (accountId) context.accountId = accountId;
  if (startDate) context.startDate = startDate;
  if (endDate) context.endDate = endDate;
  return context;
};

/**
 * Maps API and transport errors to safe, non-technical, actionable UI states.
 * Never leaks raw Prisma, SQL, stack-trace, or provider messages for 5xx/unexpected errors.
 */
export const mapChatError = (error, chatMode = 'ANALYTICS') => {
  if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
    return { cancelled: true };
  }

  const status = error?.response?.status;
  const data = error?.response?.data || {};
  const errorCode = data?.error || '';

  if (status === 401) {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please sign in again to continue using JAHZ AI.',
      retryable: false,
      actionLabel: 'Sign In',
      actionPath: '/login',
    };
  }

  if (status === 403) {
    if (errorCode === 'AI_DISABLED_IN_SETTINGS') {
      return {
        code: 'AI_DISABLED_IN_SETTINGS',
        message:
          'JAHZ AI is currently turned off in your privacy settings. Open AI Privacy & Usage to enable it.',
        retryable: false,
        actionLabel: 'Open AI Settings',
        actionPath: '/ai/usage',
      };
    }

    if (errorCode === 'TRADE_ANALYSIS_DISABLED') {
      return {
        code: 'TRADE_ANALYSIS_DISABLED',
        message:
          'Trade data analysis is turned off in your privacy settings. Enable "Allow trade data analysis" under AI Privacy & Usage to query journal metrics.',
        retryable: false,
        actionLabel: 'Open AI Settings',
        actionPath: '/ai/usage',
      };
    }

    if (errorCode === 'PLAN_LIMIT_REACHED') {
      return {
        code: 'PLAN_LIMIT_REACHED',
        message:
          typeof data.message === 'string' && data.message.trim()
            ? data.message
            : 'You have reached your monthly JAHZ AI limit on your current plan. Upgrade to continue.',
        retryable: false,
        actionLabel: 'View Plans',
        actionPath: '/pricing',
      };
    }

    if (errorCode === 'INVALID_ACCOUNT_CONTEXT') {
      return {
        code: 'INVALID_ACCOUNT_CONTEXT',
        message: 'The selected trading account filter is no longer available.',
        retryable: false,
        actionLabel: 'View Accounts',
        actionPath: '/accounts',
      };
    }

    return {
      code: 'FORBIDDEN',
      message: 'You do not currently have access to this JAHZ AI feature.',
      retryable: false,
      actionLabel: 'View Plans',
      actionPath: '/pricing',
    };
  }

  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      message: 'You have sent several AI requests in a short window. Please wait up to 60 seconds and retry.',
      retryable: true,
    };
  }

  if (status === 400) {
    return {
      code: 'BAD_REQUEST',
      message:
        typeof data.message === 'string' && data.message.length < 180
          ? data.message
          : 'Please enter a clear question and try again.',
      retryable: false,
    };
  }

  if (status === 504 || errorCode === 'AI_TIMEOUT' || error?.code === 'ECONNABORTED') {
    return {
      code: 'AI_TIMEOUT',
      message: 'JAHZ AI timed out waiting for a response. No journal data was changed—please retry.',
      retryable: true,
    };
  }

  if (status === 503 || errorCode === 'ANALYTICS_UNAVAILABLE' || errorCode === 'AI_PROVIDER_UNAVAILABLE') {
    if (errorCode === 'ANALYTICS_UNAVAILABLE') {
      return {
        code: 'ANALYTICS_UNAVAILABLE',
        message: 'Your analytics data is temporarily unavailable. No journal data was changed—please retry.',
        retryable: true,
      };
    }
    return {
      code: 'AI_PROVIDER_UNAVAILABLE',
      message:
        chatMode === 'ANALYTICS'
          ? 'JAHZ AI is temporarily unavailable. No journal data was changed—please retry shortly.'
          : 'JAHZ AI App Support is temporarily unavailable. Please retry or switch to the Support Chat tab.',
      retryable: true,
    };
  }

  if (!error?.response) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Could not connect to JAHZJOURNALS servers. Check your connection and retry—no data was changed.',
      retryable: true,
    };
  }

  // Catch-all for 500 or unexpected responses: never surface internal backend text
  return {
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong while processing your request. No journal data was changed. Please try again.',
    retryable: true,
  };
};
