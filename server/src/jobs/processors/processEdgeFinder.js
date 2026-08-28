const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { z } = require('zod');
const { findEdges } = require('../../services/edgeFinderService');

const EdgeFinderSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  topEdgeTitle: z.string(),
  topEdgeExplanation: z.string(),
  topEdgeActionableSteps: z.array(z.string()),
  secondaryEdgeTitle: z.string().nullable().optional(),
  secondaryEdgeExplanation: z.string().nullable().optional(),
  disclaimer: z.string(),
});

const processEdgeFinder = async ({ aiRequestId, userId }) => {
  try {
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const trades = await prisma.trade.findMany({
      where: { tradingAccount: { userId } },
      include: { emotionLogs: true }
    });

    const { baseline, candidates } = findEdges(trades, 10); // min 10 trades constraint

    if (!baseline || candidates.length === 0) {
      await prisma.aiRequest.update({
        where: { id: aiRequestId },
        data: {
          status: 'FAILED',
          errorMessage: 'Not enough data or statistically significant edges found to generate a report. Keep trading and logging strictly.',
          completedAt: new Date()
        }
      });
      return;
    }

    const systemPrompt = `You are a quantitative trading psychometrician.
You will be provided with a trader's baseline metrics and their best deterministic edge combinations.
Explain these edges in non-mathematical, actionable terms to the user. Do not invent new metrics. Clearly state when these are "candidate edges" and emphasize sticking to the plan. Make it professional and encouraging.`;

    const userPrompt = `Baseline Stats (${baseline.total} closed trades):
Win Rate: ${(baseline.winRate * 100).toFixed(1)}%, Profit Factor: ${baseline.profitFactor != null ? Number(baseline.profitFactor).toFixed(2) : 'N/A'}, Expectancy: ${(baseline.expectancyR || 0).toFixed(2)}R

Candidate Edges (Top Combinations):
${candidates.map((edge, i) => `Edge ${i+1}: [ ${edge.combination} ]
- Sample Size: ${edge.metrics.total} trades
- Win Rate: ${(edge.metrics.winRate * 100).toFixed(1)}% (+${(edge.improvementOverBaseline.winRateDiff * 100).toFixed(1)}% over baseline)
- Profit Factor: ${edge.metrics.profitFactor != null ? Number(edge.metrics.profitFactor).toFixed(2) : 'N/A'}
- Expectancy: ${edge.metrics.expectancyR.toFixed(2)}R (+${edge.improvementOverBaseline.expectancyDiff.toFixed(2)}R over baseline)
- Net P/L: $${edge.metrics.netProfit.toFixed(2)}
- Max Drawdown: $${edge.metrics.maxDrawdown.toFixed(2)}`).join('\n\n')}`;

    const provider = getProvider();
    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, EdgeFinderSchema, 1);

    if (!result.success) {
      await prisma.aiRequest.update({
        where: { id: aiRequestId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Failed edge validation',
          completedAt: new Date()
        }
      });
      return;
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

  } catch (error) {
    console.error('[Process Edge Finder Error]', error);
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
  processEdgeFinder
};
