const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { z } = require('zod');

const VisionSchema = z.object({
  observations: z.array(z.string()),
  supportResistanceLevels: z.array(z.string()).optional().default([]),
  patterns: z.array(z.string()).optional().default([]),
  confidenceLevel: z.string(),
  educationalDisclaimer: z.string(),
  uncertaintyNotice: z.string()
});

const processVisionAnalysis = async ({ aiRequestId, screenshotId, userId }) => {
  try {
    await prisma.aiRequest.update({
      where: { id: aiRequestId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const screenshot = await prisma.tradeScreenshot.findUnique({
      where: { id: screenshotId }
    });

    if (!screenshot || !screenshot.imageUrl) {
      throw new Error('Screenshot not found or has no valid image URL');
    }

    const response = await fetch(screenshot.imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image stream: ' + response.statusText);
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const base64ImageUrl = `data:${mimeType};base64,${base64Data}`;

    const systemPrompt = `You are a professional technical analyst acting exclusively as an educational mentor. Examine the provided trading chart image.
Extract technical concepts such as Support/Resistance zones, Trend structure, Candlestick patterns, or recognizable shapes.
WARNING: Never predict market direction. Never give trading signals. Always frame observations playfully and cite uncertainty. Do not present subjective chart interpretation as absolute fact.
Return ONLY validated JSON following the requested schema.`;

    const userPromptContent = [
      { type: "text", text: "Please analyze this trading chart and summarize your technical observations. Adhere to your system instructions strictly, emphasizing disclaimer language." },
      { type: "image_url", image_url: { url: base64ImageUrl, detail: "auto" } }
    ];

    const provider = getProvider();
    
    // We pass true to the 6th arg in validateStructuredOutput which flags 'useVision'
    const result = await validateStructuredOutput(provider, systemPrompt, userPromptContent, VisionSchema, 1, true);

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
    console.error('[Process Vision Analysis Error]', error);
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

module.exports = { processVisionAnalysis };
