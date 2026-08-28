const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dailyReviewService = require('../services/dailyReviewService');
const { enqueueAiJob } = require('../jobs/queues/aiQueue');

const writtenFields = [
  'whatWentWell',
  'whatWentWrong',
  'lessonsLearned',
  'tomorrowFocus',
  'followedPlan',
  'emotionalState',
  'marketConditions',
  'generalNotes',
  'status',
];

/**
 * GET /api/daily-reviews/day
 * Retrieve calculated metrics, trades, and saved review for date & account context
 */
const getDailyReviewForDay = async (req, res) => {
  try {
    const { date, accountId } = req.query;
    const summary = await dailyReviewService.getDailyReviewSummary({
      userId: req.user.id,
      date,
      accountId,
      timezone: req.user.timezone || 'UTC',
    });

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[getDailyReviewForDay Error]', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'We could not retrieve your daily review.' });
  }
};

/**
 * GET /api/daily-reviews/:id
 * Retrieve specific DailyReview by ID (owned by authenticated user)
 */
const getDailyReviewById = async (req, res) => {
  try {
    const review = await prisma.dailyReview.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        tradingAccount: { select: { id: true, name: true, currency: true } },
        sharedDailyReviews: {
          where: { isActive: true },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ message: 'Daily review not found.' });
    }

    return res.json({ success: true, data: review });
  } catch (error) {
    console.error('[getDailyReviewById Error]', error);
    return res.status(500).json({ message: 'Error retrieving daily review.' });
  }
};

/**
 * POST /api/daily-reviews
 * Create or save daily review notes for a date & account context
 */
const saveDailyReview = async (req, res) => {
  try {
    const { date, accountId } = req.body;
    const { reviewDate, scopeKey } = await dailyReviewService.normalizeDateRange(date);

    if (accountId) {
      const account = await prisma.tradingAccount.findFirst({
        where: { id: accountId, userId: req.user.id },
      });
      if (!account) {
        return res.status(404).json({ message: 'Trading account not found.' });
      }
    }

    // Get current calculated metrics snapshot
    const summary = await dailyReviewService.getDailyReviewSummary({
      userId: req.user.id,
      date,
      accountId,
      timezone: req.user.timezone || 'UTC',
    });

    const updatePayload = {
      status: req.body.status && ['DRAFT', 'COMPLETED', 'REVIEWED'].includes(req.body.status) ? req.body.status : 'DRAFT',
      whatWentWell: req.body.whatWentWell ? String(req.body.whatWentWell).slice(0, 5000) : null,
      whatWentWrong: req.body.whatWentWrong ? String(req.body.whatWentWrong).slice(0, 5000) : null,
      lessonsLearned: req.body.lessonsLearned ? String(req.body.lessonsLearned).slice(0, 5000) : null,
      tomorrowFocus: req.body.tomorrowFocus ? String(req.body.tomorrowFocus).slice(0, 5000) : null,
      followedPlan: typeof req.body.followedPlan === 'boolean' ? req.body.followedPlan : null,
      emotionalState: req.body.emotionalState ? String(req.body.emotionalState).slice(0, 500) : null,
      marketConditions: req.body.marketConditions ? String(req.body.marketConditions).slice(0, 500) : null,
      generalNotes: req.body.generalNotes ? String(req.body.generalNotes).slice(0, 5000) : null,

      totalTrades: summary?.metrics?.totalTrades ?? 0,
      winRate: summary?.metrics?.winRate ?? 0,
      netProfitLoss: summary?.metrics?.netProfitLoss ?? 0,
      profitFactor: summary?.metrics?.profitFactor ?? null,
      totalPips: summary?.metrics?.totalPips ?? null,
      averageRiskReward: summary?.metrics?.averageRiskReward ?? null,
    };

    const review = await prisma.dailyReview.upsert({
      where: {
        userId_scopeKey_reviewDate: {
          userId: req.user.id,
          scopeKey,
          reviewDate,
        },
      },
      update: updatePayload,
      create: {
        userId: req.user.id,
        tradingAccountId: accountId || null,
        scopeKey,
        reviewDate,
        ...updatePayload,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Daily review saved successfully.',
      data: review,
    });
  } catch (error) {
    console.error('[saveDailyReview Error]', error);
    return res.status(500).json({ message: 'Failed to save daily review.' });
  }
};

/**
 * PUT /api/daily-reviews/:id
 * Update an existing review by ID
 */
const updateDailyReview = async (req, res) => {
  try {
    const review = await prisma.dailyReview.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!review) {
      return res.status(404).json({ message: 'Daily review not found.' });
    }

    const data = {};
    writtenFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'followedPlan') {
          data[field] = typeof req.body[field] === 'boolean' ? req.body[field] : null;
        } else if (field === 'status') {
          if (['DRAFT', 'COMPLETED', 'REVIEWED'].includes(req.body[field])) {
            data[field] = req.body[field];
          }
        } else {
          data[field] = req.body[field] ? String(req.body[field]).slice(0, 5000) : null;
        }
      }
    });

    const updated = await prisma.dailyReview.update({
      where: { id: review.id },
      data,
    });

    return res.json({
      success: true,
      message: 'Daily review updated.',
      data: updated,
    });
  } catch (error) {
    console.error('[updateDailyReview Error]', error);
    return res.status(500).json({ message: 'Failed to update daily review.' });
  }
};

