const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dailyReviewService = require('../services/dailyReviewService');
const { calculatePips } = require('../utils/pipCalculator');

const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

// ==========================================
// PRIVATE CONTROLLERS (AUTHENTICATED TRADER)
// ==========================================

/**
 * POST /api/trades/:id/share
 * Create or reactivate public share token for an individual trade
 */
const shareTrade = async (req, res) => {
  try {
    const { id: tradeId } = req.params;
    const { includeScreenshot } = req.body;

    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { userId: req.user.id } },
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found.' });
    }

    let sharedTrade = await prisma.sharedTrade.findFirst({
      where: { tradeId, userId: req.user.id },
    });

    if (sharedTrade) {
      sharedTrade = await prisma.sharedTrade.update({
        where: { id: sharedTrade.id },
        data: {
          isActive: true,
          includeScreenshot: typeof includeScreenshot === 'boolean' ? includeScreenshot : sharedTrade.includeScreenshot,
          shareCount: { increment: 1 },
        },
      });
    } else {
      const shareToken = generateSecureToken();
      sharedTrade = await prisma.sharedTrade.create({
        data: {
          tradeId,
          userId: req.user.id,
          shareToken,
          isActive: true,
          includeScreenshot: typeof includeScreenshot === 'boolean' ? includeScreenshot : false,
          shareCount: 1,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Trade share link generated.',
      data: {
        id: sharedTrade.id,
        shareToken: sharedTrade.shareToken,
        shareUrl: `/shared/trade/${sharedTrade.shareToken}`,
        includeScreenshot: sharedTrade.includeScreenshot,
        isActive: sharedTrade.isActive,
      },
    });
  } catch (error) {
    console.error('[shareTrade Error]', error);
    return res.status(500).json({ message: 'Failed to generate trade share link.' });
  }
};

/**
 * PATCH /api/trades/:id/share
 * Update options for an existing trade share link
 */
const updateTradeShare = async (req, res) => {
  try {
    const { id: tradeId } = req.params;
    const { includeScreenshot, isActive } = req.body;

    const sharedTrade = await prisma.sharedTrade.findFirst({
      where: { tradeId, userId: req.user.id },
    });

    if (!sharedTrade) {
      return res.status(404).json({ message: 'Share link not found for this trade.' });
    }

    const data = {};
    if (typeof includeScreenshot === 'boolean') data.includeScreenshot = includeScreenshot;
    if (typeof isActive === 'boolean') data.isActive = isActive;

    const updated = await prisma.sharedTrade.update({
      where: { id: sharedTrade.id },
      data,
    });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        shareToken: updated.shareToken,
        shareUrl: `/shared/trade/${updated.shareToken}`,
        includeScreenshot: updated.includeScreenshot,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('[updateTradeShare Error]', error);
    return res.status(500).json({ message: 'Failed to update trade share link.' });
  }
};

/**
 * DELETE /api/trades/:id/share
 * Revoke public sharing for a trade
 */
const revokeTradeShare = async (req, res) => {
  try {
    const { id: tradeId } = req.params;

    const sharedTrade = await prisma.sharedTrade.findFirst({
      where: { tradeId, userId: req.user.id },
    });

    if (!sharedTrade) {
      return res.status(404).json({ message: 'Share link not found for this trade.' });
    }

    await prisma.sharedTrade.update({
      where: { id: sharedTrade.id },
      data: { isActive: false },
    });

    return res.json({ success: true, message: 'Trade share link revoked successfully.' });
  } catch (error) {
    console.error('[revokeTradeShare Error]', error);
    return res.status(500).json({ message: 'Failed to revoke trade share link.' });
  }
};

/**
 * POST /api/daily-reviews/:id/share
 * Create or update public share link for a daily review
 */
