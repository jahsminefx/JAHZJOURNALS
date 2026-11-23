/**
 * JAHZ AI Chat V2 Orchestration Service
 * Completely isolated from Log Trades with JAHZ AI and background AI jobs.
 * Uses only generateChatCompletion() and read-only scoped tools.
 */

const { PrismaClient } = require('@prisma/client');
const defaultPrisma = new PrismaClient();
const { getProvider: defaultGetProvider } = require('../providers/providerFactory');
const { sanitizeAiInput } = require('../utils/sanitizeAiInput');
const { checkAiAllowance: defaultCheckAiAllowance } = require('../../services/entitlementService');
const { searchProductKnowledge } = require('./productKnowledge');
const {
  CHAT_PROMPT_VERSION,
  SIGNAL_REFUSAL_MESSAGE,
  detectProhibitedSignalRequest,
  buildAnalyticsSystemPrompt,
  buildSupportSystemPrompt,
} = require('./chatPrompts');
const {
  validateChatContextFilters,
  getSymbolTradeStats,
  getChatDashboardAnalytics,
  getChatPropFirmCompliance,
  evaluateChatPropFirmRisk,
  ANALYTICS_TOOL_DEFINITIONS,
  SUPPORT_TOOL_DEFINITIONS,
} = require('./chatAnalyticsTools');

const CHAT_MODEL_TIMEOUT_MS = 25000;

const isChatV2Enabled = () => process.env.JAHZ_AI_CHAT_V2_ENABLED !== 'false';

const callWithTimeout = async (promise, ms = CHAT_MODEL_TIMEOUT_MS, code = 'AI_TIMEOUT') => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`Chat model request timed out after ${ms}ms`);
      err.code = code;
      reject(err);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const KNOWN_CLIENT_NOISE_PREFIXES = [
  'Hello! I am JAHZ AI.',
  'Connection issue. Could not reach analytics.',
  '⚠️',
];

const isClientNoiseMessage = (msg) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.isGreeting === true || msg.isError === true) return true;
  if (msg.role === 'assistant' && typeof msg.content === 'string') {
    return KNOWN_CLIENT_NOISE_PREFIXES.some((prefix) => msg.content.trim().startsWith(prefix));
  }
  return false;
};

const validateAndSanitizeChatMessages = (messages) => {
  if (!messages || !Array.isArray(messages)) {
    return { valid: false, status: 400, message: 'Messages array is required.' };
  }
  if (messages.length === 0) {
    return { valid: false, status: 400, message: 'Messages array cannot be empty.' };
  }

  const bounded = messages.slice(-20);
  const sanitized = [];

  for (const msg of bounded) {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, status: 400, message: 'Malformed message item.' };
    }
    if (isClientNoiseMessage(msg)) {
      continue;
    }

    // Clamp role strictly to assistant or user (prevent system/tool injection)
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const rawContent = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content || '');
    const cleaned = sanitizeAiInput(rawContent.slice(0, 3000));

    if (!cleaned) continue;
    sanitized.push({ role, content: cleaned });
  }

  // Drop leading assistant turns so conversation begins cleanly with a user turn
  while (sanitized.length > 0 && sanitized[0].role !== 'user') {
    sanitized.shift();
  }

  if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
    return { valid: false, status: 400, message: 'Please enter a message to ask JAHZ AI.' };
  }

  return { valid: true, messages: sanitized };
};

