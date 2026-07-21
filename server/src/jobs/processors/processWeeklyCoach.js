const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { z } = require('zod');
const { analyzeTradingPatterns } = require('../../services/psychologyService');

const WeeklyCoachSchema = z.object({
  weeklySummary: z.string(),
  mainStrength: z.string(),
  mainWeakness: z.string(),
  mostImportantRepeatedMistake: z.string(),
  mostUsefulPositiveHabit: z.string(),
  psychologyInsight: z.string(),
  riskManagementInsight: z.string(),
  whatToStopDoing: z.string(),
  whatToContinueDoing: z.string(),
  measurableGoalForNextWeek: z.string(),
  sampleSizeWarning: z.string().nullable().optional()
});

const processWeeklyCoach = async ({ aiRequestId, weeklyReviewId, userId }) => {
  try {
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const weeklyReview = await prisma.weeklyReview.findUnique({
      where: { id: weeklyReviewId },
      include: { bestTrade: true, worstTrade: true } // ensure relations aren't exposing extra PII
    });

    if (!weeklyReview) {
      throw new Error('Weekly review not found');
    }

    // Determine sample size issues deterministically
    let warning = null;
    if (weeklyReview.totalTrades < 5) {
      warning = "This review is based on fewer than 5 trades, making patterns statistically insignificant.";
    }

    // Retrieve trades for deterministic behavior analysis
    const weekTrades = await prisma.trade.findMany({
      where: {
        tradingAccount: { userId },
        entryTime: {
          gte: new Date(weeklyReview.weekStartDate),
          lte: new Date(weeklyReview.weekEndDate)
        }
      }
    });

    const behaviorPatterns = analyzeTradingPatterns(weekTrades);

    const systemPrompt = `You are a high-level performance and psychological trading coach.
Analyze the provided weekly trading statistics and deterministic behavior patterns. 
Provide strict, validated JSON matching the required schema.
Do NOT recalculate statistics. Explain the provided patterns and deliver direct, actionable goals. Provide supportive, non-diagnostic phrasing.`;

    const userPrompt = `Weekly Stats:
- Total Trades: ${weeklyReview.totalTrades}
- Wins: ${weeklyReview.wins} / Losses: ${weeklyReview.losses}
- Win Rate: ${(weeklyReview.winRate * 100).toFixed(2)}%
- Net P/L: $${weeklyReview.netProfitLoss}
- Profit Factor: ${weeklyReview.profitFactor || 'N/A'}
- Best Pair: ${weeklyReview.bestPair || 'N/A'} / Worst Pair: ${weeklyReview.worstPair || 'N/A'}
- Biggest Mistake Logged: ${weeklyReview.mainMistake || 'N/A'}
- Most Common Emotion: ${weeklyReview.mostCommonEmotion || 'N/A'}
- Most Broken Rule: ${weeklyReview.mostBrokenRule || 'N/A'}

Deterministic Behavior Patterns Detected This Week:
${behaviorPatterns.length > 0 ? behaviorPatterns.map(p => '- ' + p).join('\n') : '- No significant negative behavioral patterns detected.'}`;

    const provider = getProvider();
    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, WeeklyCoachSchema, 1);

    if (!result.success) {
      await prisma.aiRequest.update({
        where: { id: aiRequestId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Failed validation',
          completedAt: new Date()
        }
      });
      return;
    }

    if (warning) {
        result.data.sampleSizeWarning = warning;
    }

    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        structuredOutput: result.data,
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
      }
    });

    // Also update weeklyReview with the JSON blob representation string or similar
    // We will save JSON directly to `aiSummary` for now because we didn't migrate a separate JSON column.
    // Wait, the client might expect aiSummary string or we can store stringified JSON.
    await prisma.weeklyReview.update({
      where: { id: weeklyReviewId },
      data: { aiSummary: JSON.stringify(result.data) }
    });

  } catch (error) {
    console.error('[Process Weekly Coach Error]', error);
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        completedAt: new Date()
      }
    });
  }
};

module.exports = {
  processWeeklyCoach
};
