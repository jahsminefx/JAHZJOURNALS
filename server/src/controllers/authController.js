const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');
const { getClearCookieOptions } = require('../utils/cookieOptions');
const { userProfileSelect } = require('./userController');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
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
      generateToken(res, user.id);
      res.status(201).json(user);
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please add email and password' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (user?.isDisabled) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      generateToken(res, user.id);
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: userProfileSelect,
      });
      res.json(profile);
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
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
        const rawToken = crypto.randomBytes(32).toString('hex');
        const passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetTokenHash,
            passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
            passwordResetUsedAt: null,
          },
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log(`Password reset token for ${normalizedEmail}: ${rawToken}`);
        }
      }
    }

    res.json({ message: 'If that email exists, a password reset link will be sent.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to request password reset' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password || password.length < 8) {
      return res.status(400).json({ message: 'A valid token and password of at least 8 characters are required' });
    }

    const passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash,
        passwordResetUsedAt: null,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user || user.isDisabled) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
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

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to reset password' });
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
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  requestPasswordReset,
  resetPassword,
};
