const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const streamifier = require('streamifier');
const bcrypt = require('bcryptjs');
const cloudinary = require('../utils/cloudinary');
const { getClearCookieOptions } = require('../utils/cookieOptions');
const { destroyCloudinaryImage, destroyScreenshots } = require('../services/screenshotService');

const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  country: true,
  timezone: true,
  phoneNumber: true,
  tradingExperience: true,
  mainTradingPairs: true,
  mainSession: true,
  tradingStyle: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  onboardingCompleted: true,
  avatarUrl: true,
  subscriptions: {
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { promotion: { include: { badge: true } } }
  },
  userBadges: {
    include: { badge: true }
  }
};

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const parseBoolean = (value) => value === true || value === 'true' || value === 'on';
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const parseOptionalDecimal = (value) => (hasValue(value) ? Number(value) : null);
const parseOptionalInteger = (value) => (hasValue(value) ? Number.parseInt(value, 10) : null);

const serializeTradingGoal = (goal) => {
  if (!goal) return null;

  return {
    id: goal.id,
    tradingAccountId: goal.tradingAccountId,
    periodType: goal.periodType,
    profitTarget: goal.profitTarget === null ? null : Number(goal.profitTarget),
    tradeCountTarget: goal.tradeCountTarget,
    winRateTarget: goal.winRateTarget === null ? null : Number(goal.winRateTarget),
    maxLossTarget: goal.maxLossTarget === null ? null : Number(goal.maxLossTarget),
    active: goal.active,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
};

const getEnvironmentFolder = () => {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return env.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
};

const createAvatarPublicId = (userId) => {
  const generatedId = crypto.randomUUID();
  return `jahzjournals/${getEnvironmentFolder()}/users/${userId}/profile/${generatedId}`;
};

const streamUpload = (file, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (result) resolve(result);
    else reject(error);
  });

  streamifier.createReadStream(file.buffer).pipe(stream);
});

const getUserProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: userProfileSelect,
    });

    if (!user) {
      return res.status(404).json({ message: 'We couldn\'t find your profile.' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t retrieve your profile right now.' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const {
      name,
      country,
      timezone,
      phoneNumber,
      tradingExperience,
      mainTradingPairs,
      mainSession,
      tradingStyle,
      onboardingCompleted,
    } = req.body;

    const data = {
      ...(name !== undefined && { name }),
      ...(country !== undefined && { country }),
      ...(timezone !== undefined && { timezone }),
      ...(phoneNumber !== undefined && { phoneNumber }),
      ...(tradingExperience !== undefined && { tradingExperience }),
      ...(mainTradingPairs !== undefined && { mainTradingPairs: normalizeStringList(mainTradingPairs) }),
      ...(mainSession !== undefined && { mainSession }),
      ...(tradingStyle !== undefined && { tradingStyle }),
      ...(onboardingCompleted !== undefined && { onboardingCompleted: parseBoolean(onboardingCompleted) }),
    };

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: userProfileSelect,
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag updating your profile.' });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload.' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarPublicId: true },
    });

    if (!currentUser) {
      return res.status(404).json({ message: 'We couldn\'t find your profile.' });
    }

    const result = await streamUpload(req.file, {
      public_id: createAvatarPublicId(req.user.id),
      resource_type: 'image',
      overwrite: false,
      use_filename: false,
      unique_filename: false,
      transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }],
    });

    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          avatarUrl: result.secure_url,
          avatarPublicId: result.public_id,
        },
        select: userProfileSelect,
      });
    } catch (error) {
      await destroyCloudinaryImage(result.public_id);
      throw error;
    }

    if (currentUser.avatarPublicId && currentUser.avatarPublicId !== result.public_id) {
      try {
        await destroyCloudinaryImage(currentUser.avatarPublicId);
      } catch (error) {
        console.warn(`Failed to delete old avatar ${currentUser.avatarPublicId}:`, error.message);
      }
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t upload your new avatar right now.' });
  }
};

const deleteProfilePhoto = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarPublicId: true },
    });

    if (!currentUser) {
      return res.status(404).json({ message: 'We couldn\'t find your profile.' });
    }

    if (currentUser.avatarPublicId) {
      try {
        await destroyCloudinaryImage(currentUser.avatarPublicId);
      } catch (error) {
        console.warn(`Failed to delete old avatar ${currentUser.avatarPublicId}:`, error.message);
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
      },
      select: userProfileSelect,
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag removing your profile picture.' });
  }
};

