const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { z } = require('zod');

const TradingPlanSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  coreRules: z.array(z.string()),
  riskManagementRules: z.array(z.string()),
  entryChecklist: z.array(z.string()),
  exitStrategy: z.string(),
  psychologyPact: z.string(),
});

const processTradingPlan = async ({ aiRequestId, userId }) => {
  try {
    const aiReq = await prisma.aiRequest.findUnique({
      where: { id: aiRequestId }
    });

    if (!aiReq) throw new Error('AI Request not found');

    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const snapshot = aiReq.inputSnapshot || {};
    const { strategy, pairs, risk, goals } = snapshot;

    const systemPrompt = `You are a master prop-firm trading mentor. 
Generate a comprehensive, structured trading plan for a trader based on their inputs.
Return ONLY valid JSON matching the requested schema.`;

    const userPrompt = `Trader Profile & Inputs:
- Strategy / Edge Focus: ${strategy || 'General Price Action'}
- Target Pairs / Assets: ${Array.isArray(pairs) ? pairs.join(', ') : pairs || 'EURUSD, GBPUSD'}
- Risk Per Trade: ${risk || '1%'}
- Goals & Targets: ${goals || 'Consistent execution and funded account scaling'}`;

    const provider = getProvider();
    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, TradingPlanSchema, 1);

    if (!result.success) {
      await prisma.aiRequest.update({
        where: { id: aiRequestId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Failed to generate valid trading plan schema.',
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
        rawResponse: { content: result.rawResponse },
        provider: result.provider,
        model: result.model
      }
    });
  } catch (error) {
    console.error('[processTradingPlan] Error:', error);
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: {
        status: 'FAILED',
        errorMessage: error.message || 'Trading plan generation failed.',
        completedAt: new Date()
      }
    }).catch(() => {});
  }
};

module.exports = { processTradingPlan };
