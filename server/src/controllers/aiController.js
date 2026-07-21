const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enqueueAiJob } = require('../jobs/queues/aiQueue');

const checkAiLimit = async (userId, plan, featureType) => {
  const userSettings = await prisma.userSettings.findUnique({ where: { userId } });
  
  if (userSettings && userSettings.enableJahzAi === false) {
    return { allowed: false, message: 'JAHZ AI is disabled in your settings.' };
  }

  if (featureType === 'TRADE_REVIEW' || featureType === 'EDGE_FINDER' || featureType === 'WEEKLY_COACH') {
     if (userSettings && userSettings.allowTradeDataAnalysis === false) {
       return { allowed: false, message: 'Trade data analysis is disabled in your privacy settings.' };
     }
  }
  if (featureType === 'SCREENSHOT_REVIEW') {
     if (!userSettings || userSettings.allowScreenshotAnalysis === false) {
       return { allowed: false, message: 'Screenshot analysis is disabled in your privacy settings. Please enable it to use this feature.' };
     }
  }

  if (plan === 'FREE') {
     if (featureType === 'TRADE_REVIEW' || featureType === 'CHAT_SUPPORT') {
         const limit = 2;
         const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
         const usageCount = await prisma.aiRequest.count({ where: { userId, featureType, createdAt: { gte: startOfMonth } } });
         if (usageCount >= limit) return { allowed: false, message: `Free plan limit reached (${limit}/${limit}). Upgrade your plan.` };
         return { allowed: true };
     }
     return { allowed: false, message: 'This AI feature requires a paid subscription.' };
  }

  const featureLimits = {
      'STARTER': {
         'TRADE_REVIEW': 10,
         'WEEKLY_COACH': 5,
         'CHAT_SUPPORT': 10,
         'JOURNAL_ASSISTANT': 20,
      },
      'PRO': {
         'TRADE_REVIEW': 50,
         'WEEKLY_COACH': 20,
         'CHAT_SUPPORT': 50,
         'EDGE_FINDER': 10,
         'TRADING_PLAN': 5,
         'SCREENSHOT_REVIEW': 20,
         'JOURNAL_ASSISTANT': 100,
         'PSYCHOLOGY_INSIGHTS': 10
      },
      'MENTOR': {
         'TRADE_REVIEW': Infinity,
         'WEEKLY_COACH': Infinity,
         'CHAT_SUPPORT': Infinity,
         'EDGE_FINDER': Infinity,
         'TRADING_PLAN': Infinity,
         'SCREENSHOT_REVIEW': Infinity,
         'JOURNAL_ASSISTANT': Infinity,
         'PSYCHOLOGY_INSIGHTS': Infinity,
         'MENTOR_SUMMARY': Infinity
      }
  };

  const planLimits = featureLimits[plan] || {};
  const limit = planLimits[featureType];

  if (limit === undefined) {
      return { allowed: false, message: `Your ${plan} plan does not include this AI feature.` };
  }
  if (limit === Infinity) return { allowed: true };

  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const usageCount = await prisma.aiRequest.count({
    where: { userId, featureType, createdAt: { gte: startOfMonth } }
  });

  if (usageCount >= limit) {
    return { allowed: false, message: `You have reached your monthly limit for this feature (${limit}/${limit}).` };
  }

  return { allowed: true };
};

const generateTradeInsight = async (req, res) => {
  try {
    const { tradeId } = req.params;

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        tradingAccount: { select: { userId: true } },
      }
    });

    if (!trade || trade.tradingAccount.userId !== req.user.id) {
      return res.status(404).json({ message: 'Trade not found.' });
    }

    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan, 'TRADE_REVIEW');
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    // Check if there is already a processing request
    const existingReq = await prisma.aiRequest.findFirst({
      where: {
        tradeId,
        featureType: 'TRADE_REVIEW',
        status: { in: ['QUEUED', 'PROCESSING'] }
      }
    });

    if (existingReq) {
      return res.status(400).json({ message: 'A review is already generating for this trade.' });
    }

    // Temporarily create aiTradeReview stub to ensure UI updates during refactoring stage
    await prisma.aiTradeReview.create({
      data: {
        tradeId,
        reviewStatus: 'PROCESSING',
      }
    });

    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        tradeId,
        featureType: 'TRADE_REVIEW',
        status: 'QUEUED',
        provider: 'Pending',
        model: 'Pending',
        promptVersion: '1.0'
      }
    });

    // Enqueue job via BullMQ fallback system
    await enqueueAiJob('processTradeReview', {
      aiRequestId: aiRequest.id,
      tradeId: tradeId,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Trade review generation has been queued.',
      requestId: aiRequest.id,
      status: 'PROCESSING'
    });
  } catch (error) {
    console.error('AI Insight Error:', error);
    res.status(500).json({ message: 'Our AI mentor encountered an error analyzing your trade.' });
  }
};