const getWeeklyTradingGoal = async (req, res) => {
  try {
    const goal = await prisma.tradingGoal.findFirst({
      where: {
        userId: req.user.id,
        active: true,
        periodType: 'WEEKLY',
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(serializeTradingGoal(goal));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t fetch your weekly guiding goal.' });
  }
};

const upsertWeeklyTradingGoal = async (req, res) => {
  try {
    const tradingAccountId = hasValue(req.body.tradingAccountId) ? String(req.body.tradingAccountId) : null;

    if (tradingAccountId) {
      const account = await prisma.tradingAccount.findFirst({
        where: { id: tradingAccountId, userId: req.user.id },
        select: { id: true },
      });

      if (!account) {
        return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
      }
    }

    const data = {
      tradingAccountId,
      profitTarget: parseOptionalDecimal(req.body.profitTarget),
      tradeCountTarget: parseOptionalInteger(req.body.tradeCountTarget),
      winRateTarget: parseOptionalDecimal(req.body.winRateTarget),
      maxLossTarget: parseOptionalDecimal(req.body.maxLossTarget),
    };

    const hasAnyTarget = Object.values(data).some((value, index) => index > 0 && value !== null && !Number.isNaN(value));
    const hasInvalidNumber = Object.values(data).some((value, index) => index > 0 && Number.isNaN(value));

    if (hasInvalidNumber) {
      return res.status(400).json({ message: 'Your goal values need to be valid numbers.' });
    }

    if (
      (data.profitTarget !== null && data.profitTarget < 0)
      || (data.tradeCountTarget !== null && data.tradeCountTarget < 0)
      || (data.winRateTarget !== null && (data.winRateTarget < 0 || data.winRateTarget > 100))
      || (data.maxLossTarget !== null && data.maxLossTarget < 0)
    ) {
      return res.status(400).json({ message: 'Goals should be positive numbers, and win rate between 0 and 100.' });
    }

    const goal = await prisma.$transaction(async (tx) => {
      await tx.tradingGoal.updateMany({
        where: {
          userId: req.user.id,
          active: true,
          periodType: 'WEEKLY',
        },
        data: { active: false },
      });

      if (!hasAnyTarget) return null;

      return tx.tradingGoal.create({
        data: {
          userId: req.user.id,
          periodType: 'WEEKLY',
          ...data,
        },
      });
    });

    res.json(serializeTradingGoal(goal));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag saving your weekly goal.' });
  }
};

const exportPersonalData = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        tradingAccounts: {
          include: {
            trades: {
              include: {
                emotionLogs: true,
                ruleViolations: true,
                screenshots: true,
                aiTradeReviews: true,
              }
            }
          }
        },
        tradeRules: true,
        weeklyReviews: true,
        tradingGoals: true,
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'We couldn\'t find your profile.' });
    }

    user.passwordHash = undefined;
    user.passwordResetTokenHash = undefined;
    user.emailVerificationTokenHash = undefined;

    res.setHeader('Content-disposition', `attachment; filename=jahzjournals_export_${user.id}.json`);
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(user, null, 2));
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t generate your export out right now.' });
  }
};

const deleteUserAccount = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    
    if (!currentPassword) {
      return res.status(400).json({ message: 'Please provide your current password to confirm account deletion.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'The current password you entered is incorrect.' });
    }

    // Clean up external assets (Cloudinary)
    if (user.avatarPublicId) {
      try {
        await destroyCloudinaryImage(user.avatarPublicId);
      } catch (err) {
        console.warn(`Failed to delete profile avatar during account deletion: ${err.message}`);
      }
    }

    const screenshots = await prisma.tradeScreenshot.findMany({
      where: { trade: { tradingAccount: { userId: user.id } } }
    });

    if (screenshots.length > 0) {
      try {
        await destroyScreenshots(screenshots);
      } catch (err) {
        console.warn(`Failed to delete some screenshots during account deletion: ${err.message}`);
      }
    }

    // Database deletion (Prisma handles cascading)
    await prisma.user.delete({ where: { id: user.id } });

    res.cookie('jwt', '', {
      ...getClearCookieOptions(),
    });

    res.json({ message: 'Your account and all associated data have been permanently deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag trying to delete your account.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both your current and new password.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Your new password needs to be at least 8 characters long.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'The current password you entered is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Your password has been successfully updated.' });
  } catch (error) {
    console.error('Failed to change password:', error);
    res.status(500).json({ message: 'We hit a snag changing your password.' });
  }
};

const logoutAllDevices = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    res.cookie('jwt', '', {
      ...getClearCookieOptions(),
    });

    res.json({ message: 'You have been logged out of all devices.' });
  } catch (error) {
    console.error('Failed to logout of all devices:', error);
    res.status(500).json({ message: 'We hit a snag revoking your sessions.' });
  }
};

module.exports = {
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
  userProfileSelect,
};
