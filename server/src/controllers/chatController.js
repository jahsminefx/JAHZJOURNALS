const { getProvider } = require('../ai/providers/providerFactory');
const { buildDashboardAnalytics } = require('../services/dashboardAnalyticsService');
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

    const featureType = chatMode === 'ANALYTICS' ? 'CHAT_SUPPORT' : 'SUPPORT_ASSISTANT';

    // 1. Create AiRequest ledger entry
    aiReq = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        featureType,
        status: 'PROCESSING',
        provider: process.env.AI_PROVIDER || 'openrouter',
        model: process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini',
        promptVersion: '1.0',
        startedAt: new Date()
      }
    }).catch(() => null);

    let systemMessage;
    let tools;

    if (chatMode === 'ANALYTICS') {
       systemMessage = {
         role: 'system',
         content: "You are the JAHZ AI Analytics Assistant. Answer questions accurately using metrics and recent trade lists retrieved via getDashboardAnalytics. Be concise and precise with numbers."
       };
       tools = analyticsTools;
    } else {
       systemMessage = {
         role: 'system',
         content: "You are the JAHZ AI Product Support Agent. Use searchProductSupport to safely retrieve documentation snippets and answer questions about the application's features."
       };
       tools = supportTools;
    }

    const payloadMessages = [systemMessage, ...messages];
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
