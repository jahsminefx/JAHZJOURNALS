const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'text/csv',
  'text/plain',
  'text/x-csv',
  'application/csv',
  'application/x-csv',
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

const allowedExtensions = new Set(['.csv', '.txt']);
const maxCsvSizeMb = Number.parseInt(process.env.MAX_CSV_UPLOAD_MB || '10', 10);

const csvUpload = multer({
  storage,
  limits: { fileSize: maxCsvSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    
    // Validate by extension or MIME type (since Excel/OS often reports CSV as application/vnd.ms-excel or text/plain)
    if (allowedExtensions.has(extension) || allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Please upload a valid CSV file (.csv).');
      error.statusCode = 400;
      cb(error, false);
    }
  },
});

module.exports = csvUpload;
