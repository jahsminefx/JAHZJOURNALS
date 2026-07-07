const express = require('express');
const router = express.Router();
const { getUserProfile, updateUserProfile, uploadProfilePhoto } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

router.route('/profile/avatar')
  .put(protect, upload.single('avatar'), uploadProfilePhoto);

module.exports = router;
