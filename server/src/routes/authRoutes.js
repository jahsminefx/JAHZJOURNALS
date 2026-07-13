const express = require('express');
const rateLimit = require('express-rate-limit');
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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

router.post('/register', registerUser);
router.post('/login', loginLimiter, loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getUserProfile);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/confirm', resetPassword);

router.post('/verify-email/request', protect, requestEmailVerification);
router.post('/verify-email/confirm', verifyEmail);

router.post('/password/change', protect, changePassword);
router.post('/logout-all', protect, logoutAllDevices);

module.exports = router;
