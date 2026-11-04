const { getProvider } = require('../ai/providers/providerFactory');
const { checkAiAllowance } = require('../services/entitlementService');
const { buildDashboardAnalytics } = require('../services/dashboardAnalyticsService');
const { getPropFirmComplianceReport } = require('../services/propFirmRuleEngine');
const { evaluateProposedTrade } = require('../services/propFirmRiskGuardService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let supportDocs = [];
try { supportDocs = require('../utils/supportDocs.json').topics; } catch(e) {}

const analyticsTools = [
  {
    type: "function",
    function: {
      name: "getDashboardAnalytics",
      description: "Get the user's trading performance metrics and recent trade list. Call this to analyze performance or answer questions about specific trades.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getPropFirmCompliance",
      description: "Get authoritative prop firm compliance metrics for the user's prop-firm accounts (daily loss remaining, overall drawdown, trailing liquidation floor, profit target progress, consistency %, minimum trading days, and rule warnings). Call this whenever the user asks about prop firm rules, limits, daily allowance, drawdown, or whether they passed.",
      parameters: {
        type: "object",
        properties: {
          tradingAccountId: {
            type: "string",
            description: "Optional specific trading account ID. If omitted, evaluates the user's primary prop-firm account."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "evaluatePropFirmTradeRisk",
      description: "Evaluate a proposed trade risk against the user's prop-firm account rules to see if it would breach daily loss or trailing liquidation floor. Call this when the user asks 'Can I take a 1 lot trade on EURUSD?' or 'How much can I risk on my next trade?'.",
      parameters: {
        type: "object",
        properties: {
          tradingAccountId: { type: "string", description: "Optional trading account ID" },
          lotSize: { type: "number", description: "Proposed lot size" },
          entryPrice: { type: "number", description: "Proposed entry price" },
          stopLoss: { type: "number", description: "Proposed stop loss price" },
          pair: { type: "string", description: "Currency or instrument symbol (e.g. EURUSD, XAUUSD)" },
          direction: { type: "string", enum: ["BUY", "SELL"], description: "Trade direction" },
          estimatedRiskAmount: { type: "number", description: "Optional dollar risk amount" }
        },
        required: ["pair"]
      }
    }
  }
];

const supportTools = [
  {
    type: "function",
    function: {
      name: "searchProductSupport",
      description: "Search for JAHZJOURNALS documentation regarding platform features, rules, mentoring, edge finder, and prop-firms.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } }
      }
    }
  }
];

const sendMessage = async (req, res) => {
  let aiReq = null;
  try {
    const { messages, chatMode = 'ANALYTICS' } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'Messages array is required.' });
    }

    if (messages.length === 0) {
      return res.status(400).json({ message: 'Messages array cannot be empty.' });
    }

    // Enforce conversation history size limits (max 20 messages)
    const boundedMessages = messages.slice(-20);

    // Validate and sanitize each message payload
    const sanitizedMessages = [];
    for (const msg of boundedMessages) {
      if (!msg || typeof msg !== 'object') {
        return res.status(400).json({ message: 'Malformed message item.' });
      }

      // Restrict role to user or assistant (prevent client from injecting system role)
      let role = msg.role === 'assistant' ? 'assistant' : 'user';

      // Enforce max content length per message (max 3000 chars)
      const rawContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
      const content = rawContent.slice(0, 3000);

      sanitizedMessages.push({ role, content });
    }

    const featureType = chatMode === 'ANALYTICS' ? 'CHAT_SUPPORT' : 'SUPPORT_ASSISTANT';

    if (featureType === 'CHAT_SUPPORT') {
      const limitCheck = await checkAiAllowance(req.user, 'CHAT_SUPPORT');
      if (!limitCheck.allowed) {
        return res.status(403).json(limitCheck.payload);
      }
    }

    // 1. Create AiRequest ledger entry
    aiReq = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        featureType,
        status: 'PROCESSING',
        provider: process.env.AI_PROVIDER || 'openrouter',
        model: process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini',
        promptVersion: '2.0',
        startedAt: new Date()
      }
    }).catch(() => null);

    let systemMessage;
    let tools;

    if (chatMode === 'ANALYTICS') {
       systemMessage = {
         role: 'system',
         content: "You are the JAHZ AI Analytics & Prop Firm Risk Assistant. Answer questions accurately using metrics and trade lists from getDashboardAnalytics, and prop firm status using getPropFirmCompliance and evaluatePropFirmTradeRisk. Be concise, deterministic, and precise with dollar amounts and percentages. Clearly distinguish historical journal analysis, estimated account state, and advisory warnings. JahzJournals warnings are advisory and never guarantee broker-side execution."
       };
       tools = analyticsTools;
    } else {
       systemMessage = {
         role: 'system',
         content: "You are the JAHZ AI Product Support Agent. Use searchProductSupport to safely retrieve documentation snippets and answer questions about the application's features."
       };
       tools = supportTools;
    }

    const payloadMessages = [systemMessage, ...sanitizedMessages];
    const provider = getProvider();

    // Send Completion Request with 30s timeout
    const completionPromise = provider.generateChatCompletion(payloadMessages, tools);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Jahz AI chat request timed out after 30 seconds.')), 30000)
    );

    const response1 = await Promise.race([completionPromise, timeoutPromise]);
    const message1 = response1.message;
    
    let finalContent = '';
    let totalUsage = response1.usage;

    // If it wants to call a tool
    if (message1.tool_calls && message1.tool_calls.length > 0) {
       payloadMessages.push(message1);

       for (const toolCall of message1.tool_calls) {
          if (toolCall.function.name === 'getDashboardAnalytics') {
             const analyticsData = await buildDashboardAnalytics({ 
                 userId: req.user.id, 
                 query: {} 
             });
             
             const recentTrades = await prisma.trade.findMany({
               where: { tradingAccount: { userId: req.user.id } },
               orderBy: { exitTime: 'desc' },
               take: 30,
               select: {
                 pair: true,
                 direction: true,
                 profitLossAmount: true,
                 result: true,
                 exitTime: true,
                 entryTime: true,
               }
             });

             const slimData = {
               summary: analyticsData.summary,
               tradeOutcomes: analyticsData.tradeOutcomes,
               topPairs: analyticsData.topPairs,
               worstPairs: analyticsData.worstPairs,
               recentTrades: recentTrades.map(t => ({
                 pair: t.pair,
                 direction: t.direction,
                 pnl: t.profitLossAmount != null ? Number(t.profitLossAmount) : 0,
                 result: t.result,
                 date: (t.exitTime || t.entryTime)?.toISOString().split('T')[0],
               }))
             };

             payloadMessages.push({
               role: 'tool',
               tool_call_id: toolCall.id,
               content: JSON.stringify(slimData)
             });
          } else if (toolCall.function.name === 'getPropFirmCompliance') {
             let args = {};
             try { args = JSON.parse(toolCall.function.arguments); } catch(e) {}
             let targetAccountId = args.tradingAccountId;

             if (!targetAccountId) {
               const firstPropAccount = await prisma.propFirmAccount.findFirst({
                 where: { tradingAccount: { userId: req.user.id } },
                 select: { tradingAccountId: true }
               });
               targetAccountId = firstPropAccount?.tradingAccountId;
             }

             if (!targetAccountId) {
               payloadMessages.push({
                 role: 'tool',
                 tool_call_id: toolCall.id,
                 content: JSON.stringify({ message: 'No prop-firm account found for this user.' })
               });
             } else {
               const compliance = await getPropFirmComplianceReport(req.user.id, targetAccountId);
               payloadMessages.push({
                 role: 'tool',
                 tool_call_id: toolCall.id,
                 content: JSON.stringify(compliance || { message: 'Compliance data unavailable.' })
               });
             }
          } else if (toolCall.function.name === 'evaluatePropFirmTradeRisk') {
             let args = {};
             try { args = JSON.parse(toolCall.function.arguments); } catch(e) {}
             let targetAccountId = args.tradingAccountId;

             if (!targetAccountId) {
               const firstPropAccount = await prisma.propFirmAccount.findFirst({
                 where: { tradingAccount: { userId: req.user.id } },
                 select: { tradingAccountId: true }
               });
               targetAccountId = firstPropAccount?.tradingAccountId;
             }

             if (!targetAccountId) {
               payloadMessages.push({
                 role: 'tool',
                 tool_call_id: toolCall.id,
                 content: JSON.stringify({ message: 'No prop-firm account found to evaluate risk.' })
               });
             } else {
               const evalResult = await evaluateProposedTrade({
                 tradingAccountId: targetAccountId,
                 userId: req.user.id,
                 lotSize: args.lotSize,
                 entryPrice: args.entryPrice,
                 stopLoss: args.stopLoss,
                 pair: args.pair,
                 direction: args.direction || 'BUY',
                 estimatedRiskAmount: args.estimatedRiskAmount
               });
               payloadMessages.push({
                 role: 'tool',
                 tool_call_id: toolCall.id,
                 content: JSON.stringify(evalResult)
               });
             }
          } else if (toolCall.function.name === 'searchProductSupport') {
             let args = {};
             try { args = JSON.parse(toolCall.function.arguments); } catch(e) {}
             const q = (args.query || '').toLowerCase();
             
             const matchedDoc = supportDocs.find(d => 
                 d.title.toLowerCase().includes(q) || 
                 d.keywords.some(k => (q && k.includes(q)) || (q && q.includes(k)))
             );

             payloadMessages.push({
               role: 'tool',
               tool_call_id: toolCall.id,
               content: matchedDoc ? matchedDoc.content : "No curated document found for that exact term. Advise user generally."
             });
          }
       }

       const response2 = await provider.generateChatCompletion(payloadMessages, []);
       finalContent = response2.message?.content || 'I evaluated your trading data based on your request.';
       if (response2.usage) totalUsage = response2.usage;
    } else {
       finalContent = message1?.content || 'I analyzed your query, but no response text was generated.';
    }

    if (aiReq) {
      await prisma.aiRequest.update({
        where: { id: aiReq.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          rawResponse: { content: finalContent },
          inputTokens: totalUsage?.prompt_tokens,
          outputTokens: totalUsage?.completion_tokens
        }
      }).catch(() => {});
    }

    return res.json({ message: finalContent });

  } catch (error) {
    console.error('Chat AI Error:', error);
    if (aiReq) {
      await prisma.aiRequest.update({
        where: { id: aiReq.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Failed to communicate with JAHZ AI.',
          completedAt: new Date()
        }
      }).catch(() => {});
    }
    res.status(500).json({ message: error.message || 'Failed to communicate with JAHZ AI.' });
  }
};

module.exports = {
  sendMessage
};