/**
 * POST /api/daily-reviews/:id/ai-review
 * Queue JAHZ AI Daily Review job
 */
const triggerAiDailyReview = async (req, res) => {
  try {
    const review = await prisma.dailyReview.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!review) {
      return res.status(404).json({ message: 'Daily review not found. Please save your review before requesting AI analysis.' });
    }

    // Check for existing active AI request for this review (Duplicate Protection)
    const activeRequest = await prisma.aiRequest.findFirst({
      where: {
        userId: req.user.id,
        featureType: 'DAILY_REVIEW',
        status: { in: ['QUEUED', 'PROCESSING'] },
        id: review.aiRequestId || undefined,
      },
    });

    if (activeRequest) {
      return res.json({
        success: true,
        message: 'An AI review is already processing for this day.',
        data: {
          aiRequestId: activeRequest.id,
          dailyReviewId: review.id,
          status: activeRequest.status,
        },
      });
    }

    // Create AiRequest ledger entry
    const aiRequest = await prisma.aiRequest.create({
      data: {
        userId: req.user.id,
        featureType: 'DAILY_REVIEW',
        status: 'QUEUED',
        provider: 'openai',
        model: 'gpt-4o-mini',
        promptVersion: 'v1.0',
      },
    });

    // Link aiRequestId to DailyReview
    await prisma.dailyReview.update({
      where: { id: review.id },
      data: { aiRequestId: aiRequest.id },
    });

    // Enqueue BullMQ worker or sync fallback
    await enqueueAiJob('processDailyReview', {
      aiRequestId: aiRequest.id,
      dailyReviewId: review.id,
      userId: req.user.id,
    });

    return res.json({
      success: true,
      message: 'JAHZ AI Daily Review queued.',
      data: {
        aiRequestId: aiRequest.id,
        dailyReviewId: review.id,
        status: 'QUEUED',
      },
    });
  } catch (error) {
    console.error('[triggerAiDailyReview Error]', error);
    return res.status(500).json({ message: 'Failed to queue JAHZ AI Daily Review.' });
  }
};

/**
 * GET /api/daily-reviews/ai-status/:aiRequestId
 * Poll AI request processing status
 */
const getAiReviewStatus = async (req, res) => {
  try {
    const aiRequest = await prisma.aiRequest.findFirst({
      where: {
        id: req.params.aiRequestId,
        userId: req.user.id,
      },
    });

    if (!aiRequest) {
      return res.status(404).json({ message: 'AI request not found.' });
    }

    let reviewData = null;
    if (aiRequest.status === 'COMPLETED') {
      const review = await prisma.dailyReview.findFirst({
        where: { aiRequestId: aiRequest.id, userId: req.user.id },
      });
      if (review) {
        reviewData = {
          aiSummary: review.aiSummary,
          aiStructuredOutput: review.aiStructuredOutput,
          aiGeneratedAt: review.aiGeneratedAt,
        };
      }
    }

    return res.json({
      success: true,
      data: {
        id: aiRequest.id,
        status: aiRequest.status,
        errorMessage: aiRequest.errorMessage,
        structuredOutput: aiRequest.structuredOutput || reviewData?.aiStructuredOutput,
        summary: reviewData?.aiSummary,
        completedAt: aiRequest.completedAt,
      },
    });
  } catch (error) {
    console.error('[getAiReviewStatus Error]', error);
    return res.status(500).json({ message: 'Error checking AI status.' });
  }
};

module.exports = {
  getDailyReviewForDay,
  getDailyReviewById,
  saveDailyReview,
  updateDailyReview,
  triggerAiDailyReview,
  getAiReviewStatus,
};
