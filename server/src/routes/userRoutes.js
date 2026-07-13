const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  getWeeklyTradingGoal,
  upsertWeeklyTradingGoal,
  exportPersonalData,
  deleteUserAccount,
  changePassword,
  logoutAllDevices,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile)
  .delete(protect, deleteUserAccount);

router.get('/profile/export', protect, exportPersonalData);

router.route('/profile/avatar')
  .put(protect, upload.single('avatar'), uploadProfilePhoto)
  .delete(protect, deleteProfilePhoto);

router.put('/security/password', protect, changePassword);
router.post('/security/logout-all', protect, logoutAllDevices);

router.route('/trading-goals/weekly')
  .get(protect, getWeeklyTradingGoal)
  .put(protect, upsertWeeklyTradingGoal);

module.exports = router;