const shareDailyReview = async (req, res) => {
  try {
    const { id: dailyReviewId } = req.params;
    const { includeAiReview, includeNotes, includeScreenshots } = req.body;

    const review = await prisma.dailyReview.findFirst({
      where: { id: dailyReviewId, userId: req.user.id },
    });

    if (!review) {
      return res.status(404).json({ message: 'Daily review not found.' });
    }

    let sharedReview = await prisma.sharedDailyReview.findFirst({
      where: { dailyReviewId, userId: req.user.id },
    });

    if (sharedReview) {
      sharedReview = await prisma.sharedDailyReview.update({
        where: { id: sharedReview.id },
        data: {
          isActive: true,
          includeAiReview: typeof includeAiReview === 'boolean' ? includeAiReview : sharedReview.includeAiReview,
          includeNotes: typeof includeNotes === 'boolean' ? includeNotes : sharedReview.includeNotes,
          includeScreenshots: typeof includeScreenshots === 'boolean' ? includeScreenshots : sharedReview.includeScreenshots,
          shareCount: { increment: 1 },
        },
      });
    } else {
      const shareToken = generateSecureToken();
      sharedReview = await prisma.sharedDailyReview.create({
        data: {
          dailyReviewId,
          userId: req.user.id,
          shareToken,
          isActive: true,
          includeAiReview: typeof includeAiReview === 'boolean' ? includeAiReview : true,
          includeNotes: typeof includeNotes === 'boolean' ? includeNotes : true,
          includeScreenshots: typeof includeScreenshots === 'boolean' ? includeScreenshots : false,
          shareCount: 1,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Daily review share link generated.',
      data: {
        id: sharedReview.id,
        shareToken: sharedReview.shareToken,
        shareUrl: `/shared/daily-review/${sharedReview.shareToken}`,
        includeAiReview: sharedReview.includeAiReview,
        includeNotes: sharedReview.includeNotes,
        includeScreenshots: sharedReview.includeScreenshots,
        isActive: sharedReview.isActive,
      },
    });
  } catch (error) {
    console.error('[shareDailyReview Error]', error);
    return res.status(500).json({ message: 'Failed to generate daily review share link.' });
  }
};

/**
 * PATCH /api/daily-reviews/:id/share
 * Update sharing permissions for a daily review link
 */
const updateDailyReviewShare = async (req, res) => {
  try {
    const { id: dailyReviewId } = req.params;
    const { includeAiReview, includeNotes, includeScreenshots, isActive } = req.body;

    const sharedReview = await prisma.sharedDailyReview.findFirst({
      where: { dailyReviewId, userId: req.user.id },
    });

    if (!sharedReview) {
      return res.status(404).json({ message: 'Share link not found for this daily review.' });
    }

    const data = {};
    if (typeof includeAiReview === 'boolean') data.includeAiReview = includeAiReview;
    if (typeof includeNotes === 'boolean') data.includeNotes = includeNotes;
    if (typeof includeScreenshots === 'boolean') data.includeScreenshots = includeScreenshots;
    if (typeof isActive === 'boolean') data.isActive = isActive;

    const updated = await prisma.sharedDailyReview.update({
      where: { id: sharedReview.id },
      data,
    });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        shareToken: updated.shareToken,
        shareUrl: `/shared/daily-review/${updated.shareToken}`,
        includeAiReview: updated.includeAiReview,
        includeNotes: updated.includeNotes,
        includeScreenshots: updated.includeScreenshots,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('[updateDailyReviewShare Error]', error);
    return res.status(500).json({ message: 'Failed to update daily review share link.' });
  }
};

/**
 * DELETE /api/daily-reviews/:id/share
 * Revoke public sharing for a daily review
 */
const revokeDailyReviewShare = async (req, res) => {
  try {
    const { id: dailyReviewId } = req.params;

    const sharedReview = await prisma.sharedDailyReview.findFirst({
      where: { dailyReviewId, userId: req.user.id },
    });

    if (!sharedReview) {
      return res.status(404).json({ message: 'Share link not found.' });
    }

    await prisma.sharedDailyReview.update({
      where: { id: sharedReview.id },
      data: { isActive: false },
    });

    return res.json({ success: true, message: 'Daily review share link revoked.' });
  } catch (error) {
    console.error('[revokeDailyReviewShare Error]', error);
    return res.status(500).json({ message: 'Failed to revoke daily review share link.' });
  }
};

// ==========================================
// PUBLIC CONTROLLERS (UNAUTHENTICATED SAFE)
// ==========================================

/**
 * GET /api/shared/trade/:shareToken
 * Retrieve public safe DTO for a shared trade
 */
const getPublicSharedTrade = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const sharedTrade = await prisma.sharedTrade.findUnique({
      where: { shareToken },
      include: {
        trade: {
          include: {
            tradingAccount: { select: { currency: true } },
            strategy: { select: { name: true } },
            setup: { select: { name: true } },
            screenshots: { select: { imageUrl: true, note: true }, take: 1 },
          },
        },
      },
    });

    if (!sharedTrade || !sharedTrade.isActive || !sharedTrade.trade) {
      return res.status(404).json({
        success: false,
        message: 'This shared trade link is invalid or has been revoked by the owner.',
      });
    }

    // Increment view count asynchronously
    prisma.sharedTrade.update({
      where: { id: sharedTrade.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    }).catch(() => {});

    const t = sharedTrade.trade;
    const computedPips = calculatePips({
      pair: t.pair,
      direction: t.direction,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      pips: t.pips,
    });

    const publicTradeDto = {
      pair: t.pair,
      direction: t.direction,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      profitLossAmount: t.profitLossAmount,
      currency: t.tradingAccount?.currency || 'USD',
      pips: computedPips,
      riskRewardRatio: t.riskRewardRatio,
      result: t.result,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      session: t.session,
      strategyName: t.strategy?.name || null,
      setupName: t.setup?.name || null,
      screenshotUrl: sharedTrade.includeScreenshot && t.screenshots[0] ? t.screenshots[0].imageUrl : null,
    };

    return res.json({
      success: true,
      data: publicTradeDto,
    });
  } catch (error) {
    console.error('[getPublicSharedTrade Error]', error);
    return res.status(500).json({ message: 'Error retrieving shared trade.' });
  }
};

/**
 * GET /api/shared/daily-review/:shareToken
 * Retrieve public safe DTO for a shared daily review
 */
const getPublicSharedDailyReview = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const sharedReview = await prisma.sharedDailyReview.findUnique({
      where: { shareToken },
      include: {
        dailyReview: true,
      },
    });

    if (!sharedReview || !sharedReview.isActive || !sharedReview.dailyReview) {
      return res.status(404).json({
        success: false,
        message: 'This shared daily review link is invalid or has been revoked by the owner.',
      });
    }

    // Increment view count asynchronously
    prisma.sharedDailyReview.update({
      where: { id: sharedReview.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    }).catch(() => {});

    const dr = sharedReview.dailyReview;
    const summaryData = await dailyReviewService.getDailyReviewSummary({
      userId: dr.userId,
      date: dr.reviewDate,
      accountId: dr.tradingAccountId,
    });

    const publicDailyReviewDto = {
      reviewDate: dr.reviewDate,
      metrics: summaryData.metrics,
      aiReview: sharedReview.includeAiReview ? (dr.aiStructuredOutput || dr.aiSummary ? {
        summary: dr.aiSummary,
        structured: dr.aiStructuredOutput,
      } : null) : null,
      notes: sharedReview.includeNotes ? {
        whatWentWell: dr.whatWentWell,
        whatWentWrong: dr.whatWentWrong,
        lessonsLearned: dr.lessonsLearned,
        tomorrowFocus: dr.tomorrowFocus,
      } : null,
      trades: summaryData.trades.map((t) => ({
        pair: t.pair,
        direction: t.direction,
        pnl: t.profitLossAmount,
        pips: t.pips,
        rr: t.riskRewardRatio,
        result: t.result,
        session: t.session,
        strategyName: t.strategy?.name,
        currency: t.tradingAccount?.currency || 'USD',
        screenshotUrl: sharedReview.includeScreenshots && t.screenshots[0] ? t.screenshots[0].imageUrl : null,
      })),
    };

    return res.json({
      success: true,
      data: publicDailyReviewDto,
    });
  } catch (error) {
    console.error('[getPublicSharedDailyReview Error]', error);
    return res.status(500).json({ message: 'Error retrieving shared daily review.' });
  }
};

module.exports = {
  shareTrade,
  updateTradeShare,
  revokeTradeShare,
  shareDailyReview,
  updateDailyReviewShare,
  revokeDailyReviewShare,
  getPublicSharedTrade,
  getPublicSharedDailyReview,
};
