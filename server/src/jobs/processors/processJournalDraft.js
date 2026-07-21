const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { z } = require('zod');

const JournalDraftSchema = z.object({
  draft: z.string(),
  fieldsUsed: z.array(z.string()),
  missingInformation: z.array(z.string())
});

const processJournalDraft = async ({ aiRequestId, draftType, tradeData, userId }) => {
  try {
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const provider = getProvider();

    let systemPrompt = `You are a strict, objective trading journaling assistant.
Your task is to generate a well-written draft for the trader's '${draftType === 'BEFORE' ? 'Thoughts Before Trade' : 'Reflections After Trade'}'.
CRITICAL RULES:
1. Do NOT invent reasoning, emotions, or market observations.
2. Rely ONLY on the provided trade data fields.
3. If information is sparse, state the facts plainly.
4. Structure the output according to the requested JSON schema.`;

    let userPrompt = `Trade Profile:
- Pair: ${tradeData.pair || 'Unknown'}
- Direction: ${tradeData.direction || 'Unknown'}
- Setup: ${tradeData.setupType || 'Unknown'}
- Timeframe: ${tradeData.entryTimeframe || 'Unknown'}
- HTF Bias: ${tradeData.htfBias || 'Unknown'}
- Result: ${tradeData.result || 'OPEN'}
- Existing Text: ${draftType === 'BEFORE' ? tradeData.notesBefore : tradeData.notesAfter || 'None'}
- Entry Reason: ${tradeData.entryReason || 'None'}

Generate a professional ${draftType} summary draft based exclusively on these facts. Identify fields used and missing info that would help.`;

    const result = await validateStructuredOutput(provider, systemPrompt, userPrompt, JournalDraftSchema, 1);

    if (!result.success) {
      throw new Error(result.error || 'Validation failed');
    }

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
        outputTokens: result.usage?.completion_tokens
      }
    });

  } catch (error) {
    console.error('[Process Journal Draft Error]', error);
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

module.exports = { processJournalDraft };
