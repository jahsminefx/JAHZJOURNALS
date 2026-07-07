const crypto = require('crypto');
const cloudinary = require('../utils/cloudinary');

const CLOUDINARY_SUCCESS_RESULTS = new Set(['ok', 'not found']);

const getEnvironmentFolder = () => {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return env.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
};

const createScreenshotPublicId = (userId, tradeId) => {
  const generatedId = crypto.randomUUID();
  return `jahzjournals/${getEnvironmentFolder()}/users/${userId}/trades/${tradeId}/${generatedId}`;
};

const destroyCloudinaryImage = async (publicId) => {
  if (!publicId) {
    return { result: 'not found', skipped: true };
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });

  if (!CLOUDINARY_SUCCESS_RESULTS.has(result.result)) {
    const error = new Error(`Cloudinary deletion failed with result: ${result.result}`);
    error.cloudinaryResult = result;
    throw error;
  }

  return result;
};

const destroyScreenshots = async (screenshots = []) => {
  const deleted = [];

  for (const screenshot of screenshots) {
    const result = await destroyCloudinaryImage(screenshot.publicId);
    deleted.push({ id: screenshot.id, publicId: screenshot.publicId, result: result.result });
  }

  return deleted;
};

module.exports = {
  createScreenshotPublicId,
  destroyCloudinaryImage,
  destroyScreenshots,
};
