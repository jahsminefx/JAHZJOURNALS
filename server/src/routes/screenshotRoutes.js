const express = require('express');
const router = express.Router({ mergeParams: true });
const { uploadScreenshot, deleteScreenshot, analyzeScreenshot } = require('../controllers/screenshotController');
const { protect } = require('../middleware/authMiddleware');
const { checkScreenshotLimit } = require('../middleware/subscriptionGate');
const upload = require('../middleware/uploadMiddleware');

router.route('/')
  .post(protect, checkScreenshotLimit, upload.single('image'), uploadScreenshot);

router.route('/:id')
  .delete(protect, deleteScreenshot);

module.exports = router;