const generateWeeklyCoach = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await prisma.weeklyReview.findUnique({
      where: { id: reviewId },
      include: {
        tradingAccount: { select: { userId: true } }
      }
    });

    if (!review || (review.tradingAccount && review.tradingAccount.userId !== req.user.id) || (!review.tradingAccount && review.userId !== req.user.id)) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan, 'WEEKLY_COACH');
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    // Check existing
    const existingReq = await prisma.aiRequest.findFirst({
      where: {
        weeklyReviewId: reviewId,
        featureType: 'WEEKLY_COACH',
        status: { in: ['QUEUED', 'PROCESSING'] }
      }
    });

    if (existingReq) {
      return res.status(400).json({ message: 'A coaching summary is already generating for this review.' });
    }

    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        weeklyReviewId: reviewId,
        featureType: 'WEEKLY_COACH',
        status: 'QUEUED',
        provider: 'Pending',
        model: 'Pending',
        promptVersion: '1.0'
      }
    });

    await enqueueAiJob('processWeeklyCoach', {
      aiRequestId: aiRequest.id,
      weeklyReviewId: reviewId,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Weekly coach generation has been queued.',
      requestId: aiRequest.id,
      status: 'PROCESSING'
    });
  } catch (error) {
    console.error('AI Weekly Coach Error:', error);
    res.status(500).json({ message: 'Our AI coach encountered an error analyzing your week.' });
  }
}

const generateEdgeFinder = async (req, res) => {
  try {
    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan, 'EDGE_FINDER');
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    const existingReq = await prisma.aiRequest.findFirst({
      where: {
        userId: req.user.id,
        featureType: 'EDGE_FINDER',
        status: { in: ['QUEUED', 'PROCESSING'] }
      }
    });

    if (existingReq) {
      return res.status(400).json({ message: 'An edge analysis is already running.' });
    }

    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        featureType: 'EDGE_FINDER',
        status: 'QUEUED',
        provider: 'Pending',
        model: 'Pending',
        promptVersion: '1.0'
      }
    });

    await enqueueAiJob('processEdgeFinder', {
      aiRequestId: aiRequest.id,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Edge finder generation queued.',
      requestId: aiRequest.id,
      status: 'PROCESSING'
    });
  } catch (error) {
    console.error('AI Edge Finder Error:', error);
    res.status(500).json({ message: 'Error queueing edge finder.' });
  }
};

const generateTradingPlan = async (req, res) => {
  try {
    const { strategy, pairs, risk, goals } = req.body;
    
    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan, 'TRADING_PLAN');
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    const existingReq = await prisma.aiRequest.findFirst({
      where: { userId: req.user.id, featureType: 'TRADING_PLAN', status: { in: ['QUEUED', 'PROCESSING'] } }
    });

    if (existingReq) {
      return res.status(400).json({ message: 'A trading plan is already being generated.' });
    }

    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        featureType: 'TRADING_PLAN',
        status: 'QUEUED',
        provider: 'Pending',
        model: 'Pending',
        promptVersion: '1.0',
        inputSnapshot: { strategy, pairs, risk, goals }
      }
    });

    await enqueueAiJob('processTradingPlan', {
      aiRequestId: aiRequest.id,
      userId: req.user.id
    });

    res.json({ success: true, requestId: aiRequest.id, status: 'PROCESSING' });
  } catch (error) {
    console.error('Trading Plan Generation Error:', error);
    res.status(500).json({ message: 'Error generating trading plan.' });
  }
};

const generateVisionInsight = async (req, res) => {
  try {
    const { screenshotId } = req.body;
    
    if (!screenshotId) {
       return res.status(400).json({ message: 'Screenshot ID is required.' });
    }

    const screenshot = await prisma.tradeScreenshot.findUnique({
      where: { id: screenshotId },
      include: { trade: { include: { tradingAccount: { select: { userId: true } } } } }
    });

    if (!screenshot || screenshot.trade.tradingAccount.userId !== req.user.id) {
       return res.status(404).json({ message: 'Screenshot not found.' });
    }

    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan, 'SCREENSHOT_REVIEW');
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    // Prevent duplicate processing
    const existingReq = await prisma.aiRequest.findFirst({
      where: {
        userId: req.user.id,
        featureType: 'SCREENSHOT_REVIEW',
        status: { in: ['QUEUED', 'PROCESSING'] },
      }
    });

    // Check if the exact screenshot is being processed inside inputSnapshot JSON
    if (existingReq && existingReq.inputSnapshot?.screenshotId === screenshotId) {
      return res.status(400).json({ message: 'This screenshot is already being analyzed.' });
    }

    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        tradeId: screenshot.tradeId,
        featureType: 'SCREENSHOT_REVIEW',
        status: 'QUEUED',
        provider: 'Pending',
        model: 'Pending',
        promptVersion: 'vision-1.1',
        inputSnapshot: { screenshotId }
      }
    });

    await enqueueAiJob('processVisionAnalysis', {
      aiRequestId: aiRequest.id,
      screenshotId,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Vision analysis queued.',
      requestId: aiRequest.id,
      status: 'PROCESSING'
    });

  } catch (error) {
    console.error('Vision Generation Error:', error);
    res.status(500).json({ message: 'Error queueing vision analysis.' });
  }
};

