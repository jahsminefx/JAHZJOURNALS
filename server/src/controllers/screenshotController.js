const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');
const {
  createScreenshotPublicId,
  saveLocalScreenshot,
  destroyScreenshotAsset,
} = require('../services/screenshotService');
const { getProvider } = require('../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../ai/utils/validateStructuredOutput');
const { z } = require('zod');

const screenshotTypes = [
  'HIGHER_TIMEFRAME_ANALYSIS',
  'BEFORE_ENTRY',
  'ENTRY',
  'DURING_TRADE',
  'EXIT',
  'POST_ANALYSIS',
  'MARKED_CHART',
];

const maxScreenshotsPerTrade = Number.parseInt(process.env.MAX_SCREENSHOTS_PER_TRADE || '6', 10);
const useLocalScreenshotStorage = () => (
  process.env.SCREENSHOT_STORAGE === 'local'
  || (process.env.NODE_ENV !== 'production' && process.env.SCREENSHOT_STORAGE !== 'cloudinary')
);
const canFallbackToLocalStorage = () => process.env.NODE_ENV !== 'production';
const getRequestBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const streamUpload = (file, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (result) resolve(result);
    else reject(error);
  });

  streamifier.createReadStream(file.buffer).pipe(stream);
});

const uploadScreenshot = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { screenshotType, note } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image to upload.' });
    }

    // Verify trade belongs to user
    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { userId: req.user.id } }
    });

    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find that trade.' });
    }

    const screenshotCount = await prisma.tradeScreenshot.count({ where: { tradeId } });
    if (screenshotCount >= maxScreenshotsPerTrade) {
      return res.status(400).json({ message: `You can attach up to ${maxScreenshotsPerTrade} screenshots per trade.` });
    }

    let result;

    if (useLocalScreenshotStorage()) {
      result = await saveLocalScreenshot(req.file, req.user.id, tradeId, getRequestBaseUrl(req));
    } else {
      const publicId = createScreenshotPublicId(req.user.id, tradeId);
      try {
        result = await streamUpload(req.file, {
          public_id: publicId,
          resource_type: 'image',
          overwrite: false,
          use_filename: false,
          unique_filename: false,
        });
      } catch (error) {
        if (!canFallbackToLocalStorage()) {
          throw error;
        }

        console.warn(`Cloudinary upload failed; saving screenshot locally instead: ${error.message}`);
        result = await saveLocalScreenshot(req.file, req.user.id, tradeId, getRequestBaseUrl(req));
      }
    }

    let screenshot;
    try {
      screenshot = await prisma.tradeScreenshot.create({
        data: {
          tradeId,
          screenshotType: screenshotTypes.includes(screenshotType) ? screenshotType : 'MARKED_CHART',
          imageUrl: result.secure_url,
          publicId: result.public_id || null,
          format: result.format,
          width: result.width,
          height: result.height,
          fileSize: result.bytes || req.file.size || null,
          note: note ? String(note).slice(0, 500) : '',
        }
      });
    } catch (error) {
      await destroyScreenshotAsset({
        publicId: result.public_id || null,
        imageUrl: result.secure_url,
      });
      throw error;
    }

    res.status(201).json(screenshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag uploading your screenshot.' });
  }
};

const deleteScreenshot = async (req, res) => {
  try {
    const screenshot = await prisma.tradeScreenshot.findFirst({
      where: {
        id: req.params.id,
        trade: {
          tradingAccount: {
            userId: req.user.id,
          },
        },
      },
    });

    if (!screenshot) {
      return res.status(404).json({ message: 'We couldn\'t find that screenshot.' });
    }

    await destroyScreenshotAsset(screenshot);
    await prisma.tradeScreenshot.delete({ where: { id: screenshot.id } });

    res.json({ message: 'Screenshot removed from your sanctuary.' });
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: 'We hit a snag removing this image. Please try again.' });
  }
};

const analyzeScreenshot = async (req, res) => {
  try {
    const screenshot = await prisma.tradeScreenshot.findFirst({
      where: {
        id: req.params.id,
        trade: { tradingAccount: { userId: req.user.id } },
      },
    });

    if (!screenshot) {
      return res.status(404).json({ message: 'We couldn\'t find that screenshot.' });
    }

    if (!screenshot.imageUrl) {
      return res.status(400).json({ message: 'No valid image URL to analyze.' });
    }

    const provider = getProvider();
    const systemPrompt = `You are a professional technical analyst. Examine the provided trading chart image.
Extract technical concepts such as Support/Resistance zones, Trend structure, Candlestick patterns, or recognizable shapes.
Provide a clear, brief markdown analysis.`;

    const userPromptContent = [
      { type: "text", text: "Please analyze this trading chart and summarize your technical observations in a few bullet points." },
      { type: "image_url", image_url: { url: screenshot.imageUrl, detail: "auto" } }
    ];

    const VisionSchema = z.object({
      markdownAnalysis: z.string()
    });

    const result = await validateStructuredOutput(
      provider, 
      systemPrompt, 
      userPromptContent, 
      VisionSchema, 
      1, 
      true // useVision = true
    );

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to analyze the screenshot.' });
    }

    const analysisPrefix = "\n\n**🤖 JAHZ Vision AI Analysis:**\n" + result.data.markdownAnalysis;
    const newNote = ((screenshot.note || "") + analysisPrefix).trim().slice(0, 1500); // Expanding character capacity slightly to fit AI notes

    const updatedScreenshot = await prisma.tradeScreenshot.update({
      where: { id: screenshot.id },
      data: { note: newNote }
    });

    // Option: Increment AI request log for Usage tracking
    await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        tradeId: screenshot.tradeId,
        featureType: 'SCREENSHOT_REVIEW',
        status: 'COMPLETED',
        provider: result.provider,
        model: result.model,
        promptVersion: 'vision-1.0',
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        structuredOutput: result.data
      }
    });

    res.json(updatedScreenshot);
  } catch (error) {
    console.error('Vision AI Error:', error);
    res.status(500).json({ message: 'Hit a snag processing vision analysis.' });
  }
};

module.exports = { uploadScreenshot, deleteScreenshot, analyzeScreenshot };
