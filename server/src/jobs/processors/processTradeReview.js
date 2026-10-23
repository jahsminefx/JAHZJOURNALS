const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { redactSensitiveData } = require('../../ai/utils/sanitizeAiInput');
const { z } = require('zod');

// Schema matches what aiController was expecting initially, but we enforce it
const TradeReviewSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  mistakes: z.array(z.string()),
  riskFeedback: z.array(z.string()).optional().default([]),
  psychologyFeedback: z.array(z.string()).optional().default([]),
  ruleFeedback: z.array(z.string()).optional().default([]),
  recommendedAction: z.string(),
  disciplineScore: z.number().min(0).max(100),
  confidence: z.string().optional(),
  disclaimer: z.string().optional()
});

const processTradeReview = async ({ aiRequestId, tradeId, userId }) => {
  try {
    // 1. Mark request processing
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    // 2. Fetch trade data
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        tradingAccount: { select: { name: true, currency: true } },
        ruleViolations: { include: { tradeRule: true } },
        emotionLogs: true,
      }
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    const safeTrade = redactSensitiveData(trade);
    const tradeCurrency = trade.tradingAccount?.currency || 'USD';

    const systemPrompt = `You are a disciplined, elite prop-firm trading mentor.
Analyze the following trade execution and provide structural feedback.
IMPORTANT BREAK-EVEN & CAPITAL PROTECTION GUIDANCE:
If a trade is marked with Result: BREAKEVEN or has Break-Even Protected: YES, recognize that protecting capital via break-even or trailing stops is a valid risk management technique.
Do not mislabel a BE-managed trade with a small positive return as a conventional full win, and do not criticize small cost/fee slippage as a failure when capital preservation was achieved.
Praise discipline and capital protection where appropriate while noting execution nuances.
Return ONLY validated JSON following the requested schema.`;

    const userPrompt = `Trade Details:
- Account Currency: ${tradeCurrency}
- Pair: ${safeTrade.pair}
- Direction: ${safeTrade.direction}
- Result: ${safeTrade.result}
- Net Profit/Loss: ${safeTrade.profitLossAmount} ${tradeCurrency}
- Gross Profit: ${safeTrade.grossProfit !== null && safeTrade.grossProfit !== undefined ? safeTrade.grossProfit : 'N/A'} ${tradeCurrency}
- Commission: ${safeTrade.commission || 0} ${tradeCurrency}
- Swap: ${safeTrade.swap || 0} ${tradeCurrency}
- Break-Even Protected: ${safeTrade.breakEvenActivated ? 'YES (Stop moved to protect position at/near entry)' : 'NO'}
- Break-Even Stop Price: ${safeTrade.breakEvenPrice || 'N/A'}
- Risk/Reward: ${safeTrade.riskRewardRatio || 'Unknown'}
- Expected Grade: ${safeTrade.grade || 'Unknown'}
- Emotion Logs: ${JSON.stringify(safeTrade.emotionLogs.map(l => ({ emotion: l.emotion, intensity: l.intensity, stage: l.stage })))}
- Rules Broken: ${safeTrade.ruleViolations.length > 0 ? safeTrade.ruleViolations.map(v => v.tradeRule?.name).join(', ') : 'None'}`;

    const provider = getProvider();
    
    // 3. Call AI
    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, TradeReviewSchema, 1);

    if (!result.success) {
      // 4a. Handle validation failure
      await prisma.aiRequest.update({
        where: { id: aiRequestId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Failed to validate structured output',
          completedAt: new Date(),
          rawResponse: result.partialContent ? { content: result.partialContent } : null
        }
      });
      // Also update the fallback AiTradeReview to failed
      await prisma.aiTradeReview.updateMany({
        where: { tradeId: tradeId, reviewStatus: 'PROCESSING' },
        data: { reviewStatus: 'FAILED', errorMessage: result.error }
      });
      return;
    }

    // 4b. Handle success
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        structuredOutput: result.data,
        rawResponse: { content: result.rawResponse },
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        inputSnapshot: safeTrade
      }
    });

    // Save final insight to AiTradeReview model to maintain UI compatibility
    const existingReview = await prisma.aiTradeReview.findFirst({
      where: { tradeId: tradeId },
      orderBy: { createdAt: 'desc' }
    });

    const reviewPayload = {
      reviewStatus: 'COMPLETED',
      provider: result.provider,
      modelUsed: result.model,
      summary: result.data.summary,
      strengths: result.data.strengths.join(', \n'),
      mistakes: result.data.mistakes.join(', \n'),
      ruleFeedback: result.data.ruleFeedback?.join(', \n') || '',
      psychologyFeedback: result.data.psychologyFeedback?.join(', \n') || '',
      riskFeedback: result.data.riskFeedback?.join(', \n') || '',
      recommendation: result.data.recommendedAction,
      disciplineScore: result.data.disciplineScore,
      rawResponse: result.rawResponse,
      generatedAt: new Date(),
      structuredOutput: result.data,
      tokenUsage: result.usage,
    };

    if (existingReview) {
      await prisma.aiTradeReview.update({
        where: { id: existingReview.id },
        data: reviewPayload
      });
    } else {
      await prisma.aiTradeReview.create({
        data: {
          tradeId: tradeId,
          ...reviewPayload
        }
      });
    }

  } catch (error) {
    console.error('[Process Trade Review Error]', error);
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        completedAt: new Date()
      }
    });
    
    await prisma.aiTradeReview.updateMany({
      where: { tradeId: tradeId },
      data: { reviewStatus: 'FAILED', errorMessage: error.message }
    });
  }
};

module.exports = {
  processTradeReview
};
