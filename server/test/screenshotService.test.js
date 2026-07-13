const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { test } = require('node:test');
const {
  saveLocalScreenshot,
  destroyScreenshotAsset,
} = require('../src/services/screenshotService');

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const getUploadedFilePath = (imageUrl) => {
  const pathname = new URL(imageUrl).pathname;
  const relativePath = pathname.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
  return path.join(__dirname, '..', 'uploads', relativePath);
};

test('local screenshot storage writes and deletes files under uploads', async () => {
  const result = await saveLocalScreenshot(
    {
      originalname: 'chart.png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      size: 4,
    },
    'user-id',
    'trade-id',
    'http://localhost:5000',
  );

  const uploadedFilePath = getUploadedFilePath(result.secure_url);
  assert.equal(result.public_id, null);
  assert.match(result.secure_url, /^http:\/\/localhost:5000\/uploads\/screenshots\//);
  assert.equal(await fileExists(uploadedFilePath), true);

  await destroyScreenshotAsset({ publicId: null, imageUrl: result.secure_url });
  assert.equal(await fileExists(uploadedFilePath), false);
});