const classifySafeClientError = (error, correlationId) => {
  const code = error?.code || '';
  const msg = String(error?.message || '');

  if (code === 'AI_TIMEOUT' || /timed out/i.test(msg)) {
    return {
      status: 504,
      body: {
        error: 'AI_TIMEOUT',
        message: 'JAHZ AI took too long to respond. Please try again.',
        retryable: true,
        correlationId,
      },
    };
  }

  if (code === 'ANALYTICS_UNAVAILABLE') {
    return {
      status: 503,
      body: {
        error: 'ANALYTICS_UNAVAILABLE',
        message: 'Analytics data is temporarily unavailable. No journal data was changed. Please try again.',
        retryable: true,
        correlationId,
      },
    };
  }

  if (
    code === 'AI_PROVIDER_UNAVAILABLE' ||
    /OpenRouter|OpenAI|API_KEY|api key|fetch failed|ECONNREFUSED|ENOTFOUND|429|502|503/i.test(msg)
  ) {
    return {
      status: 503,
      body: {
        error: 'AI_PROVIDER_UNAVAILABLE',
        message: 'JAHZ AI is temporarily unavailable. Please try again shortly.',
        retryable: true,
        correlationId,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong while processing your request. No journal data was changed. Please try again.',
      retryable: true,
      correlationId,
    },
  };
};

const getActiveProviderMeta = () => {
  const providerName = (process.env.AI_PROVIDER || 'openrouter').toLowerCase() === 'openai'
    ? 'openai'
    : 'openrouter';
  const modelName = providerName === 'openai'
    ? (process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini')
    : (process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini');
  return { providerName, modelName };
};

/**
 * Main JAHZ AI Chat V2 request handler.
 */
const handleChatV2 = async (req, res, deps = {}) => {
  const prisma = deps.prisma || defaultPrisma;
  const getProvider = deps.getProvider || defaultGetProvider;
  const checkAiAllowance = deps.checkAiAllowance || defaultCheckAiAllowance;

  let aiReq = null;
  const correlationId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const rawMode = req.body?.chatMode;
    const chatMode = rawMode === undefined || rawMode === null || rawMode === '' ? 'ANALYTICS' : rawMode;
    if (chatMode !== 'ANALYTICS' && chatMode !== 'SUPPORT') {
      return res.status(400).json({
        error: 'INVALID_CHAT_MODE',
        message: 'Invalid chat mode. Expected ANALYTICS or SUPPORT.',
      });
    }

    const msgValidation = validateAndSanitizeChatMessages(req.body?.messages);
    if (!msgValidation.valid) {
      return res.status(msgValidation.status).json({ message: msgValidation.message });
    }
    const sanitizedMessages = msgValidation.messages;
    const lastUserMessage = sanitizedMessages[sanitizedMessages.length - 1].content;

    const featureType = chatMode === 'ANALYTICS' ? 'ANALYTICS_ASSISTANT' : 'SUPPORT_ASSISTANT';

    // Enforce AI enablement, trade-data privacy setting, and plan quota in BOTH modes
    const limitCheck = await checkAiAllowance(req.user, featureType, prisma);
    if (!limitCheck.allowed) {
      return res.status(403).json(limitCheck.payload);
    }

    // Read saveAiHistory preference cleanly without breaking mocks that omit userSettings
    let saveHistory = true;
    try {
      const settingsRow = await prisma.userSettings?.findUnique?.({
        where: { userId: req.user.id },
        select: { saveAiHistory: true },
      });
      if (settingsRow && settingsRow.saveAiHistory === false) {
        saveHistory = false;
      }
    } catch {
      saveHistory = true;
    }

    // Validate optional UI filter context strictly in Analytics Mode; ignore completely in Support Mode
    let validatedContext = null;
    if (chatMode === 'ANALYTICS') {
      const rawCtx = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
      const ctxCheck = await validateChatContextFilters(
        {
          userId: req.user.id,
          tradingAccountId: rawCtx.accountId || null,
          startDate: rawCtx.startDate || null,
          endDate: rawCtx.endDate || null,
        },
        prisma
      );
      if (!ctxCheck.valid) {
        return res.status(ctxCheck.status).json({
          error: ctxCheck.code,
          message: ctxCheck.message,
        });
      }
      validatedContext = ctxCheck;
    }

    const { providerName, modelName } = getActiveProviderMeta();

    // Deterministic policy guard for buy/sell signals and market predictions
    if (detectProhibitedSignalRequest(lastUserMessage)) {
      if (prisma.aiRequest?.create) {
        await prisma.aiRequest.create({
          data: {
            userId: req.user.id,
            featureType,
            status: 'COMPLETED',
            provider: 'policy-guard',
            model: 'deterministic-signal-guard',
            promptVersion: CHAT_PROMPT_VERSION,
            startedAt: new Date(),
            completedAt: new Date(),
            rawResponse: saveHistory ? { content: SIGNAL_REFUSAL_MESSAGE } : null,
            inputTokens: 0,
            outputTokens: 0,
          },
        }).catch(() => null);
      }

      return res.json({
        message: SIGNAL_REFUSAL_MESSAGE,
        mode: chatMode,
        guarded: true,
      });
    }

    // Create AiRequest audit ledger entry using valid Prisma AiFeatureType enum
    if (prisma.aiRequest?.create) {
      aiReq = await prisma.aiRequest.create({
        data: {
          userId: req.user.id,
          featureType,
          status: 'PROCESSING',
          provider: providerName,
          model: modelName,
          promptVersion: CHAT_PROMPT_VERSION,
          startedAt: new Date(),
        },
      }).catch((err) => {
        console.error('[JAHZ AI Chat V2] Ledger create failed:', err.message);
        return null;
      });
    }

    const systemMessage = {
      role: 'system',
      content: chatMode === 'ANALYTICS'
        ? buildAnalyticsSystemPrompt(validatedContext)
        : buildSupportSystemPrompt(),
    };

    const tools = chatMode === 'ANALYTICS'
      ? ANALYTICS_TOOL_DEFINITIONS
      : SUPPORT_TOOL_DEFINITIONS;
    const allowedToolNames = new Set(tools.map((t) => t.function.name));

    const payloadMessages = [systemMessage, ...sanitizedMessages];
    const provider = getProvider();

    // Round 1 LLM call
    const response1 = await callWithTimeout(
      provider.generateChatCompletion(payloadMessages, tools),
      CHAT_MODEL_TIMEOUT_MS,
      'AI_TIMEOUT'
    );
    const message1 = response1?.message || {};

    let finalContent = '';
    let inputTokens = response1?.usage?.prompt_tokens || 0;
    let outputTokens = response1?.usage?.completion_tokens || 0;
    let actualProvider = response1?.provider || providerName;
    let actualModel = response1?.model || modelName;

    if (Array.isArray(message1.tool_calls) && message1.tool_calls.length > 0) {
      payloadMessages.push(message1);

      for (const toolCall of message1.tool_calls) {
        const toolName = toolCall?.function?.name;
        if (!allowedToolNames.has(toolName)) {
          payloadMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: true,
              message: `Tool "${toolName}" is not permitted in ${chatMode} mode.`,
            }),
          });
          continue;
        }

        let args = {};
        try {
          args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
        } catch {
          args = {};
        }

        if (chatMode === 'ANALYTICS') {
          let toolResult;
          try {
            if (toolName === 'getSymbolTradeStats') {
              toolResult = await getSymbolTradeStats(
                {
                  userId: req.user.id,
                  pair: args.pair,
                  tradingAccountId: args.tradingAccountId ?? validatedContext?.account?.id ?? null,
                  startDate: args.startDate ?? validatedContext?.startDate ?? null,
                  endDate: args.endDate ?? validatedContext?.endDate ?? null,
                  includeOpen: args.includeOpen,
                },
                prisma
              );
            } else if (toolName === 'getDashboardAnalytics') {
              toolResult = await getChatDashboardAnalytics(
                {
                  userId: req.user.id,
                  tradingAccountId: args.tradingAccountId ?? validatedContext?.account?.id ?? null,
                  startDate: args.startDate ?? validatedContext?.startDate ?? null,
                  endDate: args.endDate ?? validatedContext?.endDate ?? null,
                },
                prisma
              );
            } else if (toolName === 'getPropFirmCompliance') {
              toolResult = await getChatPropFirmCompliance(
                {
                  userId: req.user.id,
                  tradingAccountId: args.tradingAccountId ?? validatedContext?.account?.id ?? null,
                },
                prisma
              );
            } else if (toolName === 'evaluatePropFirmTradeRisk') {
              toolResult = await evaluateChatPropFirmRisk(
                {
                  userId: req.user.id,
                  tradingAccountId: args.tradingAccountId ?? validatedContext?.account?.id ?? null,
                  lotSize: args.lotSize,
                  entryPrice: args.entryPrice,
                  stopLoss: args.stopLoss,
                  pair: args.pair,
                  direction: args.direction,
                  estimatedRiskAmount: args.estimatedRiskAmount,
                },
                prisma
              );
            }
          } catch (analyticsErr) {
            analyticsErr.code = analyticsErr.code || 'ANALYTICS_UNAVAILABLE';
            throw analyticsErr;
          }

          payloadMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        } else if (toolName === 'searchProductSupport') {
          const searchRes = searchProductKnowledge(args.query || lastUserMessage, 3);
          payloadMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: searchRes.formattedResult,
          });
        }
      }

      // Round 2 LLM call (also bounded by timeout)
      const response2 = await callWithTimeout(
        provider.generateChatCompletion(payloadMessages, []),
        CHAT_MODEL_TIMEOUT_MS,
        'AI_TIMEOUT'
      );

      finalContent = response2?.message?.content || 'I evaluated your request based on verified data.';
      inputTokens += response2?.usage?.prompt_tokens || 0;
      outputTokens += response2?.usage?.completion_tokens || 0;
      if (response2?.provider) actualProvider = response2.provider;
      if (response2?.model) actualModel = response2.model;
    } else {
      finalContent = message1?.content || 'I processed your query, but no response text was returned.';
    }

    if (aiReq && prisma.aiRequest?.update) {
      await prisma.aiRequest.update({
        where: { id: aiReq.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          provider: actualProvider,
          model: actualModel,
          rawResponse: saveHistory ? { content: finalContent } : null,
          inputTokens,
          outputTokens,
        },
      }).catch(() => {});
    }

    return res.json({
      message: finalContent,
      mode: chatMode,
      ...(validatedContext
        ? {
            scope: {
              accountId: validatedContext.account?.id || null,
              accountName: validatedContext.account?.name || 'All Accounts',
              startDate: validatedContext.startDate || null,
              endDate: validatedContext.endDate || null,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error(`[JAHZ AI Chat V2 Error] [${correlationId}]:`, error);
    if (aiReq && prisma.aiRequest?.update) {
      await prisma.aiRequest.update({
        where: { id: aiReq.id },
        data: {
          status: 'FAILED',
          errorMessage: String(error?.message || 'Chat V2 failure').slice(0, 500),
          completedAt: new Date(),
        },
      }).catch(() => {});
    }

    const safe = classifySafeClientError(error, correlationId);
    return res.status(safe.status).json(safe.body);
  }
};

module.exports = {
  isChatV2Enabled,
  handleChatV2,
  validateAndSanitizeChatMessages,
  classifySafeClientError,
  callWithTimeout,
};
