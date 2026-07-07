const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');
const { destroyCloudinaryImage } = require('../services/screenshotService');

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
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch profile' });
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
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No profile image file provided' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarPublicId: true },
    });

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: 'Failed to upload profile photo' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  userProfileSelect,
};
