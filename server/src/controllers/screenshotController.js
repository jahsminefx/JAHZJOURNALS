const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');
const {
  createScreenshotPublicId,
  destroyCloudinaryImage,
} = require('../services/screenshotService');

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
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Verify trade belongs to user
    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { userId: req.user.id } }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const screenshotCount = await prisma.tradeScreenshot.count({ where: { tradeId } });
    if (screenshotCount >= maxScreenshotsPerTrade) {
      return res.status(400).json({ message: `A trade can have at most ${maxScreenshotsPerTrade} screenshots` });
    }

    const publicId = createScreenshotPublicId(req.user.id, tradeId);
    const result = await streamUpload(req.file, {
      public_id: publicId,
      resource_type: 'image',
      overwrite: false,
      use_filename: false,
      unique_filename: false,
    });

    let screenshot;
    try {
      screenshot = await prisma.tradeScreenshot.create({
        data: {
          tradeId,
          screenshotType: screenshotTypes.includes(screenshotType) ? screenshotType : 'MARKED_CHART',
          imageUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          fileSize: result.bytes || req.file.size || null,
          note: note ? String(note).slice(0, 500) : '',
        }
      });
    } catch (error) {
      await destroyCloudinaryImage(result.public_id);
      throw error;
    }

    res.status(201).json(screenshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload screenshot' });
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
      return res.status(404).json({ message: 'Screenshot not found' });
    }

    await destroyCloudinaryImage(screenshot.publicId);
    await prisma.tradeScreenshot.delete({ where: { id: screenshot.id } });

    res.json({ message: 'Screenshot deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: 'Failed to delete screenshot asset. Please try again.' });
  }
};

module.exports = { uploadScreenshot, deleteScreenshot };
