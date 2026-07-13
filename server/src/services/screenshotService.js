const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const cloudinary = require('../utils/cloudinary');

const CLOUDINARY_SUCCESS_RESULTS = new Set(['ok', 'not found']);
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const getEnvironmentFolder = () => {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return env.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
};

const createScreenshotPublicId = (userId, tradeId) => {
  const generatedId = crypto.randomUUID();
  return `jahzjournals/${getEnvironmentFolder()}/users/${userId}/trades/${tradeId}/${generatedId}`;
};

const safePathSegment = (value) => String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_');

const getSafeImageExtension = (file) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  return extension || '.png';
};

const saveLocalScreenshot = async (file, userId, tradeId, baseUrl) => {
  const relativeDirectory = path.join(
    'screenshots',
    safePathSegment(userId),
    safePathSegment(tradeId),
  );
  const filename = `${crypto.randomUUID()}${getSafeImageExtension(file)}`;
  const absoluteDirectory = path.join(UPLOADS_ROOT, relativeDirectory);
  const absolutePath = path.join(absoluteDirectory, filename);
  const publicPath = `/uploads/${path.join(relativeDirectory, filename).replace(/\\/g, '/')}`;

  await fs.mkdir(absoluteDirectory, { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return {
    secure_url: `${baseUrl}${publicPath}`,
    public_id: null,
    format: getSafeImageExtension(file).replace('.', ''),
    width: null,
    height: null,
    bytes: file.size,
    storage: 'local',
  };
};

const deleteLocalScreenshot = async (imageUrl) => {
  if (!imageUrl) return { result: 'not found', skipped: true };

  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl).pathname;
  } catch (error) {
    pathname = imageUrl;
  }

  if (!pathname.startsWith('/uploads/screenshots/')) {
    return { result: 'not found', skipped: true };
  }

  const relativePath = pathname.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
  const absolutePath = path.resolve(UPLOADS_ROOT, relativePath);
  const uploadsRoot = path.resolve(UPLOADS_ROOT);

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error('Refusing to delete screenshot outside uploads directory');
  }

  try {
    await fs.unlink(absolutePath);
    return { result: 'ok', storage: 'local' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { result: 'not found', storage: 'local' };
    }
    throw error;
  }
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

const destroyScreenshotAsset = async (screenshot) => {
  if (screenshot.publicId) {
    return destroyCloudinaryImage(screenshot.publicId);
  }

  return deleteLocalScreenshot(screenshot.imageUrl);
};

const destroyScreenshots = async (screenshots = []) => {
  const deleted = [];

  for (const screenshot of screenshots) {
    const result = await destroyScreenshotAsset(screenshot);
    deleted.push({ id: screenshot.id, publicId: screenshot.publicId, result: result.result });
  }

  return deleted;
};

module.exports = {
  createScreenshotPublicId,
  saveLocalScreenshot,
  destroyCloudinaryImage,
  destroyScreenshotAsset,
  destroyScreenshots,
};
