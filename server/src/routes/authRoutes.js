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

module.exports = router;
