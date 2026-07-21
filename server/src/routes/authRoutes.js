const express = require('express');
const { authLimiter } = require('../middleware/rateLimitMiddleware');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
  changePassword,
  logoutAllDevices,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');



router.post('/register', registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getUserProfile);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/confirm', resetPassword);

router.post('/verify-email/request', protect, requestEmailVerification);
router.post('/verify-email/confirm', verifyEmail);

const { revertImpersonation } = require('../controllers/adminImpersonationController');

router.post('/password/change', protect, changePassword);
router.post('/logout-all', protect, logoutAllDevices);
router.post('/revert-impersonation', protect, revertImpersonation);

module.exports = router;
