const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');
const {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../services/emailService');
const { getClearCookieOptions } = require('../utils/cookieOptions');
const { userProfileSelect } = require('./userController');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'We need your name, email, and a password to get started.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // PHASE 10: CLOSED BETA REGISTRATION LOCK
    const systemConfig = await prisma.systemConfig.findUnique({ where: { key: 'FEATURES_CONFIG'} });
    const launchMode = systemConfig?.value?.launchMode || 'DEVELOPMENT';
    
    if (launchMode === 'CLOSED_BETA' || launchMode === 'WAITLIST') {
       if (!req.body.promoCode) {
         return res.status(403).json({ message: 'JAHZJOURNALS is currently in an exclusive Closed Beta. An invitation code is strictly required to register.' });
       }

       const validPromo = await prisma.promotion.findFirst({
          where: { code: req.body.promoCode.toUpperCase(), isActive: true }
       });

       if (!validPromo) {
         return res.status(403).json({ message: 'The Beta Access code provided is either invalid or has expired.' });
       }
    }

    const userExists = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (userExists) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        mainTradingPairs: [],
      },
      select: userProfileSelect,
    });

    if (user) {
      // Generate email verification token asynchronously
      const rawToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash,
          emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      }).catch(err => console.error('Failed to set verification token on register:', err.message));

      const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;

      // Dispatch welcome email asynchronously without blocking registration flow
      sendWelcomeEmail(user, verifyUrl).catch(err => {
        console.warn('Welcome email dispatch warning:', err?.message || err);
      });

      generateToken(res, user.id);
      res.status(201).json(user);
    } else {
      res.status(400).json({ message: 'We couldn\'t create your account right now.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Our servers hit a snag setting up your sanctuary. Please try again.' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Both email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (user?.isDisabled) {
      return res.status(401).json({ message: 'That email and password don\'t match our records.' });
    }

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      generateToken(res, user.id, user.tokenVersion);
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: userProfileSelect,
      });
      res.json(profile);
    } else {
      res.status(401).json({ message: 'That email and password don\'t match our records.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Our servers hit a snag during sign-in. Please try again.' });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = (req, res) => {
  res.cookie('jwt', '', {
    ...getClearCookieOptions(),
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

const requestPasswordReset = async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();

    if (normalizedEmail) {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      if (user && !user.isDisabled) {
        // Generate clean 6-digit numeric OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const passwordResetTokenHash = crypto.createHash('sha256').update(otpCode).digest('hex');

        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetTokenHash,
            passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
            passwordResetUsedAt: null,
          },
        });

        const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const resetUrl = `${appUrl}/reset-password?code=${otpCode}&email=${encodeURIComponent(user.email)}`;
        
        console.log(`[Password Reset Request] User: ${user.email} | 6-Digit Code: ${otpCode} | Reset Link: ${resetUrl}`);

        await sendPasswordResetEmail(user, resetUrl, otpCode);
      }
    }

    res.json({ message: 'If that email is registered, we\'ve sent reset instructions to it.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t process your reset request right now.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const rawCode = String(req.body.code || req.body.token || req.body.otpCode || '').trim().replace(/\s+/g, '');
    const password = req.body.password || req.body.newPassword;

    if (!rawCode || !password || password.length < 8) {
      return res.status(400).json({ message: 'Please provide a valid 6-digit code and a password with at least 8 characters.' });
    }

    const passwordResetTokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash,
        passwordResetUsedAt: null,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user || user.isDisabled) {
      return res.status(400).json({ message: 'This reset code is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetUsedAt: new Date(),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    res.json({ message: 'Your password has been securely reset.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t reset your password. Try requesting a new code.' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: userProfileSelect
    });

    if (user) {
      if (req.user.isImpersonating) {
         user.isImpersonating = true;
         // Explicitly strip impersonatorId from frontend traces preventing XSS ID escalation.
      }
      res.json(user);
    } else {
      res.status(404).json({ message: 'We couldn\'t find your profile.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Our servers encountered an issue.' });
  }
};

module.exports = {
  requestPasswordReset,
  resetPassword,
};

const requestEmailVerification = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user || user.emailVerified) {
      return res.status(400).json({ message: 'Your email is already verified or the account is missing.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;
    
    await sendVerificationEmail(user, verifyUrl);

    res.json({ message: 'A fresh verification link has been sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t send the verification email right now.' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Verification link is missing or invalid.' });

    const emailVerificationTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationTokenHash,
        emailVerificationExpiresAt: { gt: new Date() },
      },
    });

    if (!user || user.isDisabled) {
      return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    res.json({ message: 'Your email has been verified successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t verify your email at this time.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Please provide your current password and a new password with at least 8 characters.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'The current password you entered is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // Re-issue token with new version to keep this device logged in
    generateToken(res, user.id, user.tokenVersion + 1);

    res.json({ message: 'Your password has been changed securely and other devices have been logged out.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag resetting your password.' });
  }
};

const logoutAllDevices = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    res.cookie('jwt', '', {
      ...getClearCookieOptions(),
    });
    
    res.json({ message: 'You have been logged out from all devices.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag logging you out everywhere.' });
  }
};

module.exports = {
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
};
