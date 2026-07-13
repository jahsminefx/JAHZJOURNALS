const multer = require('multer');
const path = require('path');

// Store file in memory so we can upload buffer directly to Cloudinary
const storage = multer.memoryStorage();
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const maxImageSizeMb = Number.parseInt(process.env.MAX_IMAGE_UPLOAD_MB || '5', 10);

const upload = multer({
  storage,
  limits: { fileSize: maxImageSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(extension)) {
      cb(null, true);
    } else {
      const error = new Error('Please upload a valid image file (JPG, PNG, WEBP, or GIF).');
      error.statusCode = 400;
      cb(error, false);
    }
  }
});

module.exports = upload;
