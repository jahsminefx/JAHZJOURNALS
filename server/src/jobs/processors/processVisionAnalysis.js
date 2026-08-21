const fs = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const { z } = require('zod');

const toArrayOfStrings = (val) => {
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : JSON.stringify(v));
  if (typeof val === 'string') return [val];
  if (typeof val === 'object' && val !== null) return Object.values(val).map(v => typeof v === 'string' ? v : JSON.stringify(v));
  return [];
};

const VisionSchema = z.object({
  observations: z.preprocess(toArrayOfStrings, z.array(z.string())).default([]),
  supportResistanceLevels: z.preprocess(toArrayOfStrings, z.array(z.string())).default([]),
  patterns: z.preprocess(toArrayOfStrings, z.array(z.string())).default([]),
  confidenceLevel: z.preprocess(v => String(v || 'MEDIUM'), z.string()).default('MEDIUM'),
  educationalDisclaimer: z.preprocess(v => String(v || 'For educational analysis only. Past performance does not guarantee future results.'), z.string()).default('For educational analysis only.'),
  uncertaintyNotice: z.preprocess(v => String(v || 'Market conditions involve risk and uncertainty.'), z.string()).default('Market conditions involve risk and uncertainty.')
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

    let base64ImageUrl;
    if (screenshot.imageUrl.includes('/uploads/')) {
      try {
        let pathname = screenshot.imageUrl;
        try {
          pathname = new URL(screenshot.imageUrl).pathname;
        } catch (_) {
          pathname = screenshot.imageUrl;
        }
        const relativePath = pathname.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
        const absolutePath = path.resolve(__dirname, '..', '..', '..', 'uploads', relativePath);
        const buffer = await fs.readFile(absolutePath);
        const ext = path.extname(absolutePath).replace('.', '').toLowerCase() || 'png';
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        base64ImageUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      } catch (fileErr) {
        console.warn('[Vision Analysis] Disk read failed, falling back to HTTP fetch:', fileErr.message);
      }
    }

    if (!base64ImageUrl) {
      let fetchUrl = screenshot.imageUrl;
      if (fetchUrl.startsWith('/uploads/')) {
        fetchUrl = `http://localhost:${process.env.PORT || 5000}${fetchUrl}`;
      } else if (fetchUrl.includes(':5173/uploads/')) {
        fetchUrl = fetchUrl.replace(':5173', `:${process.env.PORT || 5000}`);
      }
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('Failed to fetch image stream: ' + response.statusText);
      const arrayBuffer = await response.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      base64ImageUrl = `data:${mimeType};base64,${base64Data}`;
    }

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
