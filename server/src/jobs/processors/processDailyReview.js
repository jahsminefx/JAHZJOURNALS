const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { redactSensitiveData } = require('../../ai/utils/sanitizeAiInput');
const dailyReviewService = require('../../services/dailyReviewService');
const { z } = require('zod');

const DailyAiReviewSchema = z.object({
  executiveSummary: z.string(),
  whatYouDidWell: z.array(z.string()),
  whatWentWrong: z.array(z.string()),
  riskManagementReview: z.array(z.string()),
  tradingDiscipline: z.array(z.string()),
  strategyPerformance: z.array(z.string()),
  sessionPerformance: z.array(z.string()),
  emotionalObservations: z.array(z.string()),
  ruleViolations: z.array(z.string()),
  keyLesson: z.string(),
  tomorrowFocus: z.string(),
  overallAssessment: z.string(),
  disclaimer: z.string().optional().default('JAHZ AI provides educational analysis based on your journal data and does not provide financial advice.'),
});

const processDailyReview = async ({ aiRequestId, dailyReviewId, userId }) => {
  try {
    // 1. Mark request as PROCESSING
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    // 2. Fetch daily review record
    const review = await prisma.dailyReview.findFirst({
      where: { id: dailyReviewId, userId },
      include: {
        tradingAccount: { select: { name: true, currency: true } },
      },
    });

    if (!review) {
      throw new Error(`Daily review not found: ${dailyReviewId}`);
    }

    // 3. Compute deterministic metrics for this review date and account context
    const summaryData = await dailyReviewService.getDailyReviewSummary({
      userId,
      date: review.reviewDate,
      accountId: review.tradingAccountId,
    });

    const metrics = summaryData.metrics;
    const isMultiAccount = metrics.isMultiAccount;
    const currency = metrics.currency || 'USD';

    // Format monetary strings with EXPLICIT currency codes (NEVER raw unlabelled numbers)
    const formatMoney = (val, curr) => (val === null || val === undefined ? 'N/A' : `${val < 0 ? '-' : ''}${curr === 'NGN' ? '₦' : curr === 'GBP' ? '£' : curr === 'EUR' ? '€' : '$'}${Math.abs(val).toLocaleString()} ${curr}`);

    const safeNotes = redactSensitiveData({
      whatWentWell: review.whatWentWell,
      whatWentWrong: review.whatWentWrong,
      lessonsLearned: review.lessonsLearned,
      tomorrowFocus: review.tomorrowFocus,
      followedPlan: review.followedPlan,
      emotionalState: review.emotionalState,
      marketConditions: review.marketConditions,
      generalNotes: review.generalNotes,
    });

    const systemPrompt = `You are a disciplined, elite prop-firm trading mentor and performance coach for JAHZJOURNALS.
Your task is to analyze the trader's daily performance metrics and personal reflections for the day.
CRITICAL INSTRUCTIONS:
- You must NOT invent or calculate financial metrics yourself. Rely solely on the provided deterministic numbers.
- Distinguish clearly between FACT (provided data), INTERPRETATION (behavioral patterns), and RECOMMENDATION (coaching advice).
- Never criticize a trade or day solely because it resulted in a loss if execution quality and plan adherence were solid.
- If data for a section is missing or unavailable, state "Insufficient data available."
- Provide practical, structured, non-generic coaching.
- Return ONLY validated JSON adhering to the specified schema.`;

    const userPrompt = `TRADING DAY SUMMARY FOR ${summaryData.dateStr}:
Account Scope: ${isMultiAccount ? 'ALL ACCOUNTS (Portfolio normalized to USD)' : `Single Account (${summaryData.selectedAccount?.name || 'Account'})`}
Primary Currency: ${currency}
${isMultiAccount ? `Reporting Currency: USD (FX Status: ${metrics.fxStatus})` : ''}

DETERMINISTIC METRICS:
- Total Trades Taken: ${metrics.totalTrades}
- Wins: ${metrics.winningTrades} | Losses: ${metrics.losingTrades} | Breakevens: ${metrics.breakEvenTrades}
- Win Rate: ${metrics.winRate}%
- Net Profit/Loss: ${formatMoney(metrics.netProfitLoss, currency)}
- Gross Profit: ${formatMoney(metrics.grossProfit, currency)}
- Gross Loss: ${formatMoney(metrics.grossLoss, currency)}
- Profit Factor: ${metrics.profitFactor !== null ? metrics.profitFactor : 'N/A'}
- Total Pips: ${metrics.totalPips} pips
- Average R:R: ${metrics.averageRiskReward !== null ? `1:${metrics.averageRiskReward}` : 'N/A'}
- Largest Winner: ${metrics.largestWinner ? `${metrics.largestWinner.pair} (${formatMoney(metrics.largestWinner.pnl, metrics.largestWinner.currency)})` : 'None'}
- Largest Loser: ${metrics.largestLoser ? `${metrics.largestLoser.pair} (${formatMoney(metrics.largestLoser.pnl, metrics.largestLoser.currency)})` : 'None'}
- Best Strategy: ${metrics.bestStrategy || 'None specified'}
- Best Session: ${metrics.bestSession || 'None specified'}
- Total Rule Violations Recorded: ${metrics.totalRuleViolations}
- Plan Compliance Rate: ${metrics.planFollowingRate !== null ? `${metrics.planFollowingRate}%` : 'Not recorded'}

TRADER'S REFLECTIONS & JOURNAL NOTES:
- Followed Trading Plan: ${safeNotes.followedPlan === true ? 'Yes' : safeNotes.followedPlan === false ? 'No' : 'Unspecified'}
- Emotional State: ${safeNotes.emotionalState || 'Not specified'}
- Market Conditions: ${safeNotes.marketConditions || 'Not specified'}
- What Went Well: ${safeNotes.whatWentWell || 'None recorded'}
- What Went Wrong / Weaknesses: ${safeNotes.whatWentWrong || 'None recorded'}
- Lessons Learned: ${safeNotes.lessonsLearned || 'None recorded'}
- Tomorrow's Focus: ${safeNotes.tomorrowFocus || 'None recorded'}
- General Notes: ${safeNotes.generalNotes || 'None recorded'}`;

    const provider = getProvider();
    
    // 60-second timeout guard
    const TIMEOUT_MS = 60000;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error('AI_REQUEST_TIMEOUT');
        err.isTimeout = true;
        reject(err);
      }, TIMEOUT_MS);
    });

    let result;
    try {
      result = await Promise.race([
        validateStructuredOutput(provider, systemPrompt, userPrompt, DailyAiReviewSchema, 1),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!result.success) {
      await prisma.aiRequest.updateMany({
        where: { id: aiRequestId, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Failed to validate structured output',
          completedAt: new Date(),
        },
      });
      return;
    }

    // Late Worker Protection: Only update if request is still in PROCESSING state
    const currentReq = await prisma.aiRequest.findUnique({ where: { id: aiRequestId } });
    if (!currentReq || currentReq.status !== 'PROCESSING') {
      console.warn(`[processDailyReview] Stale worker response ignored for request ${aiRequestId} (status: ${currentReq?.status})`);
      return;
    }

    // Update AiRequest ledger
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
        inputSnapshot: { metrics, safeNotes },
      },
    });

    // Save structured response in DailyReview model
    await prisma.dailyReview.update({
      where: { id: dailyReviewId },
      data: {
        aiSummary: result.data.executiveSummary,
        aiStructuredOutput: result.data,
        aiGeneratedAt: new Date(),
        status: review.status === 'DRAFT' ? 'COMPLETED' : review.status,
      },
    });
  } catch (error) {
    console.error('[Process Daily Review Error]', error);
    const isTimeout = error.message === 'AI_REQUEST_TIMEOUT' || error.isTimeout;
    await prisma.aiRequest.updateMany({
      where: { id: aiRequestId, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        errorMessage: isTimeout ? 'JAHZ AI review request timed out after 60 seconds.' : (error.message || 'Error processing daily review AI'),
        completedAt: new Date(),
      },
    }).catch(() => {});
  }
};

module.exports = {
  processDailyReview,
  DailyAiReviewSchema,
};
