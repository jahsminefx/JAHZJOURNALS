const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONFIG_KEY = 'TIER_WAITLISTS';

const DEFAULT_WAITLIST_DATA = {
  PRO_SYNC: {
    planKey: 'PRO_SYNC',
    title: 'Pro Sync (MT4/MT5 Cloud Sync)',
    launchDate: 'January 2027',
    baseCount: 186,
    subscribers: []
  },
  MENTOR_MEGA: {
    planKey: 'MENTOR_MEGA',
    title: 'Mega Academy (1,000 Students)',
    launchDate: 'January 2027',
    baseCount: 43,
    subscribers: []
  }
};

const getWaitlistState = async () => {
  const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  if (!row || !row.value) {
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: DEFAULT_WAITLIST_DATA },
      create: { key: CONFIG_KEY, value: DEFAULT_WAITLIST_DATA }
    });
    return DEFAULT_WAITLIST_DATA;
  }
  return { ...DEFAULT_WAITLIST_DATA, ...row.value };
};

// GET /api/waitlist/counts
const getWaitlistCounts = async (req, res) => {
  try {
    const state = await getWaitlistState();
    const result = {};

    for (const [tier, data] of Object.entries(state)) {
      const subscriberList = Array.isArray(data.subscribers) ? data.subscribers : [];
      const totalCount = (data.baseCount || 0) + subscriberList.length;
      result[tier] = {
        tier,
        title: data.title,
        launchDate: data.launchDate || 'January 2027',
        count: totalCount,
      };
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching waitlist counts:', error);
    res.status(500).json({ message: 'Failed to load waitlist counts' });
  }
};

// POST /api/waitlist/join
const joinWaitlist = async (req, res) => {
  try {
    const { tier, email: inputEmail, name: inputName } = req.body;
    const tierKey = (tier || '').toUpperCase();

    if (!['PRO_SYNC', 'MENTOR_MEGA'].includes(tierKey)) {
      return res.status(400).json({ message: 'Invalid waitlist tier specified.' });
    }

    const email = (inputEmail || req.user?.email || '').trim().toLowerCase();
    const name = (inputName || req.user?.name || 'Trader').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const state = await getWaitlistState();
    const tierData = state[tierKey] || {
      planKey: tierKey,
      title: tierKey === 'PRO_SYNC' ? 'Pro Sync' : 'Mega Academy',
      launchDate: 'January 2027',
      baseCount: tierKey === 'PRO_SYNC' ? 186 : 43,
      subscribers: []
    };

    const subscribers = Array.isArray(tierData.subscribers) ? tierData.subscribers : [];
    const existingIndex = subscribers.findIndex(s => s.email === email);

    if (existingIndex !== -1) {
      const pos = (tierData.baseCount || 0) + existingIndex + 1;
      return res.json({
        success: true,
        alreadyJoined: true,
        position: pos,
        count: (tierData.baseCount || 0) + subscribers.length,
        message: `You're already on the ${tierData.title} early-access waitlist at spot #${pos}! We will notify ${email} first in January 2027.`
      });
    }

    // Add new subscriber
    subscribers.push({
      email,
      name,
      userId: req.user?.id || null,
      joinedAt: new Date().toISOString()
    });

    tierData.subscribers = subscribers;
    state[tierKey] = tierData;

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: state },
      create: { key: CONFIG_KEY, value: state }
    });

    const newPosition = (tierData.baseCount || 0) + subscribers.length;

    res.status(201).json({
      success: true,
      alreadyJoined: false,
      position: newPosition,
      count: newPosition,
      message: `🎉 You're on the list! You've reserved spot #${newPosition} for ${tierData.title}. We'll notify ${email} first in January 2027!`
    });
  } catch (error) {
    console.error('Error joining waitlist:', error);
    res.status(500).json({ message: 'Failed to join waitlist. Please try again.' });
  }
};

module.exports = {
  getWaitlistCounts,
  joinWaitlist,
};