const getVisionInsight = async (req, res) => {
  try {
    const { screenshotId } = req.params;
    const aiRequest = await prisma.aiRequest.findFirst({
       where: {
         userId: req.user.id,
         featureType: 'SCREENSHOT_REVIEW',
         // postgres json containment check using loosely matched snapshot string
       },
       orderBy: { createdAt: 'desc' }
    });
    
    // Fallback manual filtering since prisma JSON path matching is strict
    if (aiRequest && aiRequest.inputSnapshot && aiRequest.inputSnapshot.screenshotId === screenshotId) {
       return res.json(aiRequest);
    }

    // Try finding all and returning the first matching one
    const allRequests = await prisma.aiRequest.findMany({
       where: { userId: req.user.id, featureType: 'SCREENSHOT_REVIEW' },
       orderBy: { createdAt: 'desc' }
    });
    
    const matched = allRequests.find(r => r.inputSnapshot && r.inputSnapshot.screenshotId === screenshotId);
    if (matched) return res.json(matched);

    res.json(null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving vision insight' });
  }
};

const getVisionInsightsByTrade = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const aiRequests = await prisma.aiRequest.findMany({
       where: {
         userId: req.user.id,
         tradeId: tradeId,
         featureType: 'SCREENSHOT_REVIEW'
       },
       orderBy: { createdAt: 'desc' }
    });
    
    res.json(aiRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving trade vision insights' });
  }
};

const generateJournalDraft = async (req, res) => {
  try {
    const { draftType, tradeData } = req.body;
    
    // Check consent limit
    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan, 'JOURNAL_ASSISTANT');
    if (!limitCheck.allowed) return res.status(403).json({ message: limitCheck.message });

    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        tradeId: tradeData.id || null, // Optional if trade isn't created yet
        featureType: 'JOURNAL_ASSISTANT',
        status: 'QUEUED',
        provider: 'Pending',
        model: 'Pending',
        promptVersion: '1.0',
        inputSnapshot: { draftType, tradeData }
      }
    });

    await enqueueAiJob('processJournalDraft', {
      aiRequestId: aiRequest.id,
      draftType,
      tradeData,
      userId: req.user.id
    });

    res.json({ success: true, requestId: aiRequest.id, status: 'PROCESSING' });
  } catch (error) {
    console.error('Journal Draft Error:', error);
    res.status(500).json({ message: 'Error queueing journal draft.' });
  }
};

const getJournalDraft = async (req, res) => {
  try {
    const { requestId } = req.params;
    const reqData = await prisma.aiRequest.findFirst({
      where: { id: requestId, userId: req.user.id }
    });
    if (!reqData) return res.status(404).json({ message: 'Draft not found.' });
    res.json(reqData);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving draft logic.' });
  }
};

const getAiOverview = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { userSettings: true }
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const nextMonth = new Date(startOfMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const recentRequests = await prisma.aiRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const processingCount = await prisma.aiRequest.count({
      where: { userId: req.user.id, status: { in: ['QUEUED', 'PROCESSING'] } }
    });

    const reviewableTrades = await prisma.trade.findMany({
      where: {
        tradingAccount: { userId: req.user.id },
        status: 'CLOSED',
        aiReviews: { none: {} }
      },
      orderBy: { exitTime: 'desc' },
      take: 5
    });

    res.json({
       plan: user.subscriptionPlan,
       consent: {
          enabled: user.userSettings?.enableJahzAi !== false,
          tradeAnalysis: user.userSettings?.allowTradeDataAnalysis !== false,
          screenshotAnalysis: user.userSettings?.allowScreenshotAnalysis === true,
       },
       recentRequests,
       processingCount,
       reviewableTrades,
       resetDate: nextMonth.toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving AI Overview' });
  }
};

const getAiUsage = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const plan = req.user.subscriptionPlan || 'FREE';
    // Free: 0, Starter: 5/mo, Pro: 50/mo, Mentor: Unlimited
    const limit = plan === 'STARTER' ? 5 : plan === 'PRO' ? 50 : plan === 'FREE' ? 0 : Infinity;

    const group = await prisma.aiRequest.groupBy({
      by: ['featureType'],
      where: {
        userId: req.user.id,
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth }
      },
      _count: true
    });

    const usageByFeature = {};
    let totalCurrentMonth = 0;
    for (const row of group) {
       usageByFeature[row.featureType] = row._count;
       totalCurrentMonth += row._count;
    }
    
    const nextMonth = new Date(startOfMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    res.json({
       plan,
       limit,
       totalCurrentMonth,
       usageByFeature,
       resetDate: nextMonth.toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving usage statistics' });
  }
};

const clearAiHistory = async (req, res) => {
  try {
     await prisma.aiRequest.deleteMany({
       where: { userId: req.user.id }
     });
     res.json({ message: 'All AI request history has been erased.' });
  } catch (error) {
     res.status(500).json({ message: 'Failed to erase AI history.' });
  }
};

module.exports = {
  generateTradeInsight,
  generateWeeklyCoach,
  generateEdgeFinder,
  generateTradingPlan,
  generateVisionInsight,
  getVisionInsight,
  getVisionInsightsByTrade,
  generateJournalDraft,
  getAiOverview,
  getJournalDraft,
  getAiUsage,
  clearAiHistory
};
